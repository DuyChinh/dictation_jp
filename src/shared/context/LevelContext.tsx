import { createContext, useContext, useState, type ReactNode } from "react";
import { useUiLanguage } from "../i18n/UiLanguageContext";

export type JlptLevel = "ALL" | "N1" | "N2" | "N3" | "N4" | "N5";

const LEVEL_STORAGE_KEY = "jd.selected_level";

interface LevelContextType {
  level: JlptLevel;
  setLevel: (level: JlptLevel) => void;
  getLevelLabel: (lvl: JlptLevel) => string;
}

const LevelContext = createContext<LevelContextType | undefined>(undefined);

export function LevelProvider({ children }: { children: ReactNode }) {
  const { uiLang } = useUiLanguage();
  const [level, setLevelState] = useState<JlptLevel>(() => {
    try {
      const saved = localStorage.getItem(LEVEL_STORAGE_KEY) as JlptLevel | null;
      if (saved && ["ALL", "N1", "N2", "N3", "N4", "N5"].includes(saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    return "ALL";
  });

  const setLevel = (newLevel: JlptLevel) => {
    setLevelState(newLevel);
    try {
      localStorage.setItem(LEVEL_STORAGE_KEY, newLevel);
    } catch {
      // ignore
    }
  };

  const getLevelLabel = (lvl: JlptLevel): string => {
    if (lvl === "ALL") {
      if (uiLang === "vi") return "Tất cả (N0)";
      if (uiLang === "ja") return "すべて (N0)";
      return "All (N0)";
    }
    return lvl;
  };

  return (
    <LevelContext.Provider value={{ level, setLevel, getLevelLabel }}>
      {children}
    </LevelContext.Provider>
  );
}

export function useLevel() {
  const ctx = useContext(LevelContext);
  if (!ctx) {
    throw new Error("useLevel must be used within LevelProvider");
  }
  return ctx;
}
