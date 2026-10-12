import { describe, it, expect } from 'vitest';
import {
  calculateListingScore,
  resolveListingRiskModifier,
  DEFAULT_LISTING_SCORING_ASSUMPTIONS,
  type AnalyzedFeedbackItem,
} from '../src/listingScoring';
import { scoreOrder } from '../src/scoring';
import type { Order, Product, Pin, Courier, EngineConfig } from '../src/types';

describe('Listing Scoring Math & Risk Modifier', () => {
  const dummyProduct: Product = {
    id: 'SKU-01',
    name: 'Silk Kurta',
    price: 1999,
    cogs: 600,
    damageRate: 0.02,
  };
  const dummyPin: Pin = {
    code: '110001',
    city: 'Delhi',
    state: 'Delhi',
    rtoRate: 0.15,
    success: 0.88,
  };
  const dummyCourier: Courier = {
    id: 'delhivery',
    name: 'Delhivery',
    success: 0.88,
    forward: 80,
    reverse: 90,
  };
  const dummyCustomer = { orders: 3, rtos: 0, prepaid: 2 };
  const dummyOrder: Order = {
    id: 'MP-TEST-1',
    productId: 'SKU-01',
    customerId: 'C01',
    qty: 1,
    value: 1999,
    payment: 'COD',
    address: 'Connaught Place',
    addressComplete: true,
    addressVerified: true,
    otpPassed: false,
    campaign: 'Direct',
    pincode: '110001',
    courierId: 'delhivery',
    status: 'Confirmed',
    journey: 'Full COD',
    score: 65,
    created: '2026-10-10',
    advancePaid: false,
    timeline: [],
  };

  it('evaluates a pristine SKU with 10 positive reviews to 100 accuracy and +4 risk modifier', () => {
    const reviews: AnalyzedFeedbackItem[] = Array.from({ length: 10 }, (_, i) => ({
      rating: 5,
      sentiment: 'positive',
      causeLabel: 'other',
      confidence: 0.95,
      date: new Date(Date.now() - i * 86400000),
      isReturn: false,
    }));

    const result = calculateListingScore(reviews);

    expect(result.accuracyScore).toBe(100);
    expect(result.listingCausedReturnCount).toBe(0);
    expect(result.estimatedLoss).toBe(0);
    expect(result.dominantIssue).toBeNull();
    expect(result.riskModifier).toBe(4);
    expect(result.eligibleForAlert).toBe(false);
  });

  it('dampens scores when below minimum review volume threshold (< 5 reviews)', () => {
    // 2 complaints out of 2 reviews
    const reviews: AnalyzedFeedbackItem[] = [
      { rating: 1, sentiment: 'negative', causeLabel: 'size_fit', isReturn: true },
      { rating: 2, sentiment: 'negative', causeLabel: 'size_fit', isReturn: true },
    ];

    const result = calculateListingScore(reviews);

    // Below volume threshold: shouldn't drop to 0 or raise immediate alert
    expect(result.eligibleForAlert).toBe(false);
    expect(result.riskModifier).toBe(0); // No risk modifier applied when volume is insufficient
  });

  it('penalizes a SKU with high colour-mismatch complaints and computes estimated loss/savings', () => {
    const now = new Date();
    // 20 reviews: 12 colour_mismatch complaints, 8 positive
    const reviews: AnalyzedFeedbackItem[] = [
      ...Array.from({ length: 12 }, () => ({
        rating: 1,
        sentiment: 'negative' as const,
        causeLabel: 'colour_mismatch' as const,
        isReturn: true,
        date: now,
      })),
      ...Array.from({ length: 8 }, () => ({
        rating: 5,
        sentiment: 'positive' as const,
        causeLabel: 'other' as const,
        isReturn: false,
        date: now,
      })),
    ];

    const result = calculateListingScore(reviews, {}, now);

    expect(result.accuracyScore).toBeLessThan(60);
    expect(result.dominantIssue).toBe('colour_mismatch');
    expect(result.listingCausedReturnCount).toBeGreaterThanOrEqual(12);
    // Cost per return = 80 + 95 + 50 = 225
    expect(result.estimatedLoss).toBe(result.listingCausedReturnCount * 225);
    // Mean fix effectiveness = (0.35 + 0.65)/2 = 0.50
    expect(result.estimatedSaving).toBe(Math.round(result.estimatedLoss * 0.5));
    expect(result.riskModifier).toBeLessThanOrEqual(-6);
    expect(result.eligibleForAlert).toBe(true);
  });

  it('applies recency weighting so older complaints carry exponentially less weight', () => {
    const now = new Date();
    // 10 complaints that happened 180 days ago (3 half-lives) vs 10 recent positive reviews
    const oldComplaints: AnalyzedFeedbackItem[] = Array.from({ length: 10 }, () => ({
      rating: 1,
      sentiment: 'negative' as const,
      causeLabel: 'size_fit' as const,
      isReturn: true,
      date: new Date(now.getTime() - 180 * 86400000), // 180 days ago
    }));
    const recentPositive: AnalyzedFeedbackItem[] = Array.from({ length: 10 }, () => ({
      rating: 5,
      sentiment: 'positive' as const,
      causeLabel: 'other' as const,
      isReturn: false,
      date: now,
    }));

    const result = calculateListingScore([...oldComplaints, ...recentPositive], {}, now);

    // Because old complaints decayed by 0.5^3 = 0.125, the recent positive reviews dominate
    expect(result.accuracyScore).toBeGreaterThan(70);
  });

  it('integrates listing risk modifier into order scoring when policy switch is enabled', () => {
    const baseScoreResult = scoreOrder(dummyOrder, dummyCustomer, dummyPin, dummyCourier, dummyProduct);

    // With negative listing modifier (-10)
    const penalizedScoreResult = scoreOrder(
      dummyOrder,
      dummyCustomer,
      dummyPin,
      dummyCourier,
      dummyProduct,
      { riskModifier: -10, dominantIssue: 'size_fit' },
    );

    expect(penalizedScoreResult.score).toBe(baseScoreResult.score - 10);
    const factor = penalizedScoreResult.factors.find((f) => f.name === 'Listing accuracy modifier');
    expect(factor).toBeDefined();
    expect(factor?.points).toBe(-10);

    // Test policy switch resolution
    const configDisabled: EngineConfig = {
      journeys: [],
      scoreThresholds: { highRisk: 45, watch: 70 },
      policies: [],
      enableListingRiskModifier: false,
    };
    expect(resolveListingRiskModifier({ riskModifier: -10 } as any, configDisabled)).toBe(0);

    const configEnabled: EngineConfig = {
      journeys: [],
      scoreThresholds: { highRisk: 45, watch: 70 },
      policies: [],
      enableListingRiskModifier: true,
    };
    expect(resolveListingRiskModifier({ riskModifier: -10 } as any, configEnabled)).toBe(-10);

    const configWithPolicy: EngineConfig = {
      journeys: [],
      scoreThresholds: { highRisk: 45, watch: 70 },
      policies: [{ id: 'pol-1', type: 'listing_risk', value: 'all', action: 'apply-modifier' }],
    };
    expect(resolveListingRiskModifier({ riskModifier: -10 } as any, configWithPolicy)).toBe(-10);
  });
});
