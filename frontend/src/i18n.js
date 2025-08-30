import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpApi from 'i18next-http-backend';

// Get initial language from localStorage (will be synced with backend later)
const getInitialLanguage = () => {
  const stored = localStorage.getItem('i18nextLng');
  if (stored && ['de', 'en'].includes(stored)) {
    return stored;
  }
  // Fallback to browser language or English
  const browserLang = navigator.language.substring(0, 2);
  return ['de', 'en'].includes(browserLang) ? browserLang : 'en';
};

i18n
  .use(HttpApi) // Load translations using http
  .use(initReactI18next) // Pass i18n instance to react-i18next
  .init({
    lng: getInitialLanguage(), // Set initial language explicitly
    supportedLngs: ['de', 'en'],
    fallbackLng: 'en',
    debug: false,
    
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
