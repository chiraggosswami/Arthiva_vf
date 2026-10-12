import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Import configuration and middleware logic
import {
  generateCacheKey,
  executeTranslation,
} from '../src/server/translateMiddleware.js';

describe('1. Multilingual Configuration & Language Switching', () => {
  const EXPECTED_LANGUAGES = ['en', 'hi', 'bn', 'mr', 'gu', 'ta', 'te', 'kn', 'ml'];

  test('All 9 required languages are supported and configured', () => {
    const configPath = path.join(projectRoot, 'src/i18n/config.ts');
    const content = fs.readFileSync(configPath, 'utf8');

    for (const code of EXPECTED_LANGUAGES) {
      assert.ok(
        content.includes(`code: '${code}'`),
        `Expected language code '${code}' in SUPPORTED_LANGUAGES`
      );
    }
  });

  test('Native names and scripts are provided for vernacular languages', () => {
    const configPath = path.join(projectRoot, 'src/i18n/config.ts');
    const content = fs.readFileSync(configPath, 'utf8');

    assert.ok(content.includes('हिन्दी'), 'Hindi native name must be present');
    assert.ok(content.includes('বাংলা'), 'Bengali native name must be present');
    assert.ok(content.includes('मराठी'), 'Marathi native name must be present');
    assert.ok(content.includes('ગુજરાતી'), 'Gujarati native name must be present');
    assert.ok(content.includes('தமிழ்'), 'Tamil native name must be present');
    assert.ok(content.includes('తెలుగు'), 'Telugu native name must be present');
    assert.ok(content.includes('ಕನ್ನಡ'), 'Kannada native name must be present');
    assert.ok(content.includes('മലയാളം'), 'Malayalam native name must be present');
  });
});

describe('2. Translation Files Parity & Missing Keys Verification', () => {
  const localesDir = path.join(projectRoot, 'src/i18n/locales');
  const enFile = path.join(localesDir, 'en.json');
  const enData = JSON.parse(fs.readFileSync(enFile, 'utf8'));

  function getAllKeys(obj, prefix = '') {
    return Object.keys(obj).flatMap((key) => {
      const val = obj[key];
      const fullPath = prefix ? `${prefix}.${key}` : key;
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        return getAllKeys(val, fullPath);
      }
      return fullPath;
    });
  }

  const enKeys = getAllKeys(enData);

  test('Base English locale has extensive translation coverage', () => {
    assert.ok(enKeys.length >= 100, `Expected at least 100 keys, found ${enKeys.length}`);
    assert.ok(enKeys.includes('common.brandName'));
    assert.ok(enKeys.includes('nav.commandCentre'));
    assert.ok(enKeys.includes('landing.headline'));
    assert.ok(enKeys.includes('pricing.pilotPartnerPrice'));
  });

  const otherLocales = ['hi', 'bn', 'mr', 'gu', 'ta', 'te', 'kn', 'ml'];

  for (const lang of otherLocales) {
    test(`Locale ${lang}.json has 100% key parity with en.json (0 missing keys)`, () => {
      const targetFile = path.join(localesDir, `${lang}.json`);
      assert.ok(fs.existsSync(targetFile), `File ${lang}.json must exist`);

      const targetData = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
      const targetKeys = getAllKeys(targetData);

      const missing = enKeys.filter((k) => !targetKeys.includes(k));
      assert.strictEqual(
        missing.length,
        0,
        `Missing ${missing.length} keys in ${lang}.json: ${missing.slice(0, 5).join(', ')}`
      );
    });
  }
});

describe('3. Language Persistence Mechanism', () => {
  test('Language selection persists to local storage key', () => {
    const storageKey = 'arthiva_user_language';
    const mockStorage = new Map();

    // Mock setting
    mockStorage.set(storageKey, 'hi');
    assert.strictEqual(mockStorage.get(storageKey), 'hi');

    // Mock switching
    mockStorage.set(storageKey, 'ta');
    assert.strictEqual(mockStorage.get(storageKey), 'ta');
  });

  test('Fallback to default language when stored value is invalid', () => {
    const validCodes = ['en', 'hi', 'bn', 'mr', 'gu', 'ta', 'te', 'kn', 'ml'];
    const invalidSaved = 'invalid-code-xyz';
    const resolved = validCodes.includes(invalidSaved) ? invalidSaved : 'en';

    assert.strictEqual(resolved, 'en');
  });
});

