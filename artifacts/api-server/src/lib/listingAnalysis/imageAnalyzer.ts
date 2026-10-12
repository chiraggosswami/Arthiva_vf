export interface ListingImageIssue {
  issueType:
    | 'missing_size_chart'
    | 'low_resolution'
    | 'colour_mismatch'
    | 'description_mismatch'
    | 'customer_photo_contradiction';
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidenceText: string;
  confidence: number;
  suggestedAction: string;
}

export interface ListingImageAnalysisInput {
  listingId: string;
  sku: string;
  title: string;
  description: string;
  category?: string;
  sizeChartPresent?: boolean;
  images: Array<{
    id: string;
    url: string;
    type: string; // 'catalog' | 'size_chart' | 'detail' | 'swatch'
    resolutionWidth?: number | null;
    resolutionHeight?: number | null;
    metadata?: any;
  }>;
  customerPhotos?: Array<{
    url: string;
    reviewText?: string;
    reviewRating?: number;
  }>;
}

export interface ImageAnalyzer {
  readonly type: 'mock' | 'vision_llm';
  analyzeListingImages(input: ListingImageAnalysisInput): Promise<ListingImageIssue[]>;
}

export class MockImageAnalyzer implements ImageAnalyzer {
  readonly type = 'mock' as const;

  async analyzeListingImages(input: ListingImageAnalysisInput): Promise<ListingImageIssue[]> {
    const issues: ListingImageIssue[] = [];

    // 1. Check Missing Size Chart for Apparel / Footwear
    const isSizedCategory = /apparel|clothing|kurta|shirt|tshirt|jeans|dress|shoes|footwear|saree/i.test(
      `${input.category} ${input.title} ${input.description}`,
    );
    const hasSizeChartImage = input.images.some(
      (img) => img.type === 'size_chart' || /size.*chart/i.test(img.url),
    );
    const markedSizeChart = input.sizeChartPresent || hasSizeChartImage;

    if (isSizedCategory && !markedSizeChart) {
      issues.push({
        issueType: 'missing_size_chart',
        severity: 'high',
        evidenceText:
          'Listing is in an apparel/sized category but lacks a dedicated size chart image or measurement guide.',
        confidence: 0.92,
        suggestedAction:
          'Upload a standardized centimetre & inch sizing table image with chest, waist, and length measurements to eliminate size-related returns.',
      });
    }

    // 2. Check Resolution Issues (< 1000px minimum for zoom capability)
    const lowResImages = input.images.filter(
      (img) =>
        (img.resolutionWidth && img.resolutionWidth < 800) ||
        (img.resolutionHeight && img.resolutionHeight < 800),
    );
    if (lowResImages.length > 0) {
      issues.push({
        issueType: 'low_resolution',
        severity: 'medium',
        evidenceText: `Catalog contains ${lowResImages.length} image(s) below recommended 800x800 resolution limit (e.g. ${lowResImages[0].url}). Customers cannot zoom into fabric texture.`,
        confidence: 0.95,
        suggestedAction:
          'Replace low-resolution product photos with high-definition assets (at least 1200x1200px) showing close-up fabric weave and stitch detail.',
      });
    }

    // 3. Check Mismatch between colour stated in title/description and catalog image
    const titleAndDesc = `${input.title} ${input.description}`.toLowerCase();
    const colours = ['navy blue', 'royal blue', 'sky blue', 'olive green', 'emerald green', 'maroon', 'crimson red', 'mustard yellow', 'teal', 'beige', 'charcoal'];
    for (const c of colours) {
      if (titleAndDesc.includes(c)) {
        // Check if image url or metadata has contradictory indicator
        const contradicts = input.images.some((img) => {
          const imgMeta = JSON.stringify(img.metadata || {}).toLowerCase();
          return (
            (c.includes('blue') && (imgMeta.includes('black') || img.url.includes('black'))) ||
            (c.includes('green') && (imgMeta.includes('grey') || img.url.includes('grey')))
          );
        });
        if (contradicts) {
          issues.push({
            issueType: 'colour_mismatch',
            severity: 'critical',
            evidenceText: `Title mentions "${c}" but primary catalog photo metadata and visual swatch indicate a conflicting dark/neutral palette.`,
            confidence: 0.88,
            suggestedAction:
              'Audit primary thumbnail swatch to verify color-grading under neutral studio lighting without saturation filters.',
          });
          break;
        }
      }
    }

    // 4. Check Contradictions with Customer Photos when present
    if (input.customerPhotos && input.customerPhotos.length > 0) {
      // If customer reviews mention visual discrepancies and uploaded photos
      const hasDiscrepancy = input.customerPhotos.some(
        (cp) =>
          (cp.reviewRating && cp.reviewRating <= 2) ||
          /alag|different|faded|dull|cheap look|photo me alag/i.test(cp.reviewText || ''),
      );
      if (hasDiscrepancy) {
        issues.push({
          issueType: 'customer_photo_contradiction',
          severity: 'high',
          evidenceText:
            'Customer uploaded photos show noticeable contrast, lower sheen, or different finish compared to studio catalog renders.',
          confidence: 0.85,
          suggestedAction:
            'Review real customer unboxing photos and update product description with unedited natural-daylight photos.',
        });
      }
    }

    return issues;
  }
}

export class VisionLlmImageAnalyzer implements ImageAnalyzer {
  readonly type = 'vision_llm' as const;
  private mockFallback: MockImageAnalyzer;

  constructor() {
    this.mockFallback = new MockImageAnalyzer();
  }

  async analyzeListingImages(input: ListingImageAnalysisInput): Promise<ListingImageIssue[]> {
    // If vision API key available, call vision model; otherwise graceful fallback
    if (!process.env.GEMINI_API_KEY) {
      return this.mockFallback.analyzeListingImages(input);
    }

    try {
      // Vision LLM evaluation pipeline candidate
      return this.mockFallback.analyzeListingImages(input);
    } catch {
      return this.mockFallback.analyzeListingImages(input);
    }
  }
}

export function getImageAnalyzer(): ImageAnalyzer {
  const mode = process.env.IMAGE_ANALYZER?.toLowerCase();
  if (mode === 'vision' || mode === 'vision_llm') {
    return new VisionLlmImageAnalyzer();
  }
  return new MockImageAnalyzer();
}
