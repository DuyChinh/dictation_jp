import type { Card } from "./types";
import { notifyProgressChange } from "./gameProgress";

/**
 * Where a learner got to in a study round, so coming back to a deck carries on from the same card.
 * Kept on this device (and copied to the account by progressSync.ts), one round per deck. A finished or restarted
 * round stays as an empty one, dated, so a device that was offline does not bring the old round back.
 */
export const LEARN_KEY = "jd.flash_learn.v1";
/** A round left alone this long is not worth carrying on with. */
const MAX_AGE_MS = 30 * 24 * 3600 * 1000;

export type SavedLearn = {
  /** Card ids in the order they are shown, and for each whether its definition is asked first. */
  order: string[];
  flips: boolean[];
  index: number;
  unknown: string[];
  at: number;
};

type Store = Record<string, SavedLearn>;

function read(): Store {
  try {
    const v = JSON.parse(localStorage.getItem(LEARN_KEY) ?? "{}") as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store): void {
  try {
    if (Object.keys(store).length === 0) localStorage.removeItem(LEARN_KEY);
    else localStorage.setItem(LEARN_KEY, JSON.stringify(store));
  } catch {
    /* progress just won't be kept */
  }
}

export function saveLearn(deckId: string, saved: SavedLearn): void {
  write({ ...read(), [deckId]: saved });
  notifyProgressChange();
}

const isOver = (s: SavedLearn | undefined): boolean => !s || !Array.isArray(s.order) || s.order.length === 0;

/** Forgets the round, leaving a dated empty one (see above). */
export function clearLearn(deckId: string, now = Date.now()): void {
  const store = read();
  if (isOver(store[deckId])) return; // nothing saved, or already over
  store[deckId] = { order: [], flips: [], index: 0, unknown: [], at: now };
  write(store);
  notifyProgressChange();
}

/** Every study round on this device (finished ones as empty rounds), by deck id. */
export function exportLearn(): Store {
  const out: Store = {};
  for (const [id, s] of Object.entries(read())) {
    if (s && typeof s.at === "number" && Array.isArray(s.order) && Array.isArray(s.flips)) out[id] = s;
  }
  return out;
}

const strings = (v: unknown): string[] | null => (Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : null);

/** A round as the account holds it (`data` null = over) turned back into a saved one; null when it is malformed. */
export function learnFromWire(at: number, data: unknown): SavedLearn | null {
  if (!Number.isFinite(at)) return null;
  if (data === null) return { order: [], flips: [], index: 0, unknown: [], at };
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  const order = strings(d.order);
  const unknown = strings(d.unknown ?? []);
  if (!order || !unknown || !Array.isArray(d.flips) || !d.flips.every((x) => typeof x === "boolean")) return null;
  if (typeof d.index !== "number" || !Number.isInteger(d.index) || d.index < 0) return null;
  return { order, flips: d.flips as boolean[], index: d.index, unknown, at };
}

/** What goes to the account for a round: its content, or null once it is over. */
export function learnToWire(s: SavedLearn): { order: string[]; flips: boolean[]; index: number; unknown: string[] } | null {
  return isOver(s) ? null : { order: s.order, flips: s.flips, index: s.index, unknown: s.unknown ?? [] };
}

/** Takes in the account's rounds: for each deck, the newer of the two is kept. Returns whether anything changed. */
export function importLearn(remote: Record<string, SavedLearn>, now = Date.now()): boolean {
  const store = read();
  let changed = false;
  for (const [id, s] of Object.entries(remote)) {
    if (now - s.at > MAX_AGE_MS) continue;
    const have = store[id];
    if (have && typeof have.at === "number" && have.at >= s.at) continue;
    store[id] = s;
    changed = true;
  }
  if (changed) write(store);
  return changed;
}

export type Resumed = { items: Array<{ card: Card; flip: boolean }>; index: number; unknown: string[] };

/**
 * The saved round for this deck rebuilt from the cards as they are now. Cards deleted since are dropped (the
 * position moves with them); null when there is nothing left to carry on with.
 */
export function resumeLearn(deckId: string, cards: Card[], now = Date.now()): Resumed | null {
  const saved = read()[deckId];
  if (!saved || !Array.isArray(saved.order) || !Array.isArray(saved.flips)) return null;
  if (now - saved.at > MAX_AGE_MS) return null;
  const byId = new Map(cards.map((c) => [c.id, c]));
  const items: Resumed["items"] = [];
  let index = 0;
  saved.order.forEach((id, i) => {
    const card = byId.get(id);
    if (!card) return;
    if (i < saved.index) index++;
    items.push({ card, flip: saved.flips[i] === true });
  });
  if (index >= items.length) return null;
  const kept = new Set(items.map((x) => x.card.id));
  return { items, index, unknown: (saved.unknown ?? []).filter((id) => kept.has(id)) };
}
