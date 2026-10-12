import { pool, setTestDb } from '@workspace/db';
import * as schema from '@workspace/db/schema';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from './logger';
import {
  SEED_LISTINGS,
  generateSeedReviewsAndReturns,
  LexiconAnalyzer,
  calculateListingScore,
  type AnalyzedFeedbackItem,
} from '@workspace/engine';

export async function ensureDbReady(): Promise<void> {
  try {
    await pool.query('SELECT 1 FROM listings LIMIT 1');
    logger.info('Connected to PostgreSQL with active listings table.');
  } catch (err: any) {
    logger.warn({ err: err.message }, 'PostgreSQL not reachable or schema missing; initializing PGlite in-memory database with migrations...');

    const client = new PGlite();

    // Look for migrations directory
    const candidates = [
      path.resolve(process.cwd(), 'lib/db/migrations'),
      path.resolve(process.cwd(), '../lib/db/migrations'),
      path.resolve(process.cwd(), '../../lib/db/migrations'),
      path.resolve(__dirname, '../../../../lib/db/migrations'),
    ];

    let migrationsDir = candidates.find((d) => fs.existsSync(d)) || candidates[0];

    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
      for (const file of files) {
        const fullPath = path.join(migrationsDir, file);
        const sqlContent = fs.readFileSync(fullPath, 'utf-8');
        const statements = sqlContent
          .split('--> statement-breakpoint')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        for (const stmt of statements) {
          try {
            await client.exec(stmt);
          } catch (e: any) {
            // Ignore benign duplicate object errors
          }
        }
      }
    }

    pool.query = async (text: any, params?: any) => {
      if (typeof text === 'string') {
        const res = await client.query(text, params);
        return { rows: res.rows, rowCount: res.rows.length };
      }
      const res = await client.query(text.text, text.values);
      return { rows: res.rows, rowCount: res.rows.length };
    };

    pool.connect = async () => {
      return {
        query: pool.query,
        release: () => {},
      } as any;
    };

    const pgliteDrizzle = drizzle(client, { schema });
    setTestDb(pgliteDrizzle, pool);

    logger.info('PGlite initialized. Seeding store and listings...');
    await seedDemoData(pgliteDrizzle);
    logger.info('PGlite database ready with seed data.');
  }
}

