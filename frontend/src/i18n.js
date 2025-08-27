import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';

i18n
  .use(HttpApi) // Load translations using http
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next) // Pass i18n instance to react-i18next
  .init({
    supportedLngs: ['de', 'en'],
    fallbackLng: 'en',  // Geändert von 'de' auf 'en' für Englisch als Standard
    debug: false,
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
    
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },
    
    interpolation: {
      escapeValue: false, // React already does escaping
    },
    
    react: {
      useSuspense: false, // Disable suspense to avoid loading issues
    },
  });

export default i18n;
