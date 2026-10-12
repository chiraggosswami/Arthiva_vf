import {
  type CauseLabel,
  type TextAnalyzer,
  type TextAnalysisResult,
  LexiconAnalyzer,
} from '@workspace/engine';
import { logger } from '../logger';

export interface LlmConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxRequestsPerMinute?: number;
  maxDailyCostUsd?: number;
}

export class LlmAnalyzer implements TextAnalyzer {
  readonly type = 'llm' as const;
  private fallback: LexiconAnalyzer;
  private config: LlmConfig;
  private requestCountLastMinute = 0;
  private minuteWindowStart = Date.now();
  private totalCostUsd = 0;

  constructor(config: LlmConfig = {}) {
    this.fallback = new LexiconAnalyzer();
    this.config = {
      apiKey: config.apiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY,
      baseUrl: config.baseUrl,
      model: config.model || 'gemini-1.5-flash',
      maxRequestsPerMinute: config.maxRequestsPerMinute || 60,
      maxDailyCostUsd: config.maxDailyCostUsd || 5.0,
    };
  }

  private checkRateAndCost(): boolean {
    const now = Date.now();
    if (now - this.minuteWindowStart > 60000) {
      this.minuteWindowStart = now;
      this.requestCountLastMinute = 0;
    }

    if (this.requestCountLastMinute >= (this.config.maxRequestsPerMinute || 60)) {
      logger.warn('LlmAnalyzer: Rate limit hit, falling back to LexiconAnalyzer');
      return false;
    }

    if (this.totalCostUsd >= (this.config.maxDailyCostUsd || 5.0)) {
      logger.warn('LlmAnalyzer: Daily cost cap reached, falling back to LexiconAnalyzer');
      return false;
    }

    return true;
  }

  async analyzeText(
    text: string,
    context?: { title?: string; category?: string },
  ): Promise<TextAnalysisResult> {
    // If no API key or rate/cost cap exceeded, gracefully fall back to LexiconAnalyzer
    if (!this.config.apiKey || !this.checkRateAndCost()) {
      return this.fallback.analyzeText(text, context);
    }

    try {
      this.requestCountLastMinute++;
      this.totalCostUsd += 0.0001; // Mock token cost tracking

      // Structured prompt for strict JSON schema output
      const prompt = `Analyze this Indian D2C customer review or return reason for product listing accuracy.
Available Cause Labels: [size_fit, colour_mismatch, description_mismatch, image_mismatch, quality, damaged, delivery, expectation_gap, price, other].
Return strict JSON with this exact schema:
{
  "sentiment": "positive" | "negative" | "neutral",
  "aspects": [{"aspect": string, "polarity": "positive" | "negative" | "neutral"}],
  "cause_label": string,
  "confidence": number
}

Context:
Title: ${context?.title || 'Unknown'}
Category: ${context?.category || 'Apparel'}

Text:
"${text}"`;

      // If calling real Gemini endpoint when configured
      if (process.env.GEMINI_API_KEY) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': String(this.config.apiKey || process.env.GEMINI_API_KEY),
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        });

        if (resp.ok) {
          const data = (await resp.json()) as any;
          const rawOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawOutput) {
            const parsed = JSON.parse(rawOutput);
            return {
              sentiment: parsed.sentiment || 'neutral',
              aspects: parsed.aspects || [],
              causeLabel: (parsed.cause_label as CauseLabel) || 'other',
              confidence: Number(parsed.confidence) || 0.88,
            };
          }
        }
      }

      // If simulated or direct fallback in test/mock environment
      return this.fallback.analyzeText(text, context);
    } catch (err: any) {
      logger.warn({ err: err.message }, 'LlmAnalyzer failed; falling back to LexiconAnalyzer');
      return this.fallback.analyzeText(text, context);
    }
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

/**
 * Resolves active TextAnalyzer based on TEXT_ANALYZER env flag ('llm' | 'lexicon')
 */
export function getTextAnalyzer(): TextAnalyzer {
  const mode = process.env.TEXT_ANALYZER?.toLowerCase();
  if (mode === 'llm') {
    return new LlmAnalyzer();
  }
  return new LexiconAnalyzer();
}
