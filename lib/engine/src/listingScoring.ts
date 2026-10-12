import type {
  CauseLabel,
  ListingScoringAssumptions,
  ListingScoreResult,
  EngineConfig,
} from './types';

export const DEFAULT_LISTING_SCORING_ASSUMPTIONS: ListingScoringAssumptions = {
  minReviewVolume: 5,
  recencyHalfLifeDays: 60,
  forwardShippingCost: 80,
  reverseShippingCost: 95,
  packagingDamageCost: 50,
  fixEffectivenessMin: 0.35,
  fixEffectivenessMax: 0.65,
  avgReturnRateEstimate: 0.18,
};

// Cause labels directly attributed to listing defect (misleading info, wrong photo, size chart missing/wrong)
export const LISTING_CAUSED_LABELS = new Set<CauseLabel>([
  'size_fit',
  'colour_mismatch',
  'description_mismatch',
  'image_mismatch',
]);

export interface AnalyzedFeedbackItem {
  id?: string;
  rating?: number;
  sentiment?: 'positive' | 'negative' | 'neutral';
  causeLabel: CauseLabel;
  confidence?: number;
  date?: string | Date;
  isReturn?: boolean;
}

/**
 * Computes listing accuracy score (0-100), listing-caused return count,
 * estimated_loss, estimated_saving, and risk modifier.
 *
 * Rules:
 * 1. Requires minimum review volume (default: 5) before raising an alert or aggressive penalization.
 * 2. Recency weighting: reviews decay exponentially based on age: w = 0.5 ^ (ageDays / halfLifeDays).
 * 3. Accuracy score: baseline 100, penalized by weighted listing-caused complaint ratio.
 * 4. Estimated loss: listing-caused returns * (forwardShipping + reverseShipping + packagingDamage).
 * 5. Estimated saving: estimated loss * mean(fixEffectivenessMin, fixEffectivenessMax).
 * 6. Risk modifier: -15 (severe listing issues) to +5 (pristine listing).
 */
