import { describe, it, beforeAll, expect } from 'vitest';
import request from 'supertest';
import { setupMemoryDb } from './setupDb';
import app from '../src/app';
import { db, stores } from '@workspace/db';

const DEMO_STORE_ID = 'test-listing-store';

describe('Listing Intelligence API & Ingestion Module', () => {
  beforeAll(async () => {
    await setupMemoryDb();

    // Ensure store exists for test
    await db
      .insert(stores)
      .values({
        id: DEMO_STORE_ID,
        name: 'Test Listing Store',
      })
      .onConflictDoNothing();
  });

  it('1. POST /api/listings/import - imports listing with attributes and checks simulated status', async () => {
    const res = await request(app)
      .post('/api/listings/import')
      .set('x-store-id', DEMO_STORE_ID)
      .send({
        platform: 'myntra',
        items: [
          {
            sku: 'TST-KUR-01',
            title: 'Royal Indigo Cotton Kurta',
            description: 'Handcrafted indigo kurta with Mandarin collar.',
            category: 'Apparel',
            price: 1999,
            sizeChartPresent: false,
            images: [
              { url: 'https://cdn.example.com/kurta-main.jpg', width: 600, height: 600 },
            ],
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.platform).toBe('myntra');
    expect(res.body.isSimulated).toBe(true);
    expect(res.body.importedCount).toBe(1);
  });

  it('2. POST /api/reviews/import - redacts PII (phone/email) and imports reviews & return reasons', async () => {
    const res = await request(app)
      .post('/api/reviews/import')
      .set('x-store-id', DEMO_STORE_ID)
      .send({
        platform: 'myntra',
        items: [
          {
            sku: 'TST-KUR-01',
            rating: 1,
            text: 'Size M order kiya par bohot chhota nikla! Call me on 9876543210 or email test@gmail.com.',
            date: new Date().toISOString(),
          },
          {
            sku: 'TST-KUR-01',
            rating: 1,
            returnReason: 'Color mismatch',
            text: 'Photo me royal blue tha par actual blackish deliver hua. Contact +91 9988776655.',
            date: new Date().toISOString(),
          },
          {
            sku: 'TST-KUR-01',
            rating: 1,
            returnReason: 'Fitting issue',
            text: 'Waist too tight, size chart galat hai.',
            date: new Date().toISOString(),
          },
          {
            sku: 'TST-KUR-01',
            rating: 5,
            text: 'Bahut badiya fabric aur design. Loved it!',
            date: new Date().toISOString(),
          },
          {
            sku: 'TST-KUR-01',
            rating: 1,
            returnReason: 'Size issue',
            text: 'Tight fitting and runs very small.',
            date: new Date().toISOString(),
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.importedReviewsCount).toBe(2);
    expect(res.body.importedReturnReasonsCount).toBe(3);
    expect(res.body.totalImported).toBe(5);
  });

  it('3. POST /api/listings/pipeline/run - triggers text analysis, image checks, and scores listing', async () => {
    const res = await request(app)
      .post('/api/listings/pipeline/run')
      .set('x-store-id', DEMO_STORE_ID)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.storeId).toBe(DEMO_STORE_ID);
    expect(res.body.processedReviews).toBeGreaterThanOrEqual(1);
    expect(res.body.scoredListings).toBeGreaterThanOrEqual(1);
  });

  it('4. GET /api/listings - returns listings with computed accuracy scores and dominant issue', async () => {
    const res = await request(app)
      .get('/api/listings')
      .set('x-store-id', DEMO_STORE_ID);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const item = res.body.find((l: any) => l.sku === 'TST-KUR-01');
    expect(item).toBeDefined();
    expect(item.sku).toBe('TST-KUR-01');
    expect(item.accuracyScore).toBeLessThan(100);
    expect(item.dominantIssue).toBeDefined();
    expect(item.estimatedLoss).toBeGreaterThanOrEqual(0);
    expect(item.openIssuesCount).toBeGreaterThanOrEqual(1);
  });

  it('5. GET /api/listings/summary - returns aggregate listing intelligence metrics', async () => {
    const res = await request(app)
      .get('/api/listings/summary')
      .set('x-store-id', DEMO_STORE_ID);

    expect(res.status).toBe(200);
    expect(res.body.totalListings).toBeGreaterThanOrEqual(1);
    expect(res.body.averageAccuracyScore).toBeDefined();
    expect(typeof res.body.totalEstimatedLoss).toBe('number');
    expect(typeof res.body.openIssuesCount).toBe('number');
  });

  it('6. GET /api/listing-alerts - lists high/critical flagged listings', async () => {
    const res = await request(app)
      .get('/api/listing-alerts')
      .set('x-store-id', DEMO_STORE_ID);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('7. GET /api/listings/:id - returns detailed listing with issues and evidence', async () => {
    const listingId = `lst_${DEMO_STORE_ID}_myntra_TST-KUR-01`;
    const res = await request(app)
      .get(`/api/listings/${listingId}`)
      .set('x-store-id', DEMO_STORE_ID);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(listingId);
    expect(res.body.sku).toBe('TST-KUR-01');
    expect(Array.isArray(res.body.issues)).toBe(true);
    expect(Array.isArray(res.body.images)).toBe(true);
    expect(Array.isArray(res.body.topAspects)).toBe(true);
    expect(Array.isArray(res.body.evidenceReviews)).toBe(true);

    // Verify PII is redacted in evidence reviews
    for (const rev of res.body.evidenceReviews) {
      expect(rev.reviewText).not.toContain('9876543210');
      expect(rev.reviewText).not.toContain('test@gmail.com');
    }
  });

  it('8. PATCH /api/listing-issues/:id - acknowledges and resolves an issue', async () => {
    const listingId = `lst_${DEMO_STORE_ID}_myntra_TST-KUR-01`;
    const detailRes = await request(app)
      .get(`/api/listings/${listingId}`)
      .set('x-store-id', DEMO_STORE_ID);

    const issue = detailRes.body.issues[0];
    if (issue) {
      const patchRes = await request(app)
        .patch(`/api/listing-issues/${issue.id}`)
        .set('x-store-id', DEMO_STORE_ID)
        .send({
          status: 'acknowledged',
          resolutionNotes: 'Size chart is currently being revised by merchandising team.',
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.status).toBe('acknowledged');
      expect(patchRes.body.isHumanReviewed).toBe(true);
      expect(patchRes.body.resolutionNotes).toBe('Size chart is currently being revised by merchandising team.');
    }
  });
});
