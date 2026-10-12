import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Languages, Check, Copy, RefreshCw, Zap, ShieldAlert, ArrowRight } from 'lucide-react';
import { SUPPORTED_LANGUAGES, LanguageOption } from '../i18n/config';
import { translateDynamicText, type TranslateResult } from '../lib/translateService';

interface DynamicVernacularTranslatorProps {
  initialText?: string;
  context?: string;
  onApplyTranslation?: (translatedText: string) => void;
  className?: string;
}

const SAMPLE_REMARKS = [
  'Customer requested delivery after 6:30 PM near the local bus stand.',
  'Customer unavailable. Please reattempt delivery tomorrow morning between 10 AM and 1 PM.',
  'Address correction: House No. 42, 2nd Main Road, opposite Government Hospital.',
  'Customer will pay ₹1,499 via UPI QR at doorstep upon opening the package.',
];

export function DynamicVernacularTranslator({
  initialText = '',
  context = 'Customer NDR delivery exception remark',
  onApplyTranslation,
  className = '',
}: DynamicVernacularTranslatorProps) {
  const { i18n } = useTranslation();
  const [sourceText, setSourceText] = useState(initialText || SAMPLE_REMARKS[0]);
  const [targetLangCode, setTargetLangCode] = useState(
    i18n.language !== 'en' ? i18n.language : 'hi'
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranslateResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);

  const targetLangOption =
    SUPPORTED_LANGUAGES.find((l) => l.code === targetLangCode) ||
    SUPPORTED_LANGUAGES[1]; // default to Hindi

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;
    setLoading(true);
    setCopied(false);
    setApplied(false);
    try {
      const res = await translateDynamicText({
        text: sourceText,
        sourceLanguage: 'en',
        targetLanguage: targetLangCode,
        context,
      });
      setResult(res);
    } catch (err) {
      console.error('Translation failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result?.translatedText) {
      navigator.clipboard.writeText(result.translatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleApply = () => {
    if (result?.translatedText && onApplyTranslation) {
      onApplyTranslation(result.translatedText);
      setApplied(true);
      setTimeout(() => setApplied(false), 2000);
    }
  };

  return (
    <div className={`bg-white rounded-2xl border border-[#dce6e2] shadow-xs overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0e3b43] via-[#154c56] to-[#0e3b43] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Languages size={16} className="text-[#f5a524]" />
          <span className="text-xs font-bold tracking-wide">
            Dynamic Vernacular Translation Assistant
          </span>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/90 border border-white/15 flex items-center gap-1">
          <Sparkles size={11} className="text-[#f5a524]" />
          Gemini 3.8 Flash
        </span>
      </div>

      <div className="p-4 space-y-3.5">
        {/* Sample remark quick chips */}
        <div>
          <div className="text-[10.5px] font-bold text-[#6a807a] uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>Customer Delivery Remark / NDR Note</span>
            <span className="text-[10px] text-[#1f8a5b] font-semibold">Live Logistics NLP</span>
          </div>

          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            rows={2}
            placeholder="Type customer address remarks, delivery reschedule notes, or NDR exceptions..."
            className="w-full bg-[#f8faf9] border border-[#dbe4e0] rounded-xl p-2.5 text-xs text-[#0e3b43] focus:border-[#0e3b43] outline-none transition-colors resize-none"
          />

          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <span className="text-[10px] text-[#718580] self-center mr-1">Try sample:</span>
            {SAMPLE_REMARKS.slice(0, 3).map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSourceText(sample)}
                className="text-[10px] px-2 py-0.5 bg-[#edf3f0] hover:bg-[#e2eae6] text-[#1e4a42] rounded-md transition-colors truncate max-w-[200px]"
                title={sample}
              >
                {sample.slice(0, 28)}...
              </button>
            ))}
          </div>
        </div>

        {/* Target language selector & Translate button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-[#3d524d] shrink-0">
              Target Language:
            </label>
            <select
              value={targetLangCode}
              onChange={(e) => setTargetLangCode(e.target.value)}
              className="bg-[#f8faf9] border border-[#dbe4e0] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#0e3b43] outline-none focus:border-[#0e3b43] cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.filter((l) => l.code !== 'en').map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.nativeName} ({lang.name})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleTranslate}
            disabled={loading || !sourceText.trim()}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#0e3b43] via-[#14533d] to-[#1a625b] hover:from-[#134954] hover:to-[#206f7e] text-white shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Translating via Gemini...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} className="text-[#f5a524]" />
                <span>Translate to {targetLangOption.nativeName}</span>
              </>
            )}
          </button>
        </div>

        {/* Output card */}
        {result && (
          <div className="mt-3 p-3.5 rounded-xl bg-[#f5f9f7] border border-[#cfe2d8] space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#14533d] flex items-center gap-1.5">
                <span>Output ({targetLangOption.nativeName})</span>
                {result.cached ? (
                  <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-[#e3efe9] text-[#14533d] font-bold flex items-center gap-1">
                    <Zap size={10} className="text-[#f5a524]" /> Cached
                  </span>
                ) : (
                  <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-[#d5ede1] text-[#0e3b43] font-bold">
                    Live Gemini 3.8 Flash
                  </span>
                )}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-xs text-[#204a43] hover:text-[#0e3b43] flex items-center gap-1 font-semibold cursor-pointer"
                >
                  {copied ? <Check size={13} className="text-[#1f8a5b]" /> : <Copy size={13} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>

                {onApplyTranslation && (
                  <button
                    type="button"
                    onClick={handleApply}
                    className="text-xs bg-[#0e3b43] text-white px-2 py-0.5 rounded-md hover:bg-[#14533d] flex items-center gap-1 font-bold cursor-pointer"
                  >
                    {applied ? <Check size={12} /> : <ArrowRight size={12} />}
                    <span>{applied ? 'Applied' : 'Apply'}</span>
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs text-[#0e3b43] font-medium leading-relaxed bg-white p-2.5 rounded-lg border border-[#dce6e2]">
              {result.translatedText}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DynamicVernacularTranslator;
