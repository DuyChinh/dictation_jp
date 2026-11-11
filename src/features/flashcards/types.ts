export type CardLang = "ja" | "vi" | "en";
export const CARD_LANGS: CardLang[] = ["ja", "vi", "en"];

export type Deck = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Set while the deck is public: the id in its share link. */
  shareId?: string;
  /** The deck that used to be called "default", before decks got real ids. */
  legacyId?: string;
  deleted?: true;
};

/** A picture on a card: only a reference to one hosted by Openverse or Wikimedia Commons, with its credit. */
export type CardImage = {
  /** The thumbnail shown on the card. */
  url: string;
  /** The page that credits the picture. */
  page?: string;
  /** Who made it. */
  by?: string;
  /** Its licence, e.g. "CC BY 4.0". */
  lic?: string;
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
  /** Sino-Vietnamese reading of the Japanese word, e.g. "CẤU NHẬP"; shown after the meaning. */
  hanViet?: string;
  /** Dictionary entry the card was made from, when it was. */
  entryId?: number;
  /** A picture for the card, shown with the asked side. */
  image?: CardImage;
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
export type Side = {
  text: string;
  lang: CardLang;
  /** Reading of a Japanese side: used for speech and for checking typed answers. */
  reading?: string;
  /** False keeps the reading from being drawn above the word (it is still used for speech and checking). */
  showReading?: boolean;
  /** A reading shown in front of this side's text, as "こうにゅう: mua". It belongs to the Japanese side on the other end of the card. */
  lead?: string;
  /** Shown at the end of this side, after the text: the Sino-Vietnamese reading of the card's Japanese word. */
  trail?: string;
  /** The card's picture, set on the asked side only; drawn big, where a side is the question. */
  image?: CardImage;
};

/** Which side is asked: the term, the definition, or either at random. */
export type Direction = "term" | "definition" | "mixed";
