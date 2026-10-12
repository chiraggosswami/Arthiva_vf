import type { IncomingMessage, ServerResponse } from 'node:http';
import crypto from 'node:crypto';
import { GoogleGenAI } from '@google/genai';

export interface TranslationRequest {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
  context?: string;
}

export interface TranslationResponse {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  status: 'success' | 'cached' | 'fallback' | 'error';
  cached: boolean;
  provider?: string;
  message?: string;
  timestamp?: number;
}

interface CacheEntry {
  translatedText: string;
  timestamp: number;
}

// In-memory stable cache (keyed by SHA-256 hash of text+src+tgt+context)
const translationCache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 5000;

// Rate limiting map (IP -> timestamps array)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60; // 60 requests per minute

const SUPPORTED_LANGUAGE_CODES = new Set([
  'en', 'hi', 'bn', 'mr', 'gu', 'ta', 'te', 'kn', 'ml'
]);

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  bn: 'Bengali',
  mr: 'Marathi',
  gu: 'Gujarati',
  ta: 'Tamil',
  te: 'Telugu',
  kn: 'Kannada',
  ml: 'Malayalam',
};

/**
 * Generate a deterministic stable cache key
 */
export function generateCacheKey(
  text: string,
  sourceLang: string,
  targetLang: string,
  context?: string
): string {
  const normalized = `${sourceLang.trim().toLowerCase()}:${targetLang.trim().toLowerCase()}:${(context || '').trim().toLowerCase()}:${text.trim()}`;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Helper to check rate limit for a client IP
 */
function isRateLimited(clientIp: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = rateLimitMap.get(clientIp) || [];
  
  // Filter out expired timestamps
  const validTimestamps = timestamps.filter(t => t > windowStart);
  
  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    rateLimitMap.set(clientIp, validTimestamps);
    return true;
  }
  
  validTimestamps.push(now);
  rateLimitMap.set(clientIp, validTimestamps);
  return false;
}

/**
 * Core translation function with Gemini API and fallback
 */
