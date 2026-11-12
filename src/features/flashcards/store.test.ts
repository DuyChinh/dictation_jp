import { beforeEach, describe, expect, it } from "vitest";
import { hasUnsynced, mergeById, mergeState, TOMBSTONE_MS } from "./merge";
import {
  DEFAULT_DECK_ID,
  addCard,
  cardsOf,
  createDeck,
  deckStats,
  isReviewDue,
  reviewDue,
  deleteCard,
  deleteDeck,
  ensureDefaultDeck,
  importSharedDeck,
  isDuplicate,
  migrateLegacyDefault,
  setDeckShare,
  liveCards,
  liveDecks,
  mergeIntoLocal,
  readState,
  recordAnswers,
  renameDeck,
  reviewed,
  updateCard,
  writeState,
} from "./store";
import type { Card } from "./types";

const base = { termLang: "ja", definitionLang: "vi" } as const;
const add = (deckId: string, term: string, definition: string) => addCard({ deckId, term, definition, ...base });

beforeEach(() => {
  localStorage.clear();
});

describe("decks and cards", () => {
  it("stores decks and cards, trims text and keeps the reading", () => {
    const d = createDeck("  Bài 1 ");
    const c = addCard({ deckId: d.id, term: " 食べる ", definition: "ăn ", reading: "たべる", entryId: 5, ...base });
    expect(liveDecks(readState()).map((x) => x.name)).toEqual(["Bài 1"]);
    expect(cardsOf(readState(), d.id)).toEqual([expect.objectContaining({ id: c.id, term: "食べる", definition: "ăn", reading: "たべる", entryId: 5, box: 0 })]);
  });

  it("makes the default deck once, with an id of its own", () => {
    const first = ensureDefaultDeck("Từ của tôi");
    ensureDefaultDeck("Từ của tôi");
    expect(liveDecks(readState())).toHaveLength(1);
    expect(first.id).not.toBe(DEFAULT_DECK_ID);
    expect(first.id.length).toBeGreaterThan(20);
  });

  it("renames, edits and deletes with tombstones", () => {
    const d = createDeck("A");
    const c = add(d.id, "犬", "chó");
    renameDeck(d.id, "B");
    updateCard(c.id, { definition: "con chó", reading: "" });
    expect(liveDecks(readState())[0]!.name).toBe("B");
    expect(cardsOf(readState(), d.id)[0]).toMatchObject({ definition: "con chó" });
    expect(cardsOf(readState(), d.id)[0]!.reading).toBeUndefined();
    deleteCard(c.id);
    expect(cardsOf(readState(), d.id)).toHaveLength(0);
    expect(readState().cards.find((x) => x.id === c.id)?.deleted).toBe(true);
  });

  it("deleting a deck removes its cards too", () => {
    const d = createDeck("A");
    const keep = createDeck("K");
    add(d.id, "犬", "chó");
    add(keep.id, "猫", "mèo");
    deleteDeck(d.id);
    expect(liveDecks(readState()).map((x) => x.id)).toEqual([keep.id]);
    expect(liveCards(readState()).map((c) => c.term)).toEqual(["猫"]);
  });

  it("does not show cards whose deck is gone", () => {
    const d = createDeck("A");
    add(d.id, "犬", "chó");
    writeState({ ...readState(), decks: [] });
    expect(liveCards(readState())).toHaveLength(0);
  });

  it("spots a duplicate of the same term and meaning", () => {
    const d = createDeck("A");
    add(d.id, "Inu", "Chó");
    expect(isDuplicate(liveCards(readState()), d.id, "inu ", "chó")).toBe(true);
    expect(isDuplicate(liveCards(readState()), d.id, "inu", "mèo")).toBe(false);
  });
});