export function calculateListingScore(
  feedbackItems: AnalyzedFeedbackItem[],
  customAssumptions: Partial<ListingScoringAssumptions> = {},
  now: Date = new Date(),
): ListingScoreResult {
  const assumptions: ListingScoringAssumptions = {
    ...DEFAULT_LISTING_SCORING_ASSUMPTIONS,
    ...customAssumptions,
  };

  const totalReviewsCount = feedbackItems.filter((f) => !f.isReturn).length;
  const totalReturnsCount = feedbackItems.filter((f) => f.isReturn).length;
  const totalFeedback = feedbackItems.length;

  if (totalFeedback === 0) {
    return {
      accuracyScore: 100,
      listingCausedReturnCount: 0,
      totalReviewsCount: 0,
      totalReturnsCount: 0,
      estimatedLoss: 0,
      estimatedSaving: 0,
      dominantIssue: null,
      riskModifier: 0,
      eligibleForAlert: false,
      assumptions,
    };
  }

  // Calculate recency weights and category aggregates
  let totalWeightedReviews = 0;
  let listingCausedWeightedComplaints = 0;
  let listingCausedRawCount = 0;
  const issueCounts: Record<CauseLabel, { raw: number; weighted: number }> = {
    size_fit: { raw: 0, weighted: 0 },
    colour_mismatch: { raw: 0, weighted: 0 },
    description_mismatch: { raw: 0, weighted: 0 },
    image_mismatch: { raw: 0, weighted: 0 },
    quality: { raw: 0, weighted: 0 },
    damaged: { raw: 0, weighted: 0 },
    delivery: { raw: 0, weighted: 0 },
    expectation_gap: { raw: 0, weighted: 0 },
    price: { raw: 0, weighted: 0 },
    other: { raw: 0, weighted: 0 },
  };

  for (const item of feedbackItems) {
    const itemDate = item.date ? new Date(item.date) : now;
    const diffDays = Math.max(0, (now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
    // Exponential half-life decay
    const weight = Math.pow(0.5, diffDays / assumptions.recencyHalfLifeDays);

    totalWeightedReviews += weight;

    const label = item.causeLabel || 'other';
    const isNegative =
      item.isReturn ||
      item.sentiment === 'negative' ||
      (item.rating !== undefined && item.rating <= 3);

    if (issueCounts[label]) {
      issueCounts[label].raw += 1;
      issueCounts[label].weighted += weight;
    }

    if (isNegative && LISTING_CAUSED_LABELS.has(label)) {
      listingCausedRawCount += 1;
      listingCausedWeightedComplaints += weight;
    }
  }

  const volumeEligible = totalFeedback >= assumptions.minReviewVolume;

  // Determine dominant listing defect
  let dominantIssue: CauseLabel | null = null;
  let maxDefectWeighted = 0;
  for (const label of Array.from(LISTING_CAUSED_LABELS)) {
    if (issueCounts[label].weighted > maxDefectWeighted && issueCounts[label].raw >= 2) {
      maxDefectWeighted = issueCounts[label].weighted;
      dominantIssue = label;
    }
  }

  // Calculate listing defect ratio (0.0 to 1.0)
  const defectRatio = totalWeightedReviews > 0
    ? listingCausedWeightedComplaints / totalWeightedReviews
    : 0;

  // Accuracy score calculation:
  // Starts at 100. Scaled penalty up to 70 points based on defect ratio.
  // Minor penalty if volume is low to avoid false confidence.
  let rawScore = 100 - defectRatio * 85;
  if (!volumeEligible) {
    // Dampen extremes toward 85 if not enough volume
    rawScore = 85 - defectRatio * 40;
  }
  const accuracyScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  // Return cost per reverse shipment
  const costPerReturn =
    assumptions.forwardShippingCost +
    assumptions.reverseShippingCost +
    assumptions.packagingDamageCost;

  // Estimated loss from listing defects
  // Either direct listing-caused returns or estimated from return frequency
  const estimatedReturns = Math.max(
    listingCausedRawCount,
    Math.round(totalReturnsCount * Math.min(1, defectRatio * 1.5)),
  );
  const estimatedLoss = estimatedReturns * costPerReturn;

  // Estimated savings with listing fix (mean effectiveness)
  const meanEffectiveness =
    (assumptions.fixEffectivenessMin + assumptions.fixEffectivenessMax) / 2;
  const estimatedSaving = Math.round(estimatedLoss * meanEffectiveness);

  // Risk modifier for order scoring:
  // Accuracy score >= 85: +2 to +5 points (low listing risk bonus)
  // Accuracy score 70 - 84: 0 points (neutral)
  // Accuracy score 50 - 69: -5 to -8 points (moderate risk)
  // Accuracy score < 50: -10 to -15 points (high risk penalty)
  let riskModifier = 0;
  if (volumeEligible) {
    if (accuracyScore >= 90) {
      riskModifier = 4;
    } else if (accuracyScore >= 80) {
      riskModifier = 2;
    } else if (accuracyScore >= 70) {
      riskModifier = 0;
    } else if (accuracyScore >= 55) {
      riskModifier = -6;
    } else if (accuracyScore >= 40) {
      riskModifier = -10;
    } else {
      riskModifier = -15;
    }
  }

  const eligibleForAlert = volumeEligible && accuracyScore < 70 && listingCausedRawCount >= 3;

  return {
    accuracyScore,
    listingCausedReturnCount: estimatedReturns,
    totalReviewsCount,
    totalReturnsCount,
    estimatedLoss,
    estimatedSaving,
    dominantIssue,
    riskModifier,
    eligibleForAlert,
    assumptions,
  };
}

/**
 * Checks if the store policy has listing risk modifier enabled and returns the modifier.
 */
export function resolveListingRiskModifier(
  listingScoreResult: ListingScoreResult | null | undefined,
  config: EngineConfig,
): number {
  if (!listingScoreResult) return 0;

  // Check policy switch:
  // 1. config.enableListingRiskModifier === true OR
  // 2. An EnginePolicy of type 'listing_risk' with action 'apply-modifier'
  const isPolicyEnabled =
    config.enableListingRiskModifier === true ||
    config.policies.some(
      (p) => p.type === 'listing_risk' && p.action === 'apply-modifier',
    );

  const isExplicitlyDisabled = config.policies.some(
    (p) => p.type === 'listing_risk' && p.action === 'ignore',
  );

  if (!isPolicyEnabled || isExplicitlyDisabled) {
    return 0;
  }

  return listingScoreResult.riskModifier;
}