export async function executeTranslation(
  reqPayload: TranslationRequest
): Promise<TranslationResponse> {
  const text = (reqPayload.text || '').trim();
  const sourceLang = reqPayload.sourceLanguage || 'en';
  const targetLang = reqPayload.targetLanguage;
  const context = reqPayload.context || 'Indian D2C ecommerce order & delivery operations';

  if (!text) {
    return {
      translatedText: '',
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      status: 'error',
      cached: false,
      message: 'Text cannot be empty.',
    };
  }

  // Same language shortcut
  if (sourceLang === targetLang) {
    return {
      translatedText: text,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      status: 'success',
      cached: false,
    };
  }

  // 1. Check Cache
  const cacheKey = generateCacheKey(text, sourceLang, targetLang, context);
  if (translationCache.has(cacheKey)) {
    const entry = translationCache.get(cacheKey)!;
    return {
      translatedText: entry.translatedText,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      status: 'cached',
      cached: true,
      timestamp: entry.timestamp,
    };
  }

  // 2. Check for GEMINI_API_KEY
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Safe fallback to original text if API key is not configured
    return {
      translatedText: text,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      status: 'fallback',
      cached: false,
      message: 'Gemini API key not configured on server. Returned original text.',
    };
  }

  // 3. Call Gemini 3.8 Flash
  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const targetLangName = LANGUAGE_NAMES[targetLang] || targetLang;
    const sourceLangName = LANGUAGE_NAMES[sourceLang] || sourceLang;

    const prompt = `You are a professional logistics and vernacular translator for Indian D2C ecommerce.
Translate the following text from ${sourceLangName} (${sourceLang}) to ${targetLangName} (${targetLang}).
Context: ${context}.

STRICT REQUIREMENTS:
1. Provide a natural, culturally appropriate Indian language translation.
2. Preserve exact numbers (e.g. 5, 200, 560001, phone numbers), dates, times, tracking IDs, URLs, and placeholders.
3. Preserve currency symbols and amounts (₹, Rs, INR).
4. DO NOT translate brand names, product titles, courier partner names (e.g., Delhivery, Blue Dart, Shadowfax, Arthiva), or personal names.
5. Return JSON ONLY with the exact format:
{
  "translatedText": "the translated text here"
}

Text to translate:
"""${text}"""`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    let translatedResult = text;
    const rawOutput = response.text ? response.text.trim() : '';

    if (rawOutput) {
      try {
        const parsed = JSON.parse(rawOutput);
        if (parsed.translatedText && typeof parsed.translatedText === 'string') {
          translatedResult = parsed.translatedText.trim();
        }
      } catch {
        // If JSON parsing fails, strip possible outer quotes or markdown fences
        translatedResult = rawOutput
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/, '')
          .replace(/\s*```$/, '')
          .trim();
      }
    }

    // Cache the result
    if (translationCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = translationCache.keys().next().value;
      if (oldestKey) translationCache.delete(oldestKey);
    }
    translationCache.set(cacheKey, {
      translatedText: translatedResult,
      timestamp: Date.now(),
    });

    return {
      translatedText: translatedResult,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      status: 'success',
      cached: false,
      provider: 'gemini-3.8-flash',
    };
  } catch (err: unknown) {
    const safeError = (err instanceof Error ? err.message : String(err)).replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED]');
    console.error('Gemini translation server error:', safeError);
    // Safe graceful fallback
    return {
      translatedText: text,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      status: 'fallback',
      cached: false,
      message: 'Upstream translation error. Safely fell back to original text.',
    };
  }
}

/**
 * Vite & Connect-compatible HTTP middleware
 */
export function createTranslateMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const origin = req.headers.origin as string | undefined;
    const host = req.headers.host as string | undefined;

    // Secure CORS: Disallow wildcard access from arbitrary external origins
    if (origin) {
      const isAllowedOrigin = !origin || origin.includes(host || '') || origin.includes('localhost') || origin.includes('127.0.0.1');
      if (isAllowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method Not Allowed. Use POST.' }));
      return;
    }

    // Rate limiting check
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    if (isRateLimited(clientIp)) {
      res.statusCode = 429;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Too many translation requests. Please wait a minute.',
        status: 'rate_limited',
        retryAfter: 60,
      }));
      return;
    }

    // Buffer incoming body with max payload protection (50KB limit)
    let body = '';
    let bodySize = 0;
    const MAX_BODY_BYTES = 50 * 1024;

    req.on('data', (chunk) => {
      bodySize += chunk.length;
      if (bodySize > MAX_BODY_BYTES) {
        res.statusCode = 413;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Payload too large.' }));
        req.destroy();
        return;
      }
      body += chunk;
    });

    req.on('end', async () => {
      try {
        let payload: TranslationRequest;
        try {
          payload = JSON.parse(body || '{}');
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid JSON request body.' }));
          return;
        }

        // Validate payload
        if (!payload.text || typeof payload.text !== 'string') {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing or invalid "text" field.' }));
          return;
        }

        if (payload.text.length > 2000) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Text exceeds maximum length of 2000 characters.' }));
          return;
        }

        if (!payload.targetLanguage || typeof payload.targetLanguage !== 'string') {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing "targetLanguage" field.' }));
          return;
        }

        if (!SUPPORTED_LANGUAGE_CODES.has(payload.targetLanguage)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: `Unsupported target language code: ${payload.targetLanguage}. Supported codes: ${Array.from(SUPPORTED_LANGUAGE_CODES).join(', ')}`,
          }));
          return;
        }

        const result = await executeTranslation(payload);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      } catch (err: unknown) {
        console.error('Translate handler unhandled error:', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: 'Internal server error processing translation.',
          fallbackText: '',
        }));
      }
    });
  };
}
