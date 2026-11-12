import { useMemo, useSyncExternalStore } from "react";
import { mergeState } from "./merge";
import { isAllowedImage } from "./cardImage";
import { CARD_LANGS, type Card, type CardImage, type CardLang, type Deck, type FlashState } from "./types";

/**
 * Decks and cards live in this browser and, when signed in, are merged with the account's copy
 * (see sync.ts). Deleting leaves a tombstone so another device does not bring the item back.
 */
export const FLASHCARD_KEY = "jd.flashcards.v1";
export const DEFAULT_DECK_ID = "default";
const DAY = 24 * 3600 * 1000;
/** Days until a card comes back after being answered right from each box. */
const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];
export const MAX_BOX = INTERVAL_DAYS.length - 1;
/** A card in this box or higher counts as learned. */
export const LEARNED_BOX = 4;

const EMPTY: FlashState = { decks: [], cards: [] };

let lastRaw: string | null = null;
let lastState: FlashState = EMPTY;
const listeners = new Set<() => void>();
let onChange: (() => void) | null = null;

/** sync.ts registers here so every edit schedules an upload without a circular import. */
export function setChangeHandler(fn: (() => void) | null): void {
  onChange = fn;
}

function parse(raw: string | null): FlashState {
  if (!raw) return EMPTY;
  try {
    const v = JSON.parse(raw) as Partial<FlashState>;
    return { decks: Array.isArray(v.decks) ? v.decks : [], cards: Array.isArray(v.cards) ? v.cards : [] };
  } catch {
    return EMPTY;
  }
}

/** The stored state; the same object is returned until the stored text changes. */
export function readState(): FlashState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(FLASHCARD_KEY);
  } catch {
    return lastState;
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastState = parse(raw);
  }
  return lastState;
}

function emit() {
  for (const l of listeners) l();
}

/** `fromServer` writes (the result of a sync) do not schedule another upload. */
export function writeState(state: FlashState, { fromServer = false } = {}): void {
  const raw = JSON.stringify(state);
  try {
    localStorage.setItem(FLASHCARD_KEY, raw);
  } catch {
    // storage full or blocked: keep what we have for this page only
    lastRaw = raw;
    lastState = state;
  }
  emit();
  if (!fromServer) onChange?.();
}

/** Takes in a copy from the server, keeping anything newer made here in the meantime. */
export function mergeIntoLocal(remote: FlashState): FlashState {
  const merged = mergeState(readState(), remote);
  writeState(merged, { fromServer: true });
  migrateLegacyDefault();
  return readState();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === FLASHCARD_KEY) l();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export const liveDecks = (s: FlashState): Deck[] => s.decks.filter((d) => !d.deleted);

/** Cards that are not deleted and whose deck still exists. */
export function liveCards(s: FlashState): Card[] {
  const decks = new Set(liveDecks(s).map((d) => d.id));
  return s.cards.filter((c) => !c.deleted && decks.has(c.deckId));
}

export const cardsOf = (s: FlashState, deckId: string): Card[] => liveCards(s).filter((c) => c.deckId === deckId);

export function useFlashcards(): { decks: Deck[]; cards: Card[]; state: FlashState } {
  const state = useSyncExternalStore(subscribe, readState, () => EMPTY);
  return { decks: liveDecks(state), cards: liveCards(state), state };
}

export function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const clean = (s: string) => s.normalize("NFC").trim();

export function createDeck(name: string, id: string = newId()): Deck {
  const now = Date.now();
  const deck: Deck = { id, name: clean(name).slice(0, 80), createdAt: now, updatedAt: now };
  const s = readState();
  writeState({ ...s, decks: [...s.decks.filter((d) => d.id !== id), deck] });
  return deck;
}

/** The deck new cards go to when none is chosen; made on first use, with an id of its own like any deck. */
export function ensureDefaultDeck(name: string): Deck {
  const live = liveDecks(readState());
  return live.find((d) => d.legacyId === DEFAULT_DECK_ID) ?? live[0] ?? createDeck(name);
}

/**
 * Decks used to share one fixed id, "default", for the deck made on first use. It gets an id of its own now:
 * the cards move to a new deck (remembering where it came from) and the old one is marked deleted. Cards that
 * still point at "default", such as ones another device sent later, are moved the same way.
 */
