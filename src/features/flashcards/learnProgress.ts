import type { Card } from "./types";

/**
 * Where a learner got to in a study round, so coming back to a deck carries on from the same card.
 * Kept on this device, one round per deck.
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
}

export function clearLearn(deckId: string): void {
  const store = read();
  if (!(deckId in store)) return;
  delete store[deckId];
  write(store);
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
