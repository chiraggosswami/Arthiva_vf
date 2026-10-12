export interface IngestedListingRow {
  sku: string;
  platform: 'shopify' | 'amazon' | 'myntra' | 'flipkart' | 'woocommerce' | string;
  title: string;
  description?: string;
  category?: string;
  price?: number;
  attributes?: Record<string, any>;
  sizeChartPresent?: boolean;
}

export interface IngestedReviewRow {
  sku: string;
  platform: string;
  rating: number; // 1 to 5
  text: string;
  date?: string;
  hasPhotos?: boolean;
  photoUrls?: string[];
  returnReason?: string;
  orderId?: string;
}

export interface ListingSource {
  readonly platform: string;
  readonly isRealConnector: boolean;
  fetchListings(storeId: string): Promise<IngestedListingRow[]>;
  fetchReviews(storeId: string): Promise<IngestedReviewRow[]>;
}

export class MockSource implements ListingSource {
  readonly platform = 'mock';
  readonly isRealConnector = false;

  constructor(
    private seedListings: IngestedListingRow[] = [],
    private seedReviews: IngestedReviewRow[] = [],
  ) {}

  async fetchListings(): Promise<IngestedListingRow[]> {
    return this.seedListings;
  }

  async fetchReviews(): Promise<IngestedReviewRow[]> {
    return this.seedReviews;
  }
}

export class ShopifyFixtureSource implements ListingSource {
  readonly platform = 'shopify';
  readonly isRealConnector = true;

  constructor(private fixtureListings: IngestedListingRow[] = []) {}

  async fetchListings(): Promise<IngestedListingRow[]> {
    return this.fixtureListings;
  }

  async fetchReviews(): Promise<IngestedReviewRow[]> {
    return [];
  }
}

export class MarketplaceSimulatedSource implements ListingSource {
  readonly isRealConnector = false;

  constructor(readonly platform: 'amazon' | 'myntra' | 'flipkart' | 'woocommerce') {}

  async fetchListings(): Promise<IngestedListingRow[]> {
    return [];
  }

  async fetchReviews(): Promise<IngestedReviewRow[]> {
    return [];
  }
}

/**
 * Factory for listing sources
 */
export function getListingSource(platform: string): ListingSource {
  const norm = platform.toLowerCase();
  if (norm === 'shopify') {
    return new ShopifyFixtureSource();
  }
  if (norm === 'amazon' || norm === 'myntra' || norm === 'flipkart' || norm === 'woocommerce') {
    return new MarketplaceSimulatedSource(norm as any);
  }
  return new MockSource();
}

/**
 * Privacy utility: Strip reviewer names, phone numbers, and email addresses.
 */
export function sanitizeReviewText(rawText: string): string {
  if (!rawText) return '';
  return rawText
    // Remove email addresses
    .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[REDACTED_EMAIL]')
    // Remove Indian & international 10-12 digit phone numbers
    .replace(/(?:\+91[\s-]?)?[6789]\d{9}/g, '[REDACTED_PHONE]')
    // Remove names after "by", "from", "Mr.", "Mrs." if present
    .replace(/\b(?:by|from|reviewer|customer)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g, '[REDACTED_NAME]')
    .trim();
}

/**
 * Fast SHA-256 text hash for idempotent caching
 */
export function computeTextHash(text: string): string {
  // Simple deterministic hash
  let hash = 0;
  const str = text.trim().toLowerCase();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `hash_${Math.abs(hash).toString(16)}_${str.length}`;
}