async function seedDemoData(db: any) {
  const storeId = 'demo-store';
  const { stores, listings, listingImages, reviews, returnReasons, reviewAnalysis, listingIssues, listingScores } = schema;

  // Insert store
  await db.insert(stores).values({
    id: storeId,
    name: 'Margin Pilot Demo Store',
    currency: 'INR',
  }).onConflictDoNothing();

  const lexicon = new LexiconAnalyzer();
  const { allReviews: feedbackItems } = generateSeedReviewsAndReturns();
  const itemsByListing = new Map<string, AnalyzedFeedbackItem[]>();

  for (const s of SEED_LISTINGS) {
    const listingId = `lst_${storeId}_${s.platform}_${s.sku}`;
    await db.insert(listings).values({
      id: listingId,
      storeId,
      sku: s.sku,
      platform: s.platform,
      title: s.title,
      description: s.description,
      category: s.category,
      price: s.price,
      attributes: s.attributes,
      sizeChartPresent: s.sizeChartPresent,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing();

    for (let idx = 0; idx < s.images.length; idx++) {
      const img = s.images[idx];
      await db.insert(listingImages).values({
        id: `img_${listingId}_${idx}`,
        storeId,
        listingId,
        url: img.url,
        type: img.type,
        resolutionWidth: img.resolutionWidth,
        resolutionHeight: img.resolutionHeight,
        metadata: img.metadata,
        createdAt: new Date(),
      }).onConflictDoNothing();
    }
  }

  for (let i = 0; i < feedbackItems.length; i++) {
    const r = feedbackItems[i];
    const listingId = `lst_${storeId}_${r.platform}_${r.sku}`;
    const date = r.date ? new Date(r.date) : new Date(Date.now() - (i % 60) * 86400000);
    const cleanText = (r.text || '').trim();
    const isReturn = Boolean(r.returnReason);
    const analysis = await lexicon.analyzeText(cleanText);

    if (isReturn) {
      await db.insert(returnReasons).values({
        id: `ret_${storeId}_${i}`,
        storeId,
        listingId,
        sku: r.sku,
        platform: r.platform,
        orderId: `ord_${storeId}_${i}`,
        reportedReason: r.returnReason,
        customerComment: cleanText,
        textHash: `th_ret_${i}`,
        reportedAt: date,
        createdAt: date,
      }).onConflictDoNothing();
    } else {
      await db.insert(reviews).values({
        id: `rev_${storeId}_${i}`,
        storeId,
        listingId,
        sku: r.sku,
        platform: r.platform,
        rating: r.rating,
        reviewText: cleanText,
        hasPhotos: Boolean(r.hasPhotos),
        photoUrls: r.photoUrls || [],
        textHash: `th_rev_${i}`,
        reviewDate: date,
        createdAt: date,
      }).onConflictDoNothing();
    }

    await db.insert(reviewAnalysis).values({
      id: `ana_${storeId}_${i}`,
      storeId,
      listingId,
      reviewId: isReturn ? null : `rev_${storeId}_${i}`,
      returnReasonId: isReturn ? `ret_${storeId}_${i}` : null,
      sourceType: isReturn ? 'return_reason' : 'review',
      sentiment: analysis.sentiment || 'neutral',
      aspects: analysis.aspects || [],
      causeLabel: analysis.causeLabel || 'other',
      confidence: String(analysis.confidence || '0.85'),
      analyzerType: 'lexicon',
      textHash: `th_ana_${i}`,
      createdAt: date,
    }).onConflictDoNothing();

    const current = itemsByListing.get(listingId) || [];
    current.push({
      id: isReturn ? `ret_${storeId}_${i}` : `rev_${storeId}_${i}`,
      rating: r.rating,
      causeLabel: analysis.causeLabel,
      sentiment: analysis.sentiment,
      confidence: analysis.confidence,
      date,
      isReturn,
    });
    itemsByListing.set(listingId, current);
  }

  for (const s of SEED_LISTINGS) {
    const listingId = `lst_${storeId}_${s.platform}_${s.sku}`;
    const items = itemsByListing.get(listingId) || [];

    if (!s.sizeChartPresent && s.category === 'Apparel') {
      await db.insert(listingIssues).values({
        id: `iss_${listingId}_size_chart`,
        storeId,
        listingId,
        issueType: 'missing_size_chart',
        severity: 'high',
        status: 'open',
        evidenceText: 'Listing has no size chart attached for an Apparel product.',
        suggestedAction: 'Upload accurate size chart with bust, waist, and length measurements in cm and inches.',
        isHumanReviewed: false,
        confidence: '0.95',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoNothing();
    }

    for (const img of s.images) {
      if ((img.resolutionWidth && img.resolutionWidth < 800) || (img.resolutionHeight && img.resolutionHeight < 800)) {
        await db.insert(listingIssues).values({
          id: `iss_${listingId}_res_${img.type}`,
          storeId,
          listingId,
          issueType: 'image_resolution_low',
          severity: 'medium',
          status: 'open',
          evidenceText: `Catalog image resolution is ${img.resolutionWidth}x${img.resolutionHeight}px, below the 800px threshold.`,
          suggestedAction: 'Upload high-resolution image (minimum 1200x1200px) with zoom capability.',
          isHumanReviewed: false,
          confidence: '0.90',
          createdAt: new Date(),
          updatedAt: new Date(),
        }).onConflictDoNothing();
      }
    }

    const scoreResult = calculateListingScore(items);

    if (scoreResult.dominantIssue && scoreResult.accuracyScore < 70) {
      await db.insert(listingIssues).values({
        id: `iss_${listingId}_dominant`,
        storeId,
        listingId,
        issueType: scoreResult.dominantIssue === 'colour_mismatch'
          ? 'colour_mismatch'
          : scoreResult.dominantIssue === 'size_fit'
          ? 'size_fit_mismatch'
          : 'description_mismatch',
        severity: scoreResult.accuracyScore < 50 ? 'critical' : 'high',
        status: 'open',
        evidenceText: `Accuracy score ${scoreResult.accuracyScore}/100. High return driver: ${scoreResult.dominantIssue} (${scoreResult.listingCausedReturnCount} listing-caused returns).`,
        suggestedAction: `Revise ${scoreResult.dominantIssue.replace('_', ' ')} details, update swatches or size guide immediately.`,
        isHumanReviewed: false,
        confidence: '0.88',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoNothing();
    }

    await db.insert(listingScores).values({
      id: `score_${listingId}`,
      storeId,
      listingId,
      accuracyScore: scoreResult.accuracyScore,
      dominantIssue: scoreResult.dominantIssue,
      listingCausedReturnCount: scoreResult.listingCausedReturnCount,
      totalReviewsCount: scoreResult.totalReviewsCount,
      totalReturnsCount: scoreResult.totalReturnsCount,
      estimatedLoss: scoreResult.estimatedLoss,
      estimatedSaving: scoreResult.estimatedSaving,
      riskModifier: scoreResult.riskModifier,
      calculatedAt: new Date(),
      createdAt: new Date(),
    }).onConflictDoNothing();
  }
}
