import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  getExplanationLang,
  getTranslationLang,
  setExplanationLang as persistExp,
  setTranslationLang as persistTr,
  type SupportLang,
} from "./languageSettings";

type LanguageContextValue = {
  explanationLang: SupportLang;
  translationLang: SupportLang;
  setExplanationLang: (l: SupportLang) => void;
  setTranslationLang: (l: SupportLang) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [explanationLang, setExp] = useState<SupportLang>(getExplanationLang);
  const [translationLang, setTr] = useState<SupportLang>(getTranslationLang);

  const value = useMemo(
    () => ({
      explanationLang,
      translationLang,
      setExplanationLang: (l: SupportLang) => {
        persistExp(l);
        setExp(l);
      },
      setTranslationLang: (l: SupportLang) => {
        persistTr(l);
        setTr(l);
      },
    }),
    [explanationLang, translationLang],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useContentLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useContentLanguage requires LanguageProvider");
  }
  return ctx;
}
