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
} from '@workspace/db';
import {
  calculateListingScore,
  type AnalyzedFeedbackItem,
} from '@workspace/engine';
import { getTextAnalyzer } from './llmAnalyzer';
import { getImageAnalyzer } from './imageAnalyzer';
import { computeTextHash, sanitizeReviewText } from './listingSources';
import { logger } from '../logger';

export interface RunListingPipelineResult {
  storeId: string;
  processedReviews: number;
  processedReturns: number;
  analyzedIssues: number;
  scoredListings: number;
  flaggedSkus: Array<{
    sku: string;
    title: string;
    accuracyScore: number;
    dominantIssue: string | null;
    listingCausedReturns: number;
    estimatedLoss: number;
    estimatedSaving: number;
    riskModifier: number;
  }>;
}

/**
 * Runs the full listing intelligence analysis pipeline for a store:
 * 1. Text analysis of new reviews and return reasons (idempotent, textHash cached).
 * 2. Image analysis for listing defects (low resolution, missing size chart, customer photo contradictions).
 * 3. Listing score computation with recency weighting and loss/saving estimation.
 * 4. Syncs issues and scores into database.
 */
export async function runListingIntelligencePipeline(
  storeId: string,
  targetListingId?: string,
): Promise<RunListingPipelineResult> {
  logger.info({ storeId, targetListingId }, 'Starting Listing Intelligence Pipeline');

  const textAnalyzer = getTextAnalyzer();
  const imageAnalyzer = getImageAnalyzer();

  // 1. Fetch listings
  const listingConditions = [eq(listings.storeId, storeId)];
  if (targetListingId) {
    listingConditions.push(eq(listings.id, targetListingId));
  }

  const allListings = await db
    .select()
    .from(listings)
    .where(and(...listingConditions));

  let totalProcessedReviews = 0;
  let totalProcessedReturns = 0;
  let totalAnalyzedIssues = 0;
  const flaggedSkus: RunListingPipelineResult['flaggedSkus'] = [];

  for (const item of allListings) {
    // 2. Fetch existing reviews & return reasons for listing
    const listingReviews = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.storeId, storeId), eq(reviews.listingId, item.id)));

    const listingReturns = await db
      .select()
      .from(returnReasons)
      .where(and(eq(returnReasons.storeId, storeId), eq(returnReasons.listingId, item.id)));

    // 3. Check existing analysis records for idempotence caching
    const existingAnalysis = await db
      .select()
      .from(reviewAnalysis)
      .where(and(eq(reviewAnalysis.storeId, storeId), eq(reviewAnalysis.listingId, item.id)));

    const analysisByHash = new Map<string, typeof existingAnalysis[0]>();
    for (const ea of existingAnalysis) {
      analysisByHash.set(ea.textHash, ea);
    }

    const analyzedItems: AnalyzedFeedbackItem[] = [];

    // Analyze reviews
    for (const r of listingReviews) {
      totalProcessedReviews++;
      const cached = analysisByHash.get(r.textHash);
      if (cached) {
        analyzedItems.push({
          id: r.id,
          rating: r.rating,
          sentiment: cached.sentiment as any,
          causeLabel: cached.causeLabel as any,
          confidence: Number(cached.confidence),
          date: r.reviewDate,
          isReturn: false,
        });
      } else {
        const cleanText = sanitizeReviewText(r.reviewText);
        const analysis = await textAnalyzer.analyzeText(cleanText, {
          title: item.title,
          category: item.category,
        });

        const [createdAnalysis] = await db
          .insert(reviewAnalysis)
          .values({
            id: `ra_${r.id}`,
            storeId,
            listingId: item.id,
            reviewId: r.id,
            sourceType: 'review',
            sentiment: analysis.sentiment,
            aspects: analysis.aspects,
            causeLabel: analysis.causeLabel,
            confidence: String(analysis.confidence),
            analyzerType: textAnalyzer.type,
            textHash: r.textHash,
          })
          .returning();

        analysisByHash.set(r.textHash, createdAnalysis);
        analyzedItems.push({
          id: r.id,
          rating: r.rating,
          sentiment: analysis.sentiment,
          causeLabel: analysis.causeLabel,
          confidence: analysis.confidence,
          date: r.reviewDate,
          isReturn: false,
        });
      }
    }

    // Analyze return reasons
    for (const ret of listingReturns) {
      totalProcessedReturns++;
      const cached = analysisByHash.get(ret.textHash);
      const combinedText = `${ret.reportedReason} ${ret.customerComment}`.trim();
      const textHash = computeTextHash(combinedText);

      if (cached) {
        analyzedItems.push({
          id: ret.id,
          rating: 1,
          sentiment: 'negative',
          causeLabel: cached.causeLabel as any,
          confidence: Number(cached.confidence),
          date: ret.reportedAt,
          isReturn: true,
        });
      } else {
        const cleanText = sanitizeReviewText(combinedText);
        const analysis = await textAnalyzer.analyzeText(cleanText, {
          title: item.title,
          category: item.category,
        });

        const [createdAnalysis] = await db
          .insert(reviewAnalysis)
          .values({
            id: `ra_ret_${ret.id}`,
            storeId,
            listingId: item.id,
            returnReasonId: ret.id,
            sourceType: 'return_reason',
            sentiment: 'negative',
            aspects: analysis.aspects,
            causeLabel: analysis.causeLabel,
            confidence: String(analysis.confidence),
            analyzerType: textAnalyzer.type,
            textHash,
          })
          .returning();

        analysisByHash.set(textHash, createdAnalysis);
        analyzedItems.push({
          id: ret.id,
          rating: 1,
          sentiment: 'negative',
          causeLabel: analysis.causeLabel,
          confidence: analysis.confidence,
          date: ret.reportedAt,
          isReturn: true,
        });
      }
    }

    // 4. Image Analysis
    const images = await db
      .select()
      .from(listingImages)
      .where(and(eq(listingImages.storeId, storeId), eq(listingImages.listingId, item.id)));

    const customerPhotos = listingReviews
      .filter((r) => r.hasPhotos)
      .map((r) => ({
        url: ((r.photoUrls as string[]) || [])[0] || '',
        reviewText: r.reviewText,
        reviewRating: r.rating,
      }));

    const imageIssues = await imageAnalyzer.analyzeListingImages({
      listingId: item.id,
      sku: item.sku,
      title: item.title,
      description: item.description,
      category: item.category,
      sizeChartPresent: item.sizeChartPresent,
      images,
      customerPhotos,
    });

    // 5. Calculate listing score
    const scoreResult = calculateListingScore(analyzedItems);

    // 6. Record or update listing issues
    for (const imgIssue of imageIssues) {
      totalAnalyzedIssues++;
      await db
        .insert(listingIssues)
        .values({
          id: `iss_${item.id}_${imgIssue.issueType}`,
          storeId,
          listingId: item.id,
          issueType: imgIssue.issueType,
          severity: imgIssue.severity,
          status: 'open',
          evidenceText: imgIssue.evidenceText,
          confidence: String(imgIssue.confidence),
          suggestedAction: imgIssue.suggestedAction,
          isHumanReviewed: false,
        })
        .onConflictDoNothing();
    }

    // If dominant text issue detected (e.g. colour_mismatch, size_fit)
    if (scoreResult.dominantIssue && scoreResult.eligibleForAlert) {
      totalAnalyzedIssues++;
      const suggestedActions: Record<string, string> = {
        colour_mismatch: 'Reshoot catalog images under neutral 5500K daylight and add natural indoor lighting swatch.',
        size_fit: 'Update size chart with exact chest/waist garment dimensions and recommend sizing up in bullet points.',
        description_mismatch: 'Review material and fabric composition in title and specifications to match actual vendor tag.',
        image_mismatch: 'Replace 3D render/filter enhanced photos with actual production batch photographs.',
      };

      await db
        .insert(listingIssues)
        .values({
          id: `iss_${item.id}_${scoreResult.dominantIssue}`,
          storeId,
          listingId: item.id,
          issueType: scoreResult.dominantIssue,
          severity: scoreResult.accuracyScore < 50 ? 'critical' : 'high',
          status: 'open',
          evidenceText: `High concentration of ${scoreResult.dominantIssue.replace('_', ' ')} returns (${scoreResult.listingCausedReturnCount} orders impacted, estimated loss ₹${scoreResult.estimatedLoss}).`,
          confidence: '0.89',
          suggestedAction:
            suggestedActions[scoreResult.dominantIssue] ||
            'Audit product listing and update copy to align customer expectations.',
          isHumanReviewed: false,
        })
        .onConflictDoNothing();
    }

    // 7. Store Listing Score
    await db
      .insert(listingScores)
      .values({
        id: `score_${item.id}`,
        storeId,
        listingId: item.id,
        accuracyScore: scoreResult.accuracyScore,
        listingCausedReturnCount: scoreResult.listingCausedReturnCount,
        totalReviewsCount: scoreResult.totalReviewsCount,
        totalReturnsCount: scoreResult.totalReturnsCount,
        estimatedLoss: scoreResult.estimatedLoss,
        estimatedSaving: scoreResult.estimatedSaving,
        dominantIssue: scoreResult.dominantIssue,
        riskModifier: scoreResult.riskModifier,
        assumptions: scoreResult.assumptions,
        calculatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [listingScores.id],
        set: {
          accuracyScore: scoreResult.accuracyScore,
          listingCausedReturnCount: scoreResult.listingCausedReturnCount,
          totalReviewsCount: scoreResult.totalReviewsCount,
          totalReturnsCount: scoreResult.totalReturnsCount,
          estimatedLoss: scoreResult.estimatedLoss,
          estimatedSaving: scoreResult.estimatedSaving,
          dominantIssue: scoreResult.dominantIssue,
          riskModifier: scoreResult.riskModifier,
          assumptions: scoreResult.assumptions,
          calculatedAt: new Date(),
        },
      });

    if (scoreResult.eligibleForAlert) {
      flaggedSkus.push({
        sku: item.sku,
        title: item.title,
        accuracyScore: scoreResult.accuracyScore,
        dominantIssue: scoreResult.dominantIssue,
        listingCausedReturns: scoreResult.listingCausedReturnCount,
        estimatedLoss: scoreResult.estimatedLoss,
        estimatedSaving: scoreResult.estimatedSaving,
        riskModifier: scoreResult.riskModifier,
      });
    }
  }

  logger.info(
    {
      storeId,
      processedReviews: totalProcessedReviews,
      scoredListings: allListings.length,
      flaggedSkusCount: flaggedSkus.length,
    },
    'Listing Intelligence Pipeline completed',
  );

  return {
    storeId,
    processedReviews: totalProcessedReviews,
    processedReturns: totalProcessedReturns,
    analyzedIssues: totalAnalyzedIssues,
    scoredListings: allListings.length,
    flaggedSkus,
  };
}
