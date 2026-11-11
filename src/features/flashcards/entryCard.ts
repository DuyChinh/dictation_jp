import type { DictEntry } from "../../shared/api/dictionary";
import { lastDeckId, saveLastDeck } from "./prefs";
import { DEFAULT_DECK_ID, addCard, ensureDefaultDeck, isDuplicate, updateCard } from "./store";
import { suggestionFromEntry, textFor } from "./suggest";
import type { Card, CardImage, CardLang, Deck } from "./types";

/** The deck a dictionary entry goes into: the one used last, else the first. */
export function targetDeckId(decks: Deck[]): string {
  const remembered = lastDeckId();
  return decks.some((d) => d.id === remembered) ? remembered! : (decks[0]?.id ?? DEFAULT_DECK_ID);
}

export type Placement = {
  /** The card is new, was there already, or was there already and has now been given the picture. */
  status: "added" | "exists" | "attached";
  deckName: string;
};

/**
 * Puts a dictionary entry into a deck as a card (the Japanese word and reading, the meaning in `lang`), with a
 * picture when one is given. An entry that already has a card there is not added twice; a picture is put on that
 * card instead. Null when the entry has nothing to put on a card.
 */
export function placeEntry(opts: {
  entry: DictEntry;
  lang: CardLang;
  decks: Deck[];
  cards: Card[];
  targetId: string;
  defaultDeckName: string;
  image?: CardImage;
}): Placement | null {
  const { entry, lang, decks, cards, targetId, defaultDeckName, image } = opts;
  const s = suggestionFromEntry(entry);
  const definition = textFor(s, lang);
  if (!s.ja || !definition) return null;
  const deck = decks.find((d) => d.id === targetId) ?? ensureDefaultDeck(defaultDeckName);
  const existing = cards.find((c) => c.deckId === deck.id && (c.entryId === entry.id || isDuplicate([c], deck.id, s.ja, definition)));
  if (existing) {
    if (!image) return { status: "exists", deckName: deck.name };
    updateCard(existing.id, { image });
    return { status: "attached", deckName: deck.name };
  }
  addCard({
    deckId: deck.id,
    term: s.ja,
    termLang: "ja",
    definition,
    definitionLang: lang,
    reading: s.reading,
    hanViet: s.hanViet || undefined,
    entryId: entry.id,
    image,
  });
  saveLastDeck(deck.id);
  return { status: "added", deckName: deck.name };
}