export function migrateLegacyDefault(): void {
  const s = readState();
  const old = s.decks.find((d) => d.id === DEFAULT_DECK_ID && !d.deleted);
  const stray = s.cards.some((c) => c.deckId === DEFAULT_DECK_ID && !c.deleted);
  if (!old && !stray) return;
  const now = Date.now();
  let target = s.decks.find((d) => d.legacyId === DEFAULT_DECK_ID && !d.deleted);
  let decks = s.decks;
  if (!target) {
    target = { id: newId(), name: old?.name ?? "Từ của tôi", createdAt: old?.createdAt ?? now, updatedAt: now, legacyId: DEFAULT_DECK_ID };
    decks = [...decks, target];
  }
  const to = target.id;
  decks = decks.map((d) => (d.id === DEFAULT_DECK_ID && !d.deleted ? { ...d, deleted: true as const, updatedAt: now } : d));
  const cards = s.cards.map((c) => (c.deckId === DEFAULT_DECK_ID && !c.deleted ? { ...c, deckId: to, updatedAt: now } : c));
  writeState({ decks, cards });
}

export function renameDeck(id: string, name: string): void {
  const s = readState();
  const now = Date.now();
  writeState({ ...s, decks: s.decks.map((d) => (d.id === id ? { ...d, name: clean(name).slice(0, 80), updatedAt: now } : d)) });
}

export function deleteDeck(id: string): void {
  const s = readState();
  const now = Date.now();
  writeState({
    decks: s.decks.map((d) => (d.id === id && !d.deleted ? { ...d, deleted: true, updatedAt: now } : d)),
    cards: s.cards.map((c) => (c.deckId === id && !c.deleted ? { ...c, deleted: true, updatedAt: now } : c)),
  });
}

export type NewCard = {
  deckId: string;
  term: string;
  termLang: CardLang;
  definition: string;
  definitionLang: CardLang;
  reading?: string;
  hanViet?: string;
  entryId?: number;
  image?: CardImage;
};

export function addCard(input: NewCard): Card {
  const now = Date.now();
  const card: Card = {
    id: newId(),
    deckId: input.deckId,
    term: clean(input.term).slice(0, 200),
    termLang: input.termLang,
    definition: clean(input.definition).slice(0, 400),
    definitionLang: input.definitionLang,
    box: 0,
    due: 0,
    right: 0,
    wrong: 0,
    createdAt: now,
    updatedAt: now,
  };
  const reading = input.reading ? clean(input.reading).slice(0, 200) : "";
  if (reading) card.reading = reading;
  const hanViet = input.hanViet ? clean(input.hanViet).slice(0, 100) : "";
  if (hanViet) card.hanViet = hanViet;
  if (input.entryId) card.entryId = input.entryId;
  if (isAllowedImage(input.image)) card.image = input.image;
  const s = readState();
  writeState({ ...s, cards: [...s.cards, card] });
  return card;
}

export function updateCard(id: string, patch: Partial<Omit<NewCard, "deckId">> & { deckId?: string }): void {
  const s = readState();
  const now = Date.now();
  writeState({
    ...s,
    cards: s.cards.map((c) => {
      if (c.id !== id) return c;
      const next: Card = { ...c, ...patch, updatedAt: now };
      next.term = clean(next.term).slice(0, 200);
      next.definition = clean(next.definition).slice(0, 400);
      if (!next.reading?.trim()) delete next.reading;
      if (!next.hanViet?.trim()) delete next.hanViet;
      else next.hanViet = clean(next.hanViet).slice(0, 100);
      if (!isAllowedImage(next.image)) delete next.image;
      return next;
    }),
  });
}

export function deleteCard(id: string): void {
  const s = readState();
  const now = Date.now();
  writeState({ ...s, cards: s.cards.map((c) => (c.id === id && !c.deleted ? { ...c, deleted: true, updatedAt: now } : c)) });
}

/** The card after one answer: right moves it up a box and pushes its due date out, wrong sends it back to box 0. */
export function reviewed(card: Card, correct: boolean, now = Date.now()): Card {
  const box = correct ? Math.min(MAX_BOX, card.box + 1) : 0;
  return {
    ...card,
    box,
    due: now + (INTERVAL_DAYS[box] ?? 0) * DAY,
    right: card.right + (correct ? 1 : 0),
    wrong: card.wrong + (correct ? 0 : 1),
    updatedAt: now,
  };
}

/** Records answers in one write, e.g. at the end of a test. */
export function recordAnswers(results: Array<{ cardId: string; correct: boolean }>): void {
  if (!results.length) return;
  const byCard = new Map(results.map((r) => [r.cardId, r.correct]));
  const s = readState();
  // answers about cards that are not here (a shared deck studied from its link) change nothing
  if (!s.cards.some((c) => byCard.has(c.id))) return;
  const now = Date.now();
  writeState({ ...s, cards: s.cards.map((c) => (byCard.has(c.id) && !c.deleted ? reviewed(c, byCard.get(c.id)!, now) : c)) });
}

export const recordAnswer = (cardId: string, correct: boolean) => recordAnswers([{ cardId, correct }]);

export type DeckStats = { total: number; fresh: number; learning: number; learned: number; due: number };

