import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  db,
  listings,
  listingImages,
  reviews,
  returnReasons,
  reviewAnalysis,
  listingIssues,
  listingScores,
  eq,
  and,
  desc,
} from '@workspace/db';
import { runListingIntelligencePipeline } from '../lib/listingAnalysis/pipeline';
import { sanitizeReviewText, computeTextHash, getListingSource } from '../lib/listingAnalysis/listingSources';
import { enqueueReviewAnalyze, enqueueImageAnalyze } from '../lib/queue';

const router: Router = Router();

// 1. POST /listings/import
// Accepts CSV/JSON with documented column mapping (platform, sku, title, description, category, price, size_chart_present)
router.post('/listings/import', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.storeId;
    const { platform = 'shopify', items = [] } = req.body;

    const source = getListingSource(platform);
    const isSimulated = !source.isRealConnector;

    const imported = [];
    for (const raw of items) {
      const sku = String(raw.sku || raw.SKU || '').trim();
      const title = String(raw.title || raw.Title || raw.name || '').trim();
      if (!sku || !title) continue;

      const listingId = `lst_${storeId}_${platform}_${sku}`;
      const price = Number(raw.price || raw.Price || 0);
      const category = String(raw.category || raw.Category || 'Apparel');
      const sizeChartPresent = Boolean(raw.sizeChartPresent || raw.size_chart_present || raw['Size Chart']);

      const [record] = await db
        .insert(listings)
        .values({
          id: listingId,
          storeId,
          sku,
          platform,
          title,
          description: String(raw.description || raw.Description || ''),
          category,
          price,
          attributes: raw.attributes || {},
          sizeChartPresent,
          status: 'active',
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [listings.id],
          set: {
            title,
            description: String(raw.description || raw.Description || ''),
            category,
            price,
            sizeChartPresent,
            updatedAt: new Date(),
          },
        })
        .returning();

      imported.push(record);

      // Trigger asynchronous image inspection job if images provided
      if (raw.images && Array.isArray(raw.images)) {
        for (let i = 0; i < raw.images.length; i++) {
          const imgUrl = typeof raw.images[i] === 'string' ? raw.images[i] : raw.images[i].url;
          await db
            .insert(listingImages)
            .values({
              id: `img_${listingId}_${i}`,
              storeId,
              listingId,
              url: imgUrl,
              type: raw.images[i]?.type || 'catalog',
              sortOrder: i,
              resolutionWidth: raw.images[i]?.width || 1200,
              resolutionHeight: raw.images[i]?.height || 1200,
            })
            .onConflictDoNothing();
        }
      }

      await enqueueImageAnalyze({ storeId, listingId });
    }

    res.status(201).json({
      success: true,
      platform,
      isSimulated,
      importedCount: imported.length,
      listings: imported,
    });
  } catch (err) {
    next(err);
  }
});

// 2. POST /reviews/import
// Accepts CSV/JSON with documented column mapping: platform, sku, rating, text, date, photos flag, return reason
router.post('/reviews/import', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.storeId;
    const { platform = 'shopify', items = [] } = req.body;

    const source = getListingSource(platform);
    const isSimulated = !source.isRealConnector;

    let reviewCount = 0;
    let returnReasonCount = 0;
    const queueItems: any[] = [];

    for (const raw of items) {
      const sku = String(raw.sku || raw.SKU || '').trim();
      const text = String(raw.text || raw.review_text || raw.comment || raw.Reason || '').trim();
      if (!sku || !text) continue;

      const sanitizedText = sanitizeReviewText(text);
      const textHash = computeTextHash(sanitizedText);
      const rating = Number(raw.rating || raw.Rating || (raw.returnReason ? 1 : 5));
      const hasPhotos = Boolean(raw.hasPhotos || raw.has_photos || raw.photos);
      const photoUrls = Array.isArray(raw.photoUrls || raw.photos) ? (raw.photoUrls || raw.photos) : [];
      const reviewDate = raw.date ? new Date(raw.date) : new Date();

      // Find listing by sku & platform (or fallback to any listing with sku)
      const [matchedListing] = await db
        .select()
        .from(listings)
        .where(and(eq(listings.storeId, storeId), eq(listings.sku, sku)));

      const listingId = matchedListing?.id || `lst_${storeId}_${platform}_${sku}`;

      if (raw.returnReason || raw.reportedReason || raw.orderId) {
        // Ingest as return reason
        returnReasonCount++;
        const retId = `ret_${storeId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await db
          .insert(returnReasons)
          .values({
            id: retId,
            storeId,
            listingId,
            sku,
            platform,
            orderId: raw.orderId ? String(raw.orderId) : null,
            reportedReason: String(raw.returnReason || raw.reportedReason || text),
            customerComment: sanitizedText,
            textHash,
            reportedAt: reviewDate,
          })
          .onConflictDoNothing();

        queueItems.push({
          id: retId,
          type: 'return_reason',
          listingId,
          sku,
          text: sanitizedText,
          rating: 1,
          date: reviewDate.toISOString(),
          textHash,
        });
      } else {
        // Ingest as review
        reviewCount++;
        const revId = `rev_${storeId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await db
          .insert(reviews)
          .values({
            id: revId,
            storeId,
            listingId,
            sku,
            platform,
            rating,
            reviewText: sanitizedText,
            reviewDate,
            hasPhotos,
            photoUrls,
            textHash,
          })
          .onConflictDoNothing();

        queueItems.push({
          id: revId,
          type: 'review',
          listingId,
          sku,
          text: sanitizedText,
          rating,
          date: reviewDate.toISOString(),
          textHash,
        });
      }
    }

    // Enqueue for batch analysis job
    if (queueItems.length > 0) {
      await enqueueReviewAnalyze({
        storeId,
        batchId: `batch_${Date.now()}`,
        items: queueItems,
      });
    }

    res.status(201).json({
      success: true,
      platform,
      isSimulated,
      importedReviewsCount: reviewCount,
      importedReturnReasonsCount: returnReasonCount,
      totalImported: reviewCount + returnReasonCount,
    });
  } catch (err) {
    next(err);
  }
});

