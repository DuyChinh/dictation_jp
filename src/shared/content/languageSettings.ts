import { loadSettings, saveSettings } from "../storage/settingsStore";

export type SupportLang = "vi" | "en";

export function getExplanationLang(): SupportLang {
  return loadSettings().explanationLang ?? "vi";
}

export function getTranslationLang(): SupportLang {
  return loadSettings().translationLang ?? "vi";
}

export function setExplanationLang(lang: SupportLang): void {
  saveSettings({ explanationLang: lang });
}

export function setTranslationLang(lang: SupportLang): void {
  saveSettings({ translationLang: lang });
}
