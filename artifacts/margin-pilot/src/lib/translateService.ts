/**
 * Client service to interface with the server-side translation endpoint
 */

export interface TranslateOptions {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
  context?: string;
}

export interface TranslateResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  status: 'success' | 'cached' | 'fallback' | 'error';
  cached: boolean;
  provider?: string;
  message?: string;
}

// Client-side quick memory cache to avoid unnecessary network round-trips for the same session
const clientCache = new Map<string, TranslateResult>();

export async function translateDynamicText(
  options: TranslateOptions
): Promise<TranslateResult> {
  const { text, targetLanguage, sourceLanguage = 'en', context } = options;

  if (!text || !text.trim()) {
    return {
      translatedText: text || '',
      sourceLanguage,
      targetLanguage,
      status: 'success',
      cached: false,
    };
  }

  // Same language doesn't need API call
  if (sourceLanguage === targetLanguage) {
    return {
      translatedText: text,
      sourceLanguage,
      targetLanguage,
      status: 'success',
      cached: false,
    };
  }

  const cacheKey = `${sourceLanguage}:${targetLanguage}:${context || ''}:${text.trim()}`;
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey)!;
  }

  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        targetLanguage,
        sourceLanguage,
        context,
      }),
    });

    if (!response.ok) {
      console.warn(`Translation API HTTP ${response.status}`);
      const fallback: TranslateResult = {
        translatedText: text,
        sourceLanguage,
        targetLanguage,
        status: 'fallback',
        cached: false,
        message: `HTTP ${response.status}`,
      };
      return fallback;
    }

    const data: TranslateResult = await response.json();
    clientCache.set(cacheKey, data);
    return data;
  } catch (err) {
    console.warn('Network error calling /api/translate, falling back to original:', err);
    return {
      translatedText: text,
      sourceLanguage,
      targetLanguage,
      status: 'fallback',
      cached: false,
      message: 'Network error, safe fallback applied.',
    };
  }
}
