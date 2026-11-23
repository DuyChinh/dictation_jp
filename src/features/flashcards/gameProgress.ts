import { useEffect, useRef } from "react";

/**
 * Where a learner got to in a game, so reloading the page or coming back to the deck offers "Continue" instead of a
 * fresh start. One saved game per deck and game, kept on this device and, when signed in, copied to the account
 * (progressSync.ts) so another device offers "Continue" too. What is saved is plain data the game itself
 * decides on (cards are included as the words they show, so a game can carry on even if a card was edited).
 * A game that was finished is kept for a while as `data: null`, so a device that was offline does not bring it back.
 */
export const GAME_KEY = "jd.flash_game.v1";
/** A game left alone this long is not worth carrying on with. */
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

export type GameEntry = { at: number; data: unknown };
type Entry = GameEntry;
type Store = Record<string, Entry>;

let onChange: (() => void) | null = null;
/** progressSync.ts registers here so every save or finish schedules an upload, without a circular import. */
export function setProgressChangeHandler(fn: (() => void) | null): void {
  onChange = fn;
}
/** Tells the sync that this device's saved progress changed (games and study rounds both call it). */
export function notifyProgressChange(): void {
  onChange?.();
}

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
  notifyProgressChange();
}

/** The saved game, or null when there is none, it is old, it was finished, or `accept` says it is not usable. */
export function loadGame<T>(deckId: string, game: string, accept: (data: unknown) => data is T, now = Date.now()): T | null {
  const e = read()[keyOf(deckId, game)];
  if (!e || typeof e.at !== "number" || now - e.at > MAX_AGE_MS || e.data === null) return null;
  try {
    return accept(e.data) ? e.data : null;
  } catch {
    return null;
  }
}

/** Is there a game of this deck left half way (and, when `direction` is given, one asked the same way)? */
export function hasSavedGame(deckId: string, game: string, direction?: string, now = Date.now()): boolean {
  const e = read()[keyOf(deckId, game)];
  if (!e || typeof e.at !== "number" || now - e.at > MAX_AGE_MS || !isRecordLike(e.data)) return false;
  return direction === undefined || e.data.direction === direction;
}
const isRecordLike = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Forgets the game. What stays is a dated mark that it is over, so the account's copy is dropped on other devices too. */
export function clearGame(deckId: string, game: string, now = Date.now()): void {
  const store = read();
  const k = keyOf(deckId, game);
  const e = store[k];
  if (!e || e.data === null) return; // nothing saved, or already marked over (games call this again and again once over)
  store[k] = { at: now, data: null };
  write(store);
  notifyProgressChange();
}

/** Every saved game and finish mark on this device, by "<deckId>:<game>". */
export function exportGames(): Store {
  const out: Store = {};
  for (const [k, e] of Object.entries(read())) {
    if (e && typeof e.at === "number" && (e.data === null || isRecordLike(e.data))) out[k] = e;
  }
  return out;
}

const GAME_KEY_SHAPE = /^[\w-]{1,64}:[a-z]{1,20}$/;
/** Takes in the account's games: for each, the newer of the two copies is kept. Returns whether anything changed. */
export function importGames(remote: Record<string, unknown>, now = Date.now()): boolean {
  const store = read();
  let changed = false;
  for (const [k, v] of Object.entries(remote)) {
    if (!GAME_KEY_SHAPE.test(k) || !isRecordLike(v) || typeof v.at !== "number" || !Number.isFinite(v.at)) continue;
    if (v.data !== null && !isRecordLike(v.data)) continue;
    if (now - v.at > MAX_AGE_MS) continue;
    const have = store[k];
    if (have && typeof have.at === "number" && have.at >= v.at) continue;
    store[k] = { at: v.at, data: v.data };
    changed = true;
  }
  if (changed) write(store);
  return changed;
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
