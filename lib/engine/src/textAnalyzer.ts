import type { CauseLabel } from './types';

export interface AspectPolarity {
  aspect: string;
  polarity: 'positive' | 'negative' | 'neutral';
}

export interface TextAnalysisResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  aspects: AspectPolarity[];
  causeLabel: CauseLabel;
  confidence: number;
  evidenceKeywords?: string[];
}

export interface TextAnalyzer {
  readonly type: 'lexicon' | 'llm';
  analyzeText(text: string, context?: { title?: string; category?: string }): Promise<TextAnalysisResult>;
  analyzeBatch(
    items: Array<{ id: string; text: string; context?: { title?: string; category?: string } }>,
  ): Promise<Map<string, TextAnalysisResult>>;
}

export interface LexiconRule {
  causeLabel: CauseLabel;
  aspect: string;
  weight: number;
  patterns: RegExp[];
}

// Rules including English and Hinglish expressions
export const LEXICON_RULES: LexiconRule[] = [
  // 1. size_fit
  {
    causeLabel: 'size_fit',
    aspect: 'size_and_fit',
    weight: 1.2,
    patterns: [
      /\b(size|sizing|fit|fitting|tight|loose|chhota|chota|bada|fitting issue|size issue|sleeves too long|too tight|too loose|waist tight|size small|size large|runs small|runs large|over sized|oversized|tight fitting|size chart galat|size nahi aaya|size not matching|length kam|bust tight)\b/i,
      /\b(xl|xxl|medium|small|l|xs)\s+(nahi|galat|wrong|fitting|tight|loose)\b/i,
      /\b(size chart|measurement|shoulder tight|chest tight)\b/i,
    ],
  },
  // 2. colour_mismatch
  {
    causeLabel: 'colour_mismatch',
    aspect: 'colour',
    weight: 1.2,
    patterns: [
      /\b(color|colour|rang|shade|faded|dull|colour mismatch|color mismatch|different color|alag colour|dusra rang|photo me alag|photo mai alag|looks blue but is black|darker than picture|lighter than picture|colour faded|dull color|color fade|not same color|bilkul alag color|actual color different)\b/i,
      /\b(bright in photo|light in photo|rang udd gaya|colour is dull|color is bright)\b/i,
    ],
  },
  // 3. description_mismatch
  {
    causeLabel: 'description_mismatch',
    aspect: 'description',
    weight: 1.1,
    patterns: [
      /\b(description|material|fabric|cloth|cotton bolke|polyester nikla|bolke synthetic|pure cotton nahi|specs wrong|wrong specifications|specification mismatch|not as described|details incorrect|features missing|description says|claimed cotton|jhooth likha|galat details|misleading description|title wrong)\b/i,
      /\b(not pure cotton|different material|kapda alag|description galat|not match details)\b/i,
    ],
  },
  // 4. image_mismatch
  {
    causeLabel: 'image_mismatch',
    aspect: 'images',
    weight: 1.1,
    patterns: [
      /\b(image|picture|photo|looks different in photo|dikhta alag hai|photo me kuch aur|not like picture|model photo misleading|picture doesn't match|photo se alag|different from picture|photo me acha dikha|misleading photo)\b/i,
    ],
  },
  // 5. quality
  {
    causeLabel: 'quality',
    aspect: 'quality',
    weight: 1.0,
    patterns: [
      /\b(quality|cheap|ghatiya|bekar|poor quality|third class|substandard|rough fabric|stitching open|thread coming out|torn stitching|low quality|kharab kapda|local quality|bakwas quality|worthless)\b/i,
      /\b(stitching poor|stitching kharab|cloth quality poor|cheap material)\b/i,
    ],
  },
  // 6. damaged
  {
    causeLabel: 'damaged',
    aspect: 'item_condition',
    weight: 1.3,
    patterns: [
      /\b(damaged|broken|toota|fata|torn|cut|hole|stain|chhed|leak|leaking|stained|seal open|used item|second hand|defective|damaged piece|box torn|fata hua|toota hua)\b/i,
    ],
  },
  // 7. delivery
  {
    causeLabel: 'delivery',
    aspect: 'delivery',
    weight: 1.0,
    patterns: [
      /\b(late delivery|courier|delivery delayed|late aaya|late deliver|slow delivery|delivery boy|behaviour bad|late aane ke karan|delivery time)\b/i,
    ],
  },
  // 8. expectation_gap
  {
    causeLabel: 'expectation_gap',
    aspect: 'product_expectation',
    weight: 0.9,
    patterns: [
      /\b(expected|umeed|expectation|not as expected|disappointed|socha tha kuch aur|umeed se kam|did not meet expectations|average product|theek thaak|kuch khaas nahi|underwhelming)\b/i,
    ],
  },
  // 9. price
  {
    causeLabel: 'price',
    aspect: 'price_value',
    weight: 0.9,
    patterns: [
      /\b(price|mehenga|expensive|costly|not worth the price|overpriced|paisa barbad|paise zyada|loot|value for money nahi|too expensive|price high)\b/i,
    ],
  },
];

export const POSITIVE_PATTERNS: RegExp[] = [
  /\b(good|great|awesome|excellent|perfect|love|loved|sundar|badhiya|shandar|mast|superb|best|worth it|satisfied|amazing|nice|fits perfectly|true to size|same as picture)\b/i,
  /\b(khubsurat|paisa vasool|zabardast|very nice|perfect fit|bahut accha|bahut badiya)\b/i,
];

export class LexiconAnalyzer implements TextAnalyzer {
  readonly type = 'lexicon' as const;

  async analyzeText(text: string, context?: { title?: string; category?: string }): Promise<TextAnalysisResult> {
    const cleanText = text.trim();
    if (!cleanText) {
      return {
        sentiment: 'neutral',
        aspects: [],
        causeLabel: 'other',
        confidence: 0.5,
      };
    }

    // Check positive expressions
    const hasPositive = POSITIVE_PATTERNS.some((p) => p.test(cleanText));
    const scoredRules: Array<{ rule: LexiconRule; score: number; matches: string[] }> = [];

    for (const rule of LEXICON_RULES) {
      let score = 0;
      const matchedStrings: string[] = [];
      for (const pattern of rule.patterns) {
        const match = cleanText.match(pattern);
        if (match) {
          score += rule.weight;
          matchedStrings.push(match[0]);
        }
      }
      if (score > 0) {
        scoredRules.push({ rule, score, matches: matchedStrings });
      }
    }

    // If no negative issue rules match
    if (scoredRules.length === 0) {
      if (hasPositive) {
        return {
          sentiment: 'positive',
          aspects: [{ aspect: 'general', polarity: 'positive' }],
          causeLabel: 'other',
          confidence: 0.85,
        };
      }
      return {
        sentiment: 'neutral',
        aspects: [{ aspect: 'general', polarity: 'neutral' }],
        causeLabel: 'other',
        confidence: 0.5,
      };
    }

    // Sort by highest matching score
    scoredRules.sort((a, b) => b.score - a.score);
    const top = scoredRules[0];

    const aspects: AspectPolarity[] = scoredRules.map((sr) => ({
      aspect: sr.rule.aspect,
      polarity: 'negative',
    }));

    if (hasPositive) {
      aspects.push({ aspect: 'general', polarity: 'positive' });
    }

    // Calculate confidence based on score strength
    const confidence = Math.min(0.95, Math.max(0.65, 0.6 + top.score * 0.15));

    return {
      sentiment: 'negative',
      aspects,
      causeLabel: top.rule.causeLabel,
      confidence: Number(confidence.toFixed(2)),
      evidenceKeywords: top.matches,
    };
  }

  async analyzeBatch(
    items: Array<{ id: string; text: string; context?: { title?: string; category?: string } }>,
  ): Promise<Map<string, TextAnalysisResult>> {
    const results = new Map<string, TextAnalysisResult>();
    for (const item of items) {
      const res = await this.analyzeText(item.text, item.context);
      results.set(item.id, res);
    }
    return results;
  }
}
