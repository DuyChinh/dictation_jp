const KEY = "jd.settings.v1";

export type MascotType = "shiba" | "kitsune" | "neko" | "panda";

export type UserSettings = {
  autoPlay: boolean;
  playbackRate: number;
  retryBeforeReveal: number;
  explanationLang?: "vi" | "en";
  translationLang?: "vi" | "en";
  showTranslation?: boolean;
  mascot?: MascotType;
};

const defaults: UserSettings = {
  autoPlay: true,
  playbackRate: 1,
  retryBeforeReveal: 1,
  explanationLang: "vi",
  translationLang: "vi",
  showTranslation: true,
  mascot: "shiba",
};

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(patch: Partial<UserSettings>): UserSettings {
  const next = { ...loadSettings(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
