export type Product = {
  id: string;
  name: string;
  price: number;
  cogs: number;
  damageRate: number;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  city: string;
  orders: number;
  rtos: number;
  prepaid: number;
};

export type Pin = {
  code: string;
  city: string;
  state: string;
  rtoRate: number;
  success: number;
};
export type Pincode = Pin;

export type Courier = {
  id: string;
  name: string;
  success: number;
  forward: number;
  reverse: number;
};

export type EventItem = {
  label: string;
  at: string;
};

export type Order = {
  id: string;
  productId: string;
  customerId: string;
  qty: number;
  value: number;
  payment: 'COD' | 'Prepaid' | 'Partial COD';
  address: string;
  addressComplete: boolean;
  addressVerified: boolean;
  otpPassed: boolean;
  campaign: string;
  pincode: string;
  courierId: string;
  status: string;
  journey: string;
  score: number;
  created: string;
  advancePaid: boolean;
  timeline: EventItem[];
  customerName?: string;
  customerPhone?: string;
  ndrReason?: 'Customer unreachable' | 'Address incorrect' | 'Refused / low intent' | 'Rescheduled request' | 'Delayed';
  rescueAction?: string;
  rescueMessage?: string;
  recoveryAction?: string;
  inventoryRoute?: 'Return to warehouse' | 'Restock' | 'Refurbish' | 'Write off';
  recoveredValue?: number;
};

export type Journey = {
  name: string;
  retention: number;
  rtoMult: number;
  cost: number;
  eligible?: boolean;
  discount?: number;
};

export type ScoreThresholds = {
  highRisk: number;
  watch: number;
};

export type EnginePolicy = {
  id: string;
  type: 'pincode' | 'channel' | 'listing_risk';
  value: string;
  action: 'prepaid-only' | 'human-review' | 'apply-modifier' | 'ignore';
};

export type EngineConfig = {
  journeys: Journey[];
  scoreThresholds: ScoreThresholds;
  policies: EnginePolicy[];
  enableListingRiskModifier?: boolean;
};

export type CauseLabel =
  | 'size_fit'
  | 'colour_mismatch'
  | 'description_mismatch'
  | 'image_mismatch'
  | 'quality'
  | 'damaged'
  | 'delivery'
  | 'expectation_gap'
  | 'price'
  | 'other';

export type ReviewInput = {
  id?: string;
  rating: number;
  text: string;
  date?: string | Date;
  hasPhotos?: boolean;
  returnReason?: string;
};

export type ListingScoringAssumptions = {
  minReviewVolume: number; // default 5
  recencyHalfLifeDays: number; // default 60
  forwardShippingCost: number; // default 80
  reverseShippingCost: number; // default 95
  packagingDamageCost: number; // default 50
  fixEffectivenessMin: number; // default 0.35 (35% reduction in listing-caused returns)
  fixEffectivenessMax: number; // default 0.65 (65% reduction)
  avgReturnRateEstimate: number; // default 0.18
};

export type ListingScoreResult = {
  accuracyScore: number; // 0 - 100
  listingCausedReturnCount: number;
  totalReviewsCount: number;
  totalReturnsCount: number;
  estimatedLoss: number;
  estimatedSaving: number;
  dominantIssue: CauseLabel | null;
  riskModifier: number; // -15 to +5
  eligibleForAlert: boolean;
  assumptions: ListingScoringAssumptions;
};

export type ScoreFactor = {
  name: string;
  points: number;
  reason: string;
};

export type ScoreResult = {
  score: number;
  factors: ScoreFactor[];
  pRto: number;
};

export type JourneyResult = Journey & {
  ev: number;
  successMargin: number;
};

export type CourierComparison = {
  courierId: string;
  name: string;
  expectedCost: number;
  expectedNetMargin: number;
  deliveryProbability: number;
  forwardCost: number;
  reverseCost: number;
};

export type CourierRecommendation = {
  recommendedCourierId: string;
  name: string;
  comparison: CourierComparison[];
  reason: string;
};

export type EvaluationResult = ScoreResult & {
  marginSuccess: number;
  rtoLoss: number;
  journeys: JourneyResult[];
  best: JourneyResult;
  explanation: string;
  courierRecommendation?: CourierRecommendation;
};

export type NdrReason =
  | 'Customer unreachable'
  | 'Address incorrect'
  | 'Refused / low intent'
  | 'Rescheduled request'
  | 'Delayed';

export type RescueRecommendation = {
  action: string;
  message: string;
  includesGoodwill: boolean;
};

export type RecoveryAction = {
  name: string;
  probability: number;
  cost: number;
  value: number;
  versusReverse: number;
  reason: string;
};
