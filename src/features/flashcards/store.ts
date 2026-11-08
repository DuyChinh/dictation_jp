import { useSyncExternalStore } from "react";
import { mergeState } from "./merge";
import { CARD_LANGS, type Card, type CardLang, type Deck, type FlashState } from "./types";

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
  return merged;
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

/** The deck new cards go to when none is chosen; made on first use. */
export function ensureDefaultDeck(name: string): Deck {
  const s = readState();
  const found = s.decks.find((d) => d.id === DEFAULT_DECK_ID && !d.deleted);
  return found ?? createDeck(name, DEFAULT_DECK_ID);
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
  entryId?: number;
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
  if (input.entryId) card.entryId = input.entryId;
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

export const isCardLang = (v: unknown): v is CardLang => CARD_LANGS.includes(v as CardLang);

const sameText = (a: string, b: string) => clean(a).toLowerCase() === clean(b).toLowerCase();

/** A card with this term and definition is already in the deck. */
export function isDuplicate(cards: Card[], deckId: string, term: string, definition: string): boolean {
  return cards.some((c) => c.deckId === deckId && !c.deleted && sameText(c.term, term) && sameText(c.definition, definition));
}
