import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, translations, TranslationKey } from '../i18n/translations';
import { Globe, Check } from 'lucide-react';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'spm_language_preference';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'bn') return saved;
    } catch {}
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
  };

  const t = (key: TranslationKey, fallback?: string): string => {
    const langDict = translations[language];
    if (langDict && key in langDict) {
      return (langDict as any)[key];
    }
    const enDict = translations.en;
    if (enDict && key in enDict) {
      return (enDict as any)[key];
    }
    return fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageSwitcherProps {
  variant?: 'header' | 'button' | 'dropdown' | 'pill';
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ variant = 'header', className = '' }) => {
  const { language, setLanguage, t } = useLanguage();

  if (variant === 'pill') {
    return (
      <div className={`inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 ${className}`}>
        <button
          type="button"
          onClick={() => setLanguage('en')}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
            language === 'en'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => setLanguage('bn')}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
            language === 'bn'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          বাংলা
        </button>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        id="btn-language-toggle"
        onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
        className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
        title="Toggle language English / বাংলা"
      >
        <Globe className="w-3.5 h-3.5 text-emerald-600" />
        <span>{language === 'en' ? 'EN' : 'বাংলা'}</span>
        <span className="text-[10px] text-slate-400 font-normal">
          ({language === 'en' ? 'বাংলা' : 'EN'})
        </span>
      </button>
    </div>
  );
};
