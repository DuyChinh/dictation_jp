import { useEffect, useRef } from "react";

/**
 * Where a learner got to in a game, so reloading the page or coming back to the deck offers "Continue" instead of a
 * fresh start. One saved game per deck and game, kept on this device. What is saved is plain data the game itself
 * decides on (cards are included as the words they show, so a game can carry on even if a card was edited).
 */
export const GAME_KEY = "jd.flash_game.v1";
/** A game left alone this long is not worth carrying on with. */
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

type Entry = { at: number; data: unknown };
type Store = Record<string, Entry>;

const keyOf = (deckId: string, game: string) => `${deckId}:${game}`;

function read(): Store {
  try {
    const v = JSON.parse(localStorage.getItem(GAME_KEY) ?? "{}") as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store): void {
  try {
    if (Object.keys(store).length === 0) localStorage.removeItem(GAME_KEY);
    else localStorage.setItem(GAME_KEY, JSON.stringify(store));
  } catch {
    /* progress just won't be kept */
  }
}

export function saveGame(deckId: string, game: string, data: unknown, now = Date.now()): void {
  const store = read();
  // old games of other decks fall away, so the store does not grow for ever
  for (const [k, e] of Object.entries(store)) if (!e || typeof e.at !== "number" || now - e.at > MAX_AGE_MS) delete store[k];
  store[keyOf(deckId, game)] = { at: now, data };
  write(store);
}

/** The saved game, or null when there is none, it is old, or `accept` says it is not usable. */
export function loadGame<T>(deckId: string, game: string, accept: (data: unknown) => data is T, now = Date.now()): T | null {
  const e = read()[keyOf(deckId, game)];
  if (!e || typeof e.at !== "number" || now - e.at > MAX_AGE_MS) return null;
  try {
    return accept(e.data) ? e.data : null;
  } catch {
    return null;
  }
}

export function clearGame(deckId: string, game: string): void {
  const store = read();
  const k = keyOf(deckId, game);
  if (!(k in store)) return;
  delete store[k];
  write(store);
}

/** Runs `save` when the page is hidden or closed, so the clock and the position are exact in what was kept. */
export function useSaveOnLeave(save: () => void): void {
  const latest = useRef(save);
  latest.current = save;
  useEffect(() => {
    const run = () => latest.current();
    const onHide = () => {
      if (document.visibilityState === "hidden") run();
    };
    window.addEventListener("pagehide", run);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", run);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);
}

export const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