// 3. POST /listings/pipeline/run
// Runs or recalculates listing analysis and scores synchronously for current store
router.post('/listings/pipeline/run', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.storeId;
    const { listingId } = req.body || {};
    const result = await runListingIntelligencePipeline(storeId, listingId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 4. GET /listings (with scores, issue counts, and filtering)
router.get('/listings', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.storeId;
    const platform = req.query.platform as string | undefined;

    const conditions = [eq(listings.storeId, storeId)];
    if (platform) {
      conditions.push(eq(listings.platform, platform));
    }

    const allListings = await db
      .select()
      .from(listings)
      .where(and(...conditions))
      .orderBy(desc(listings.createdAt));

    const scores = await db
      .select()
      .from(listingScores)
      .where(eq(listingScores.storeId, storeId));

    const issues = await db
      .select()
      .from(listingIssues)
      .where(eq(listingIssues.storeId, storeId));

    const scoresMap = new Map(scores.map((s) => [s.listingId, s]));

    const response = allListings.map((l) => {
      const score = scoresMap.get(l.id);
      const listingOpenIssues = issues.filter((i) => i.listingId === l.id && i.status !== 'resolved');

      return {
        id: l.id,
        sku: l.sku,
        platform: l.platform,
        title: l.title,
        category: l.category,
        price: l.price,
        sizeChartPresent: l.sizeChartPresent,
        accuracyScore: score?.accuracyScore ?? 100,
        dominantIssue: score?.dominantIssue ?? null,
        listingCausedReturnCount: score?.listingCausedReturnCount ?? 0,
        totalReviewsCount: score?.totalReviewsCount ?? 0,
        totalReturnsCount: score?.totalReturnsCount ?? 0,
        estimatedLoss: score?.estimatedLoss ?? 0,
        estimatedSaving: score?.estimatedSaving ?? 0,
        riskModifier: score?.riskModifier ?? 0,
        openIssuesCount: listingOpenIssues.length,
        status: l.status,
        calculatedAt: score?.calculatedAt || null,
      };
    });

    res.json(response);
  } catch (err) {
    next(err);
  }
});

// 5. GET /listings/summary
// High level KPI overview for listing intelligence
router.get('/listings/summary', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.storeId;

    const allListings = await db
      .select()
      .from(listings)
      .where(eq(listings.storeId, storeId));

    const allScores = await db
      .select()
      .from(listingScores)
      .where(eq(listingScores.storeId, storeId));

    const allIssues = await db
      .select()
      .from(listingIssues)
      .where(eq(listingIssues.storeId, storeId));

    const totalListings = allListings.length;
    const flaggedListings = allScores.filter((s) => s.accuracyScore < 70).length;
    const totalEstimatedLoss = allScores.reduce((acc, s) => acc + s.estimatedLoss, 0);
    const totalEstimatedSaving = allScores.reduce((acc, s) => acc + s.estimatedSaving, 0);
    const openIssuesCount = allIssues.filter((i) => i.status !== 'resolved').length;
    const averageAccuracyScore = totalListings > 0
      ? Math.round(allScores.reduce((acc, s) => acc + s.accuracyScore, 0) / Math.max(1, allScores.length))
      : 100;

    res.json({
      totalListings,
      flaggedListings,
      averageAccuracyScore,
      totalEstimatedLoss,
      totalEstimatedSaving,
      openIssuesCount,
      criticalIssuesCount: allIssues.filter((i) => i.severity === 'critical' && i.status !== 'resolved').length,
    });
  } catch (err) {
    next(err);
  }
});

