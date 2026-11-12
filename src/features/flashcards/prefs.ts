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

/** "millionaire2" is the quiz show with the Vietnamese prize ladder; the old "millionaire" scores were on another scale. */
export type GameName = "match" | "drop" | "memory" | "blitz" | "millionaire" | "millionaire2" | "miner";
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
const MUSIC_KEY = "jd.flash_music.v1";
/** Fired when sound or music is switched, so a sound that is already playing can stop (or come back) at once. */
export const SOUND_EVENT = "jd:flash-sound";
const announceSound = () => {
  try {
    window.dispatchEvent(new Event(SOUND_EVENT));
  } catch {
    /* no window: nothing is playing anyway */
  }
};

/** Sound effects and music of the games; the learner can switch all of it off. */
export const soundOn = (): boolean => get(SOUND_KEY) !== "off";
export const saveSound = (on: boolean) => {
  set(SOUND_KEY, on ? "on" : "off");
  announceSound();
};
/** The quiz show's background music is opt-in and also follows the sound switch. */
export const musicOn = (): boolean => get(MUSIC_KEY) === "on";
export const saveMusic = (on: boolean) => {
  set(MUSIC_KEY, on ? "on" : "off");
  announceSound();
};

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

const HIRAGANA_KEY = "jd.flash_hiragana.v1";
const hiraganaListeners = new Set<() => void>();

/** Whether the Japanese reading appears before meanings. On unless turned off. */
export const showHiragana = (): boolean => get(HIRAGANA_KEY) !== "off";

export function saveShowHiragana(on: boolean): void {
  set(HIRAGANA_KEY, on ? "on" : "off");
  hiraganaListeners.forEach((l) => l());
}

function subscribeHiragana(l: () => void): () => void {
  hiraganaListeners.add(l);
  const onStorage = (e: StorageEvent) => e.key === HIRAGANA_KEY && l();
  window.addEventListener("storage", onStorage);
  return () => {
    hiraganaListeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useShowHiragana(): [boolean, (on: boolean) => void] {
  return [useSyncExternalStore(subscribeHiragana, showHiragana, () => true), saveShowHiragana];
}

const SHUFFLE_KEY = "jd.flash_shuffle.v1";
const shuffleListeners = new Set<() => void>();

/** Whether a study round comes in random order. On unless turned off; off keeps the order the cards were added in. */
export const shuffleOn = (): boolean => get(SHUFFLE_KEY) !== "off";

export function saveShuffle(on: boolean): void {
  set(SHUFFLE_KEY, on ? "on" : "off");
  shuffleListeners.forEach((l) => l());
}

function subscribeShuffle(l: () => void): () => void {
  shuffleListeners.add(l);
  const onStorage = (e: StorageEvent) => e.key === SHUFFLE_KEY && l();
  window.addEventListener("storage", onStorage);
  return () => {
    shuffleListeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useShuffle(): [boolean, (on: boolean) => void] {
  return [useSyncExternalStore(subscribeShuffle, shuffleOn, () => true), saveShuffle];
}

const IMAGES_KEY = "jd.flash_images.v1";
const imageListeners = new Set<() => void>();

/** Whether a card's picture is shown with the question in study, tests and games. On unless turned off. */
export const showImages = (): boolean => get(IMAGES_KEY) !== "off";

export function saveShowImages(on: boolean): void {
  set(IMAGES_KEY, on ? "on" : "off");
  imageListeners.forEach((l) => l());
}

function subscribeImages(l: () => void): () => void {
  imageListeners.add(l);
  const onStorage = (e: StorageEvent) => e.key === IMAGES_KEY && l();
  window.addEventListener("storage", onStorage);
  return () => {
    imageListeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useShowImages(): [boolean, (on: boolean) => void] {
  return [useSyncExternalStore(subscribeImages, showImages, () => true), saveShowImages];
}

const AUTO_KEY = "jd.flash_autoflip.v1";
/** Seconds to look at a question before the card turns over by itself: long enough to recall a word and its reading. */
export const AUTO_FLIP_DEFAULT = 5;
export const AUTO_FLIP_CHOICES = [3, 5, 8, 10, 15] as const;
export type AutoFlip = { on: boolean; seconds: number };

export function loadAutoFlip(): AutoFlip {
  try {
    const v = JSON.parse(get(AUTO_KEY) ?? "{}") as Partial<AutoFlip>;
    const seconds = typeof v.seconds === "number" && v.seconds >= 1 && v.seconds <= 60 ? Math.round(v.seconds) : AUTO_FLIP_DEFAULT;
    return { on: v.on === true, seconds };
  } catch {
    return { on: false, seconds: AUTO_FLIP_DEFAULT };
  }
}
export const saveAutoFlip = (a: AutoFlip) => set(AUTO_KEY, JSON.stringify(a));

const MIL_TIMER_KEY = "jd.flash_mil_timer.v1";
/** Whether each question in the quiz show has a clock; on unless turned off. */
export const loadQuizTimer = (): boolean => get(MIL_TIMER_KEY) !== "off";
export const saveQuizTimer = (on: boolean) => set(MIL_TIMER_KEY, on ? "on" : "off");
