import { useState, useSyncExternalStore } from "react";
import type { UiLang } from "../../shared/i18n/translations";
import { isCardLang } from "./store";
import type { CardLang, Direction } from "./types";

/** Small per-device choices: which side is asked, the language of the right-hand box, the last deck used, best scores. */
const DIR_KEY = "jd.flash_dir.v1";
const RIGHT_KEY = "jd.flash_right.v1";
const DECK_KEY = "jd.flash_deck.v1";
const BEST_KEY = "jd.flash_best.v1";

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function set(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* the choice just won't be remembered */
  }
}

export function loadDirection(): Direction {
  const v = get(DIR_KEY);
  return v === "term" || v === "definition" || v === "mixed" ? v : "term";
}

export function useDirection(): [Direction, (d: Direction) => void] {
  const [dir, setDir] = useState<Direction>(loadDirection);
  return [
    dir,
    (d) => {
      set(DIR_KEY, d);
      setDir(d);
    },
  ];
}

/** The language of the right-hand box: the last one picked, else Vietnamese (English for English and Japanese readers). */
export function loadRightLang(uiLang: UiLang): CardLang {
  const v = get(RIGHT_KEY);
  if (isCardLang(v) && v !== "ja") return v;
  return uiLang === "vi" ? "vi" : "en";
}
export const saveRightLang = (lang: CardLang) => set(RIGHT_KEY, lang);

export const lastDeckId = (): string | null => get(DECK_KEY);
export const saveLastDeck = (id: string) => set(DECK_KEY, id);

export type GameName = "match" | "drop" | "memory" | "blitz" | "shoot" | "miner";
type Best = Record<string, number>;

function readBest(): Best {
  try {
    const v = JSON.parse(get(BEST_KEY) ?? "{}") as unknown;
    return v && typeof v === "object" ? (v as Best) : {};
  } catch {
    return {};
  }
}

export const getBest = (deckId: string, game: GameName): number | null => readBest()[`${deckId}:${game}`] ?? null;

/** Keeps the better of the old and new value (lower for time, higher for score); true when it improved. */
export function submitBest(deckId: string, game: GameName, value: number, better: "low" | "high"): boolean {
  const best = readBest();
  const key = `${deckId}:${game}`;
  const old = best[key];
  const improved = old === undefined || (better === "low" ? value < old : value > old);
  if (improved) {
    best[key] = value;
    set(BEST_KEY, JSON.stringify(best));
  }
  return improved;
}

const SOUND_KEY = "jd.flash_sound.v1";
export const soundOn = (): boolean => get(SOUND_KEY) !== "off";
export const saveSound = (on: boolean) => set(SOUND_KEY, on ? "on" : "off");

const HV_KEY = "jd.flash_hv.v1";
const hvListeners = new Set<() => void>();

/** Whether the Sino-Vietnamese reading is shown at the end of meanings. On unless turned off. */
export const showHanViet = (): boolean => get(HV_KEY) !== "off";

export function saveShowHanViet(on: boolean): void {
  set(HV_KEY, on ? "on" : "off");
  hvListeners.forEach((l) => l());
}

function subscribeHv(l: () => void): () => void {
  hvListeners.add(l);
  const onStorage = (e: StorageEvent) => e.key === HV_KEY && l();
  window.addEventListener("storage", onStorage);
  return () => {
    hvListeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useShowHanViet(): [boolean, (on: boolean) => void] {
  return [useSyncExternalStore(subscribeHv, showHanViet, () => true), saveShowHanViet];
}
