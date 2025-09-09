import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import enCommon from './locales/en/common.json';
import hiCommon from './locales/hi/common.json';
import esCommon from './locales/es/common.json';

const resources = {
  en: {
    common: enCommon,
  },
  hi: {
    common: hiCommon,
  },
  es: {
    common: esCommon,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    
    // Language detection options
    detection: {
      order: ['localStorage', 'sessionStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage', 'sessionStorage'],
    },

    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
      // Custom formatters for preserving numbers in English
      formatSeparator: ',',
    },

    // Namespace configuration
    defaultNS: 'common',
    ns: ['common'],
  });

export default i18n;
