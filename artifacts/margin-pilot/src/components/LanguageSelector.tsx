import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { SUPPORTED_LANGUAGES, STORAGE_KEY, LanguageOption } from '../i18n/config';
import { useAuth } from '../state/AuthContext';

interface LanguageSelectorProps {
  className?: string;
  variant?: 'header' | 'sidebar' | 'mobile' | 'compact';
  onLanguageChange?: (lang: LanguageOption) => void;
}

export function LanguageSelector({
  className = '',
  variant = 'header',
  onLanguageChange,
}: LanguageSelectorProps) {
  const { i18n } = useTranslation();
  const { updatePreferredLanguage } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ||
    SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectLanguage = async (lang: LanguageOption) => {
    try {
      await i18n.changeLanguage(lang.code);
      try {
        localStorage.setItem(STORAGE_KEY, lang.code);
      } catch {
        // ignore
      }

      // Persist to user profile and React auth state
      await updatePreferredLanguage(lang.code);

      onLanguageChange?.(lang);
    } catch (err) {
      console.error('Failed to change language:', err);
    } finally {
      setIsOpen(false);
    }
  };

  if (variant === 'mobile') {
    return (
      <div className={`p-3 bg-[#f8faf9] rounded-xl border border-[#e1e8e4] ${className}`}>
        <div className="flex items-center gap-2 mb-2 text-xs font-bold text-[#0e3b43]">
          <Globe size={15} className="text-[#14533d]" />
          <span>Language / भाषा</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = lang.code === currentLang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => selectLanguage(lang)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-[#0e3b43] text-white font-bold'
                    : 'bg-white text-[#3d504c] hover:bg-[#edf2ef]'
                }`}
              >
                <div className="text-left truncate">
                  <span className="block leading-tight">{lang.nativeName}</span>
                  <span className="block text-[10px] opacity-75">{lang.name}</span>
                </div>
                {isSelected && <Check size={12} className="shrink-0 ml-1 text-[#f5a524]" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const isSidebar = variant === 'sidebar';

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select interface language"
        aria-expanded={isOpen}
        className={`flex items-center gap-1.5 rounded-xl transition-all duration-200 cursor-pointer select-none ${
          isSidebar
            ? 'w-full px-2.5 py-2 text-xs font-semibold text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10'
            : variant === 'compact'
            ? 'px-2 py-1 text-xs font-bold text-[#0e3b43] bg-[#edf2ef] hover:bg-[#e2eae5] border border-[#d5deda]'
            : 'px-3 py-1.5 text-xs font-bold text-[#0e3b43] bg-[#f8faf9] hover:bg-[#edf5f1] border border-[#dce5e1] hover:border-[#0e3b43]/30 shadow-2xs hover:shadow-xs'
        }`}
      >
        <Globe
          size={14}
          className={isSidebar ? 'text-white/70' : 'text-[#14533d]'}
        />
        <span className="truncate max-w-[85px] sm:max-w-none">
          {currentLang.nativeName}
        </span>
        <ChevronDown
          size={12}
          className={`transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          } ${isSidebar ? 'text-white/50' : 'text-[#708480]'}`}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className={`absolute z-50 mt-1.5 w-56 rounded-2xl bg-white border border-[#dbe4e0] shadow-xl py-1.5 animate-in fade-in zoom-in-95 duration-150 ${
            isSidebar ? 'bottom-full mb-1.5 left-0' : 'right-0'
          }`}
        >
          <div className="px-3 py-1.5 border-b border-[#edf2f0] text-[10px] font-bold text-[#627772] uppercase tracking-wider flex items-center justify-between">
            <span>Select Language</span>
            <span className="text-[9px] bg-[#eaf4ef] text-[#14533d] px-1.5 py-0.2 rounded font-extrabold">
              9 REGIONS
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto py-1 divide-y divide-[#f5f8f6]">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = lang.code === currentLang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  role="menuitem"
                  onClick={() => selectLanguage(lang)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#eaf4ef] text-[#0e3b43] font-bold'
                      : 'text-[#384c47] hover:bg-[#f8faf9] hover:text-[#0e3b43]'
                  }`}
                >
                  <div>
                    <span className="block text-xs font-bold leading-tight">
                      {lang.nativeName}
                    </span>
                    <span className="block text-[10.5px] text-[#6d817d]">
                      {lang.name}
                    </span>
                  </div>
                  {isSelected && (
                    <Check size={14} className="text-[#1f8a5b] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default LanguageSelector;
