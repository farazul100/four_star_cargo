import { useState, useEffect } from 'react';
import bnDict from '../locales/bn.json';
import enDict from '../locales/en.json';
import cnDict from '../locales/cn.json';
import arDict from '../locales/ar.json';
import hiDict from '../locales/hi.json';
import urDict from '../locales/ur.json';
import { Language } from '../types';

const dictionaries: Record<Language, Record<string, string>> = {
  en: enDict,
  bn: bnDict,
  cn: cnDict,
  ar: arDict,
  hi: hiDict,
  ur: urDict,
};

const VALID_LANGS: Language[] = ['en', 'bn', 'cn', 'ar', 'hi', 'ur'];

export const useTranslation = () => {
  const [lang, setLang] = useState<Language>(() => {
    try {
      const activeUserRaw = localStorage.getItem('fsc_active_user');
      if (activeUserRaw) {
        const activeUser = JSON.parse(activeUserRaw);
        const userSavedLang =
          localStorage.getItem(`fsc_user_language_${activeUser.id}`) || activeUser.default_language;
        if (userSavedLang && VALID_LANGS.includes(userSavedLang as Language)) {
          return userSavedLang as Language;
        }
      }
    } catch (e) {}

    const saved = localStorage.getItem('fsc_lang');
    if (saved && VALID_LANGS.includes(saved as Language)) {
      return saved as Language;
    }
    return 'bn';
  });

  useEffect(() => {
    localStorage.setItem('fsc_lang', lang);
    try {
      const activeUserRaw = localStorage.getItem('fsc_active_user');
      if (activeUserRaw) {
        const activeUser = JSON.parse(activeUserRaw);
        localStorage.setItem(`fsc_user_language_${activeUser.id}`, lang);
      }
    } catch (e) {}

    // Apply Google Translate trigger if applicable
    const targetGtCode = lang === 'cn' ? 'zh-CN' : lang;
    if (lang === 'en') {
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
      const selectElem = document.querySelector('.goog-te-combo') as HTMLSelectElement;
      if (selectElem && selectElem.value !== 'en') {
        selectElem.value = 'en';
        selectElem.dispatchEvent(new Event('change'));
      }
    } else if (lang !== 'bn') {
      document.cookie = `googtrans=/en/${targetGtCode}; path=/;`;
      const selectElem = document.querySelector('.goog-te-combo') as HTMLSelectElement;
      if (selectElem && selectElem.value !== targetGtCode) {
        selectElem.value = targetGtCode;
        selectElem.dispatchEvent(new Event('change'));
      }
    }
  }, [lang]);

  const dictionary: Record<string, string> = dictionaries[lang] || dictionaries.bn;

  const t = (key: string): string => {
    return dictionary[key] || dictionaries.en[key] || key;
  };

  return { t, lang, setLang };
};