// 6. GET /listing-alerts
// List of listings that require immediate attention (score < 70 or open critical/high issues)
router.get('/listing-alerts', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.storeId;

    const allScores = await db
      .select()
      .from(listingScores)
      .where(eq(listingScores.storeId, storeId));

    const allListings = await db
      .select()
      .from(listings)
      .where(eq(listings.storeId, storeId));

    const allIssues = await db
      .select()
      .from(listingIssues)
      .where(eq(listingIssues.storeId, storeId));

    const listingMap = new Map(allListings.map((l) => [l.id, l]));

    const alerts = allScores
      .filter((s) => s.accuracyScore < 70 || s.estimatedLoss > 0)
      .map((s) => {
        const listing = listingMap.get(s.listingId);
        const relatedIssues = allIssues.filter((i) => i.listingId === s.listingId && i.status !== 'resolved');

        return {
          listingId: s.listingId,
          sku: listing?.sku || 'UNKNOWN',
          platform: listing?.platform || 'shopify',
          title: listing?.title || 'Unknown SKU',
          accuracyScore: s.accuracyScore,
          dominantIssue: s.dominantIssue,
          listingCausedReturns: s.listingCausedReturnCount,
          estimatedLoss: s.estimatedLoss,
          estimatedSaving: s.estimatedSaving,
          riskModifier: s.riskModifier,
          issues: relatedIssues.map((iss) => ({
            id: iss.id,
            issueType: iss.issueType,
            severity: iss.severity,
            status: iss.status,
            evidenceText: iss.evidenceText,
            suggestedAction: iss.suggestedAction,
          })),
        };
      })
      .sort((a, b) => b.estimatedLoss - a.estimatedLoss);

    res.json(alerts);
  } catch (err) {
    next(err);
  }
});

// 7. GET /listings/:id
// Detailed view with issues, top aspects, evidence reviews, and images
router.get('/listings/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.storeId;
    const listingId = String(req.params.id);

    const [listing] = await db
      .select()
      .from(listings)
      .where(and(eq(listings.storeId, storeId), eq(listings.id, listingId)));

    if (!listing) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }

    const [score] = await db
      .select()
      .from(listingScores)
      .where(and(eq(listingScores.storeId, storeId), eq(listingScores.listingId, listingId)));

    const issues = await db
      .select()
      .from(listingIssues)
      .where(and(eq(listingIssues.storeId, storeId), eq(listingIssues.listingId, listingId)));

    const images = await db
      .select()
      .from(listingImages)
      .where(and(eq(listingImages.storeId, storeId), eq(listingImages.listingId, listingId)))
      .orderBy(listingImages.sortOrder);

    const analyses = await db
      .select()
      .from(reviewAnalysis)
      .where(and(eq(reviewAnalysis.storeId, storeId), eq(reviewAnalysis.listingId, listingId)));

    const evidenceReviews = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.storeId, storeId), eq(reviews.listingId, listingId)))
      .orderBy(desc(reviews.createdAt))
      .limit(20);

    // Aggregate aspects
    const aspectMap = new Map<string, { aspect: string; positive: number; negative: number }>();
    for (const an of analyses) {
      const aspectsList = (an.aspects as any[]) || [];
      for (const asp of aspectsList) {
        if (!asp.aspect) continue;
        const entry = aspectMap.get(asp.aspect) || { aspect: asp.aspect, positive: 0, negative: 0 };
        if (asp.polarity === 'positive') entry.positive++;
        else if (asp.polarity === 'negative') entry.negative++;
        aspectMap.set(asp.aspect, entry);
      }
    }

    res.json({
      ...listing,
      score: score || null,
      issues,
      images,
      topAspects: Array.from(aspectMap.values()),
      evidenceReviews: evidenceReviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        reviewText: r.reviewText,
        hasPhotos: r.hasPhotos,
        reviewDate: r.reviewDate,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// 8. PATCH /listing-issues/:id
// Acknowledge or resolve listing issue
router.patch('/listing-issues/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.storeId;
    const issueId = String(req.params.id);
    const { status, resolutionNotes } = req.body;

    const [updated] = await db
      .update(listingIssues)
      .set({
        ...(status ? { status } : {}),
        ...(resolutionNotes !== undefined ? { resolutionNotes } : {}),
        isHumanReviewed: true,
        updatedAt: new Date(),
      })
      .where(and(eq(listingIssues.storeId, storeId), eq(listingIssues.id, issueId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Issue not found' });
      return;
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
