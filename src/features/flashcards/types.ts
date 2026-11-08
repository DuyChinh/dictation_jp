export type CardLang = "ja" | "vi" | "en";
export const CARD_LANGS: CardLang[] = ["ja", "vi", "en"];

export type Deck = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  deleted?: true;
};

/** A term and its definition, each in its own language. Only the Japanese side (if any) has a reading. */
export type Card = {
  id: string;
  deckId: string;
  term: string;
  termLang: CardLang;
  definition: string;
  definitionLang: CardLang;
  reading?: string;
  /** Dictionary entry the card was made from, when it was. */
  entryId?: number;
  /** Leitner box 0-5 and when the card is next due. */
  box: number;
  due: number;
  right: number;
  wrong: number;
  createdAt: number;
  updatedAt: number;
  deleted?: true;
};

export type FlashState = { decks: Deck[]; cards: Card[] };

/** One side of a card as it is shown or asked for. */
export type Side = { text: string; lang: CardLang; reading?: string };

/** Which side is asked: the term, the definition, or either at random. */
export type Direction = "term" | "definition" | "mixed";