describe("review", () => {
  const card: Card = { id: "c", deckId: "d", term: "犬", termLang: "ja", definition: "chó", definitionLang: "vi", box: 2, due: 0, right: 1, wrong: 0, createdAt: 1, updatedAt: 1 };
  const DAY = 24 * 3600 * 1000;

  it("moves a right answer up a box and a wrong one back to the start", () => {
    expect(reviewed(card, true, 1000)).toMatchObject({ box: 3, due: 1000 + 7 * DAY, right: 2 });
    expect(reviewed(card, false, 1000)).toMatchObject({ box: 0, due: 1000, wrong: 1 });
    expect(reviewed({ ...card, box: 5 }, true, 0).box).toBe(5);
  });

  it("records a batch of answers in one go", () => {
    const d = createDeck("A");
    const a = add(d.id, "犬", "chó");
    const b = add(d.id, "猫", "mèo");
    recordAnswers([{ cardId: a.id, correct: true }, { cardId: b.id, correct: false }]);
    const cards = cardsOf(readState(), d.id);
    expect(cards.find((c) => c.id === a.id)).toMatchObject({ box: 1, right: 1 });
    expect(cards.find((c) => c.id === b.id)).toMatchObject({ box: 0, wrong: 1 });
  });

  it("counts new, learning, learned and due cards", () => {
    const mk = (over: Partial<Card>): Card => ({ ...card, ...over });
    const s = deckStats([mk({ right: 0, wrong: 0, box: 0 }), mk({ box: 1, due: 9e15 }), mk({ box: 4, due: 9e15 })], 100);
    expect(s).toEqual({ total: 3, fresh: 1, learning: 1, learned: 1, due: 1 });
  });

  it("reminds only about cards that were answered before and are now due", () => {
    const mk = (over: Partial<Card>): Card => ({ ...card, ...over });
    const cards = [
      mk({ id: "new", right: 0, wrong: 0, due: 0 }),
      mk({ id: "a", deckId: "d1", right: 1, due: 50 }),
      mk({ id: "b", deckId: "d1", wrong: 2, due: 100 }),
      mk({ id: "c", deckId: "d2", right: 3, due: 100 }),
      mk({ id: "later", deckId: "d2", right: 1, due: 9e15 }),
    ];
    expect(isReviewDue(cards[0]!, 100)).toBe(false);
    expect(isReviewDue(cards[4]!, 100)).toBe(false);
    expect(reviewDue(cards, 100)).toEqual({ total: 3, byDeck: { d1: 2, d2: 1 }, topDeckId: "d1" });
    expect(reviewDue([cards[0]!], 100)).toEqual({ total: 0, byDeck: {}, topDeckId: null });
  });

  it("brings back a card answered wrong straight away and puts a known one off", () => {
    const c: Card = { ...card, box: 3, right: 3, due: 0 };
    expect(isReviewDue(reviewed(c, false, 1000), 1000)).toBe(true);
    expect(isReviewDue(reviewed(c, true, 1000), 1000 + DAY)).toBe(false);
  });
});

describe("merge", () => {
  it("keeps what was edited here after a sync brought an older copy", () => {
    const d = createDeck("A");
    const c = add(d.id, "犬", "chó");
    const remoteOld = { decks: readState().decks, cards: [{ ...c, definition: "cũ", updatedAt: c.updatedAt - 10 }] };
    mergeIntoLocal(remoteOld);
    expect(cardsOf(readState(), d.id)[0]!.definition).toBe("chó");
  });

  it("takes in cards made on another device", () => {
    const other: Card = { id: "x", deckId: "d9", term: "水", termLang: "ja", definition: "nước", definitionLang: "vi", box: 0, due: 0, right: 0, wrong: 0, createdAt: 5, updatedAt: 5 };
    mergeIntoLocal({ decks: [{ id: "d9", name: "Máy khác", createdAt: 5, updatedAt: 5 }], cards: [other] });
    expect(cardsOf(readState(), "d9")).toHaveLength(1);
  });

  it("lets a newer deletion win and drops old tombstones", () => {
    const a = { id: "a", updatedAt: 5 };
    expect(mergeById([a], [{ ...a, updatedAt: 6, deleted: true as const }])[0]!.deleted).toBe(true);
    const old = { id: "o", deckId: "d", term: "", termLang: "ja", definition: "", definitionLang: "vi", box: 0, due: 0, right: 0, wrong: 0, createdAt: 1, updatedAt: 1, deleted: true } as Card;
    expect(mergeState({ decks: [], cards: [old] }, { decks: [], cards: [] }, 2 * TOMBSTONE_MS).cards).toHaveLength(0);
  });

  it("knows when something here still needs uploading", () => {
    const d = { id: "d", name: "A", createdAt: 1, updatedAt: 5 };
    expect(hasUnsynced({ decks: [d], cards: [] }, { decks: [d], cards: [] })).toBe(false);
    expect(hasUnsynced({ decks: [{ ...d, updatedAt: 6 }], cards: [] }, { decks: [d], cards: [] })).toBe(true);
    expect(hasUnsynced({ decks: [d], cards: [] }, { decks: [], cards: [] })).toBe(true);
  });
});

