import React, { useState, useEffect, createContext, useContext } from 'react';
import { translations } from '../translations';

// --- Language Context ---
export const LanguageContext = createContext({
  lang: 'en',
  t: translations['en'],
  setLang: () => {},
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }) => {
  // Initialize language from localStorage or default to 'en'
  const [lang, setLang] = useState(() => {
      return localStorage.getItem('appLanguage') || 'en';
  });
  
  // Persist language change to localStorage
  useEffect(() => {
      localStorage.setItem('appLanguage', lang);
  }, [lang]);

  const t = translations[lang] || translations['en'];

  return (
    <LanguageContext.Provider value={{ lang, t, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
};
