import { createContext, useContext, useState, ReactNode } from "react";
import { translations, type TranslationKey, type UiLang } from "./translations";

interface UiLanguageContextValue {
  uiLang: UiLang;
  setUiLang: (lang: UiLang) => void;
  t: (key: TranslationKey) => string;
}

const STORAGE_KEY = "jd_ui_language";

const UiLanguageContext = createContext<UiLanguageContextValue | undefined>(undefined);

export function UiLanguageProvider({ children }: { children: ReactNode }) {
  const [uiLang, setUiState] = useState<UiLang>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as UiLang | null;
    return saved === "vi" || saved === "ja" || saved === "en" ? saved : "vi";
  });

  const setUiLang = (lang: UiLang) => {
    setUiState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  };

  const t = (key: TranslationKey): string => {
    const langDict = translations[uiLang] || translations.vi;
    const str = langDict[key] || translations.vi[key] || key;
    return str.normalize("NFC");
  };

  return (
    <UiLanguageContext.Provider value={{ uiLang, setUiLang, t }}>
      {children}
    </UiLanguageContext.Provider>
  );
}

export function useUiLanguage() {
  const context = useContext(UiLanguageContext);
  if (!context) {
    throw new Error("useUiLanguage must be used within UiLanguageProvider");
  }
  return context;
}
