import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export interface LanguageOption {
  code: string;
  label: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'bn', label: 'বাংলা (Bangla)' },
  { code: 'en', label: 'English (US)' },
  { code: 'cn', label: '中文 (Chinese)' },
  { code: 'ar', label: 'العربية (Arabic)' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'ur', label: 'اردو (Urdu)' },
];

interface LanguageSelectorProps {
  onLanguageChange?: (code: string) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ onLanguageChange }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [currentLang, setCurrentLang] = useState<LanguageOption>(LANGUAGES[0]);
  const [isOpen, setIsOpen] = useState(false);

  // Clear any old google translate cookie on mount
  useEffect(() => {
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
  }, []);

  // Initialize Hidden Google Translate Engine
  useEffect(() => {
    if (!document.getElementById('google-translate-script')) {
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateInit';
      script.async = true;
      document.body.appendChild(script);

      (window as any).googleTranslateInit = () => {
        new (window as any).google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            includedLanguages: 'en,bn,zh-CN,ar,hi,ur',
            autoDisplay: false,
          },
          'google_translate_element'
        );
      };
    }
  }, []);

  const changeLanguage = (langOption: LanguageOption) => {
    setCurrentLang(langOption);
    setIsOpen(false);

    if (onLanguageChange) {
      onLanguageChange(langOption.code);
    }

    const targetGtCode = langOption.code === 'cn' ? 'zh-CN' : langOption.code;

    if (langOption.code === 'en') {
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
      const selectElem = document.querySelector('.goog-te-combo') as HTMLSelectElement;
      if (selectElem) {
        selectElem.value = 'en';
        selectElem.dispatchEvent(new Event('change'));
      }
    } else {
      document.cookie = `googtrans=/en/${targetGtCode}; path=/;`;
      const selectElem = document.querySelector('.goog-te-combo') as HTMLSelectElement;
      if (selectElem) {
        selectElem.value = targetGtCode;
        selectElem.dispatchEvent(new Event('change'));
      }
    }
  };

  return (
    <div className="relative inline-block text-left z-50">
      {/* Hidden Container for Google Translate Element */}
      <div id="google_translate_element" className="hidden" />

      {/* Sleek Plain Text Trigger Button (Default English) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-0 bg-transparent border-0 outline-none cursor-pointer flex items-center space-x-1.5 text-sm font-medium tracking-wide transition-all duration-200 transform hover:scale-105 ${
          isDark ? 'text-[#A0A0A0] hover:text-white' : 'text-[#5C6B73] hover:text-[#0F2D52]'
        }`}
        title="Select Language"
      >
        <span>{currentLang.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Floating Language Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute right-0 mt-3 w-52 rounded-2xl p-2 shadow-2xl backdrop-blur-xl border transition-all animate-in fade-in zoom-in-95 max-h-72 overflow-y-auto ${
            isDark
              ? 'bg-[#1C1C1E]/95 border-[#2C2C2E] text-white'
              : 'bg-white/95 border-[#E4E9EC] text-[#0F2D52]'
          }`}
        >
          {LANGUAGES.map((langOption) => (
            <button
              key={langOption.code}
              onClick={() => changeLanguage(langOption)}
              className={`w-full text-left px-3.5 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${
                currentLang.code === langOption.code
                  ? isDark
                    ? 'bg-[#1FB6A8]/20 text-[#1FB6A8] font-bold'
                    : 'bg-[#1FB6A8]/10 text-[#00897B] font-bold'
                  : isDark
                  ? 'hover:bg-[#2C2C2E] text-[#D0D0D0]'
                  : 'hover:bg-slate-100 text-[#5C6B73]'
              }`}
            >
              <span>{langOption.label}</span>
              {currentLang.code === langOption.code && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#1FB6A8]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