describe("decks from before they had ids of their own", () => {
  const legacy = () => {
    const old = createDeck("Từ của tôi", DEFAULT_DECK_ID);
    add(old.id, "犬", "chó");
    add(old.id, "猫", "mèo");
  };

  it("moves the deck named default to a deck with a real id, cards and name included", () => {
    legacy();
    migrateLegacyDefault();
    const live = liveDecks(readState());
    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({ name: "Từ của tôi", legacyId: DEFAULT_DECK_ID });
    expect(live[0]!.id).not.toBe(DEFAULT_DECK_ID);
    expect(cardsOf(readState(), live[0]!.id).map((c) => c.term).sort()).toEqual(["犬", "猫"]);
    expect(readState().decks.find((d) => d.id === DEFAULT_DECK_ID)?.deleted).toBe(true);
    expect(liveCards(readState())).toHaveLength(2);
  });

  it("does it once, and does nothing when there is nothing to move", () => {
    migrateLegacyDefault();
    expect(readState().decks).toHaveLength(0);
    legacy();
    migrateLegacyDefault();
    const after = JSON.stringify(readState());
    migrateLegacyDefault();
    expect(JSON.stringify(readState())).toBe(after);
  });

  it("moves cards that still point at default, such as ones another device sent later, into the same deck", () => {
    legacy();
    migrateLegacyDefault();
    const target = liveDecks(readState())[0]!;
    const late = { id: "late", deckId: DEFAULT_DECK_ID, term: "水", termLang: "ja", definition: "nước", definitionLang: "vi", box: 0, due: 0, right: 0, wrong: 0, createdAt: 9, updatedAt: 9 } as const;
    mergeIntoLocal({ decks: [], cards: [late] });
    expect(liveDecks(readState())).toHaveLength(1);
    expect(cardsOf(readState(), target.id).map((c) => c.term)).toContain("水");
  });

  it("the old fixed id is no longer what a new default deck gets", () => {
    const d = ensureDefaultDeck("Từ của tôi");
    expect(d.id).not.toBe(DEFAULT_DECK_ID);
  });
});

describe("sharing and copies", () => {
  it("marks a deck public and private again, bumping its edit time", () => {
    const d = createDeck("A");
    setDeckShare(d.id, "abc123XYZ789");
    expect(liveDecks(readState())[0]!.shareId).toBe("abc123XYZ789");
    const t = liveDecks(readState())[0]!.updatedAt;
    setDeckShare(d.id, undefined);
    expect(liveDecks(readState())[0]).not.toHaveProperty("shareId");
    expect(liveDecks(readState())[0]!.updatedAt).toBeGreaterThanOrEqual(t);
  });

  it("keeps a shared deck as a deck of its own: new ids, same order, no progress, not public", () => {
    const deck = importSharedDeck("Bài 5", [
      { id: "s1", term: "犬", termLang: "ja", definition: "chó", definitionLang: "vi", reading: "いぬ" },
      { id: "s2", term: "猫", termLang: "ja", definition: "mèo", definitionLang: "vi", hanViet: "MIÊU" },
    ]);
    expect(deck).not.toHaveProperty("shareId");
    const cards = cardsOf(readState(), deck.id).sort((a, b) => a.createdAt - b.createdAt);
    expect(cards.map((c) => c.term)).toEqual(["犬", "猫"]);
    expect(cards.map((c) => c.id)).not.toContain("s1");
    expect(cards[0]).toMatchObject({ reading: "いぬ", box: 0, right: 0, wrong: 0, due: 0 });
    expect(cards[1]).toMatchObject({ hanViet: "MIÊU" });
  });

  it("answers about cards that are not here change nothing", () => {
    const d = createDeck("A");
    add(d.id, "犬", "chó");
    const before = localStorage.getItem("jd.flashcards.v1");
    recordAnswers([{ cardId: "elsewhere", correct: true }]);
    expect(localStorage.getItem("jd.flashcards.v1")).toBe(before);
  });
});