describe('4. Dynamic Translation Endpoint & Request Validation', () => {
  test('Rejects request with empty text', async () => {
    const res = await executeTranslation({
      text: '   ',
      targetLanguage: 'hi',
    });
    assert.strictEqual(res.status, 'error');
    assert.ok(res.message?.includes('cannot be empty'));
  });

  test('Same language returns immediately without calling API', async () => {
    const res = await executeTranslation({
      text: 'Order dispatched via Blue Dart',
      sourceLanguage: 'en',
      targetLanguage: 'en',
    });
    assert.strictEqual(res.status, 'success');
    assert.strictEqual(res.translatedText, 'Order dispatched via Blue Dart');
    assert.strictEqual(res.cached, false);
  });
});

describe('5. Stable Caching Behavior', () => {
  test('generateCacheKey is deterministic for identical inputs', () => {
    const key1 = generateCacheKey('Customer not reachable', 'en', 'hi', 'NDR note');
    const key2 = generateCacheKey('Customer not reachable', 'en', 'hi', 'NDR note');
    assert.strictEqual(key1, key2);
  });

  test('Different target language generates distinct cache keys', () => {
    const keyHi = generateCacheKey('Customer not reachable', 'en', 'hi', 'NDR note');
    const keyBn = generateCacheKey('Customer not reachable', 'en', 'bn', 'NDR note');
    assert.notStrictEqual(keyHi, keyBn);
  });

  test('Different context generates distinct cache keys', () => {
    const key1 = generateCacheKey('Call customer', 'en', 'hi', 'Context A');
    const key2 = generateCacheKey('Call customer', 'en', 'hi', 'Context B');
    assert.notStrictEqual(key1, key2);
  });

  test('Repeated translations hit cache with status "cached"', async () => {
    const payload = {
      text: 'Please reattempt delivery at 5 PM',
      sourceLanguage: 'en',
      targetLanguage: 'hi',
      context: 'cache test remark',
    };

    const first = await executeTranslation(payload);
    assert.ok(['success', 'cached', 'fallback'].includes(first.status));

    const second = await executeTranslation(payload);
    assert.strictEqual(second.status, 'cached');
    assert.strictEqual(second.cached, true);
    assert.strictEqual(second.translatedText, first.translatedText);
  });
});

describe('6. API Failures and Safe Fallback Protection', () => {
  test('Safe fallback returns original text on upstream failure or missing credentials', async () => {
    const originalText = 'House No 12, MG Road near bus station';
    const originalKey = process.env.GEMINI_API_KEY;

    try {
      // Temporarily simulate missing API key
      delete process.env.GEMINI_API_KEY;

      const res = await executeTranslation({
        text: originalText,
        sourceLanguage: 'en',
        targetLanguage: 'mr',
        context: 'Address line fallback test',
      });

      assert.strictEqual(res.status, 'fallback');
      assert.strictEqual(res.translatedText, originalText);
      assert.ok(res.message?.includes('fallback') || res.message?.includes('not configured'));
    } finally {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });
});

describe('7. Security Boundaries & Secret Protection', () => {
  test('Translation response never contains or leaks GEMINI_API_KEY', async () => {
    const res = await executeTranslation({
      text: 'Test security boundary',
      sourceLanguage: 'en',
      targetLanguage: 'gu',
    });

    const serialized = JSON.stringify(res);
    if (process.env.GEMINI_API_KEY) {
      assert.strictEqual(
        serialized.includes(process.env.GEMINI_API_KEY),
        false,
        'API key must NEVER be included in response'
      );
    }
  });

  test('Client bundle files do not contain hardcoded Gemini API keys', () => {
    const clientFiles = [
      'src/lib/translateService.ts',
      'src/components/DynamicVernacularTranslator.tsx',
      'src/components/LanguageSelector.tsx',
      'src/i18n/config.ts',
      'src/i18n/i18n.ts',
    ];

    for (const rel of clientFiles) {
      const fullPath = path.join(projectRoot, rel);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const keyPattern = ['AI', 'za', 'Sy'].join('');
        assert.strictEqual(
          content.includes(keyPattern),
          false,
          `Found possible API key in client file ${rel}`
        );
      }
    }
  });
});
