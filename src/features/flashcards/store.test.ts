import { beforeEach, describe, expect, it } from "vitest";
import { hasUnsynced, mergeById, mergeState, TOMBSTONE_MS } from "./merge";
import {
  DEFAULT_DECK_ID,
  addCard,
  cardsOf,
  createDeck,
  deckStats,
  deleteCard,
  deleteDeck,
  ensureDefaultDeck,
  isDuplicate,
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

  it("makes the default deck once", () => {
    ensureDefaultDeck("Từ của tôi");
    ensureDefaultDeck("Từ của tôi");
    expect(liveDecks(readState())).toHaveLength(1);
    expect(liveDecks(readState())[0]!.id).toBe(DEFAULT_DECK_ID);
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