export function deckStats(cards: Card[], now = Date.now()): DeckStats {
  let fresh = 0;
  let learned = 0;
  let due = 0;
  for (const c of cards) {
    if (c.right + c.wrong === 0) fresh++;
    else if (c.box >= LEARNED_BOX) learned++;
    if (c.due <= now) due++;
  }
  return { total: cards.length, fresh, learning: cards.length - fresh - learned, learned, due };
}

/** A card that has been answered before and whose review date has come. A brand-new card is something to learn, not to review. */
export const isReviewDue = (c: Card, now = Date.now()): boolean => c.right + c.wrong > 0 && c.due <= now;

export type ReviewDue = { total: number; byDeck: Record<string, number>; topDeckId: string | null };

/** How many cards are waiting for a review, in all, per deck, and which deck has the most. */
export function reviewDue(cards: Card[], now = Date.now()): ReviewDue {
  const byDeck: Record<string, number> = {};
  let total = 0;
  for (const c of cards) {
    if (!isReviewDue(c, now)) continue;
    total++;
    byDeck[c.deckId] = (byDeck[c.deckId] ?? 0) + 1;
  }
  const top = Object.entries(byDeck).sort((a, b) => b[1] - a[1])[0];
  return { total, byDeck, topDeckId: top ? top[0] : null };
}

export function useReviewDue(): ReviewDue {
  const { cards } = useFlashcards();
  return useMemo(() => reviewDue(cards), [cards]);
}

export const isCardLang = (v: unknown): v is CardLang => CARD_LANGS.includes(v as CardLang);

const sameText = (a: string, b: string) => clean(a).toLowerCase() === clean(b).toLowerCase();

/** A card with this term and definition is already in the deck. */
export function isDuplicate(cards: Card[], deckId: string, term: string, definition: string): boolean {
  return cards.some((c) => c.deckId === deckId && !c.deleted && sameText(c.term, term) && sameText(c.definition, definition));
}

/** Fills in the Sino-Vietnamese reading of every card made from these dictionary entries that has none yet. */
export function applyHanViet(byEntry: Record<number, string>): void {
  const s = readState();
  const now = Date.now();
  let changed = false;
  const cards = s.cards.map((c) => {
    const hv = c.entryId ? byEntry[c.entryId] : undefined;
    if (!hv || c.deleted || c.hanViet) return c;
    changed = true;
    return { ...c, hanViet: hv.slice(0, 100), updatedAt: now };
  });
  if (changed) writeState({ ...s, cards });
}

/** Records that a deck is public (with its share id) or private again. */
export function setDeckShare(id: string, shareId: string | undefined): void {
  const s = readState();
  const now = Date.now();
  writeState({
    ...s,
    decks: s.decks.map((d) => {
      if (d.id !== id) return d;
      const { shareId: _old, ...rest } = d;
      return shareId ? { ...rest, shareId, updatedAt: now } : { ...rest, updatedAt: now };
    }),
  });
}

export type SharedCardData = {
  id: string;
  term: string;
  termLang: CardLang;
  definition: string;
  definitionLang: CardLang;
  reading?: string;
  hanViet?: string;
  image?: CardImage;
};

/** Keeps a copy of a shared deck in this browser, as a deck of its own with fresh cards and no study progress. */
export function importSharedDeck(name: string, shared: SharedCardData[]): Deck {
  const now = Date.now();
  const deck: Deck = { id: newId(), name: clean(name).slice(0, 80) || "Flashcard", createdAt: now, updatedAt: now };
  const cards: Card[] = shared.map((c, i) => ({
    id: newId(),
    deckId: deck.id,
    term: c.term,
    termLang: c.termLang,
    definition: c.definition,
    definitionLang: c.definitionLang,
    ...(c.reading ? { reading: c.reading } : {}),
    ...(c.hanViet ? { hanViet: c.hanViet } : {}),
    ...(isAllowedImage(c.image) ? { image: c.image } : {}),
    box: 0,
    due: 0,
    right: 0,
    wrong: 0,
    // keep the order they were shared in
    createdAt: now + i,
    updatedAt: now,
  }));
  const s = readState();
  writeState({ decks: [...s.decks, deck], cards: [...s.cards, ...cards] });
  return deck;
}

// decks made before they had ids of their own
try {
  migrateLegacyDefault();
} catch {
  /* storage blocked: nothing to move */
}

/** Brings back a card that was just deleted. */
export function restoreCard(id: string): void {
  const s = readState();
  const now = Date.now();
  writeState({ ...s, cards: s.cards.map((c) => {
    if (c.id !== id || !c.deleted) return c;
    const { deleted: _gone, ...rest } = c;
    return { ...rest, updatedAt: now };
  }) });
}
