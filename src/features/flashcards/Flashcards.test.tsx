import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import type { DictEntry } from "../../shared/api/dictionary";
import { CardEditor, type CardValue } from "./CardEditor";
import { DropMode } from "./DropMode";
import { LearnMode } from "./LearnMode";
import { MatchMode } from "./MatchMode";
import { MemoryMode } from "./MemoryMode";
import { BlitzMode } from "./BlitzMode";
import { MillionaireMode } from "./MillionaireMode";
import { MinerMode } from "./MinerMode";
import { TestMode } from "./TestMode";
import { StudyModes } from "./StudyModes";
import { AddEntryButton } from "./AddEntryButton";
import { addCard, createDeck, readState } from "./store";
import type { Card } from "./types";

// jsdom has no PointerEvent; a mouse event with the extra fields stands in so positions reach the handlers
if (typeof window.PointerEvent === "undefined") {
  class FakePointerEvent extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: MouseEventInit & { pointerId?: number; pointerType?: string } = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? "mouse";
    }
  }
  window.PointerEvent = FakePointerEvent as unknown as typeof PointerEvent;
}

const searchDictionary = vi.fn();
const lookupWord = vi.fn();
const fetchEntry = vi.fn();
vi.mock("../../shared/api/dictionary", async (orig) => ({
  ...(await orig<typeof import("../../shared/api/dictionary")>()),
  searchDictionary: (...a: unknown[]) => searchDictionary(...a),
  lookupWord: (...a: unknown[]) => lookupWord(...a),
  fetchEntry: (...a: unknown[]) => fetchEntry(...a),
}));
vi.mock("./miner", async (orig) => {
  const real = await orig<typeof import("./miner")>();
  // four nuggets with the first one straight under the claw
  const boxes = [
    { x: 37.5, y: 30, w: 25, h: 11 },
    { x: 4, y: 30, w: 25, h: 11 },
    { x: 71, y: 30, w: 25, h: 11 },
    { x: 4, y: 46, w: 25, h: 11 },
  ];
  return { ...real, layoutNuggets: (n: number) => boxes.slice(0, n) };
});
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("../../shared/ui/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../../shared/utils/confetti", () => ({ triggerConfetti: () => undefined, triggerFireworks: () => undefined }));

const entry = (id: number, word: string, reading: string, viMeaning: string[], en: string[]): DictEntry => ({
  id,
  common: true,
  jlpt: 5,
  kanji: [{ text: word, common: true, tags: [] }],
  kana: [{ text: reading, common: true, tags: [], appliesToKanji: null }],
  senses: [{ pos: ["v1"], field: [], misc: [], info: [], appliesToKanji: null, appliesToKana: null, glosses: en, vi: viMeaning, examples: [] }],
  viSource: "ai",
});
const TABERU = entry(1, "食べる", "たべる", ["ăn"], ["to eat"]);

const wrap = (ui: React.ReactNode) => (
  <MemoryRouter>
    <UiLanguageProvider>{ui}</UiLanguageProvider>
  </MemoryRouter>
);

const base = { termLang: "ja", definitionLang: "vi" } as const;
function seed(pairs: Array<[string, string]> = [["犬", "chó"], ["猫", "mèo"], ["水", "nước"], ["火", "lửa"]]): Card[] {
  const d = createDeck("Bộ thử", "deck1");
  pairs.forEach(([term, definition]) => addCard({ deckId: d.id, term, definition, ...base }));
  return readState().cards;
}

beforeEach(() => {
  window.scrollTo = vi.fn();
  localStorage.clear();
  searchDictionary.mockReset();
  lookupWord.mockReset();
  fetchEntry.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("CardEditor", () => {
  const search = (entries: DictEntry[]) => searchDictionary.mockResolvedValue({ query: "", lang: "ja", entries, kanji: [] });

  it("fills the right box with the Vietnamese meaning once the Japanese word is typed", async () => {
    search([TABERU]);
    render(wrap(<CardEditor submitLabel="Lưu" onSubmit={() => undefined} />));
    fireEvent.change(screen.getByLabelText("Từ"), { target: { value: "食べる" } });
    await waitFor(() => expect((screen.getByLabelText("Nghĩa") as HTMLInputElement).value).toBe("ăn"));
    // the reading comes along for the Japanese side
    expect((screen.getByPlaceholderText("たべる") as HTMLInputElement).value).toBe("たべる");
    expect(searchDictionary).toHaveBeenCalledWith("食べる", expect.anything(), "vi", "auto");
  });

  it("shows the English meaning when the right box is English, and re-reads it when the language changes", async () => {
    search([TABERU]);
    render(wrap(<CardEditor submitLabel="Lưu" onSubmit={() => undefined} initial={{ term: "食べる", termLang: "ja", definitionLang: "vi" }} />));
    await waitFor(() => expect((screen.getByLabelText("Nghĩa") as HTMLInputElement).value).toBe("ăn"));
    fireEvent.change(screen.getByLabelText("Ngôn ngữ ô bên phải"), { target: { value: "en" } });
    await waitFor(() => expect((screen.getByLabelText("Nghĩa") as HTMLInputElement).value).toBe("to eat"));
  });

  it("starts with Japanese on the left", () => {
    render(wrap(<CardEditor submitLabel="Lưu" onSubmit={() => undefined} />));
    expect((screen.getByLabelText("Ngôn ngữ ô bên trái") as HTMLSelectElement).value).toBe("ja");
  });

  it("stops overwriting the right box once the learner has typed in it", async () => {
    search([TABERU]);
    render(wrap(<CardEditor submitLabel="Lưu" onSubmit={() => undefined} />));
    fireEvent.change(screen.getByLabelText("Nghĩa"), { target: { value: "của tôi" } });
    fireEvent.change(screen.getByLabelText("Từ"), { target: { value: "食べる" } });
    await waitFor(() => expect(screen.getByText("Gợi ý từ từ điển")).toBeTruthy());
    expect((screen.getByLabelText("Nghĩa") as HTMLInputElement).value).toBe("của tôi");
    // picking a suggestion is an explicit choice and does replace it
    fireEvent.click(screen.getByRole("button", { name: /食べる/ }));
    expect((screen.getByLabelText("Nghĩa") as HTMLInputElement).value).toBe("ăn");
  });

  it("looks up Vietnamese text and offers the Japanese word on the right", async () => {
    search([TABERU]);
    render(wrap(<CardEditor submitLabel="Lưu" onSubmit={() => undefined} initial={{ term: "ăn", termLang: "vi", definitionLang: "ja" }} />));
    await waitFor(() => expect((screen.getByLabelText("Nghĩa") as HTMLInputElement).value).toBe("食べる"));
    expect(searchDictionary).toHaveBeenCalledWith("ăn", expect.anything(), "vi", "vi");
  });

  it("falls back to the click lookup for a conjugated word", async () => {
    search([]);
    lookupWord.mockResolvedValue({ start: 0, length: 5, matched: "食べる", reasons: ["polite", "past"], entries: [TABERU], kanji: [] });
    render(wrap(<CardEditor submitLabel="Lưu" onSubmit={() => undefined} initial={{ term: "食べました", termLang: "ja", definitionLang: "vi" }} />));
    await waitFor(() => expect((screen.getByLabelText("Nghĩa") as HTMLInputElement).value).toBe("ăn"));
    expect(lookupWord).toHaveBeenCalledWith("食べました", 0);
  });

  it("swaps the two boxes and their languages", () => {
    render(wrap(<CardEditor submitLabel="Lưu" onSubmit={() => undefined} initial={{ term: "犬", termLang: "ja", definition: "chó", definitionLang: "vi" }} />));
    fireEvent.click(screen.getByRole("button", { name: "Đổi hai ô" }));
    expect((screen.getByLabelText("Từ") as HTMLInputElement).value).toBe("chó");
    expect((screen.getByLabelText("Ngôn ngữ ô bên trái") as HTMLSelectElement).value).toBe("vi");
    expect((screen.getByLabelText("Ngôn ngữ ô bên phải") as HTMLSelectElement).value).toBe("ja");
  });

  it("never lets both boxes share a language", () => {
    render(wrap(<CardEditor submitLabel="Lưu" onSubmit={() => undefined} />));
    fireEvent.change(screen.getByLabelText("Ngôn ngữ ô bên trái"), { target: { value: "vi" } });
    // the right box was Vietnamese, so it moves to Japanese
    expect((screen.getByLabelText("Ngôn ngữ ô bên phải") as HTMLSelectElement).value).toBe("ja");
  });

  it("submits what was typed and shows a message the caller returns", async () => {
    search([]);
    const onSubmit = vi.fn<(v: CardValue) => string | void>(() => "Trùng thẻ");
    render(wrap(<CardEditor submitLabel="Lưu" onSubmit={onSubmit} />));
    fireEvent.change(screen.getByLabelText("Từ"), { target: { value: " 犬 " } });
    fireEvent.change(screen.getByLabelText("Nghĩa"), { target: { value: "chó" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ term: "犬", termLang: "ja", definition: "chó", definitionLang: "vi" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Trùng thẻ");
  });

  it("keeps working when the dictionary is unreachable", async () => {
    searchDictionary.mockRejectedValue(new Error("offline"));
    render(wrap(<CardEditor submitLabel="Lưu" onSubmit={() => undefined} />));
    fireEvent.change(screen.getByLabelText("Từ"), { target: { value: "犬" } });
    expect(await screen.findByText(/Không tra được gợi ý/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Nghĩa"), { target: { value: "chó" } });
    expect((screen.getByRole("button", { name: "Lưu" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("AddEntryButton", () => {
  it("saves the entry into a deck once, with the reading and the meaning in the reader's language", () => {
    render(wrap(<AddEntryButton entry={TABERU} meaning="vi" />));
    fireEvent.click(screen.getByRole("button", { name: "Thêm vào flashcard" }));
    const cards = readState().cards;
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ term: "食べる", reading: "たべる", definition: "ăn", definitionLang: "vi", entryId: 1 });
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("starts out marked when the word is already in the deck", () => {
    const d = createDeck("A", "default");
    addCard({ deckId: d.id, term: "食べる", definition: "ăn", entryId: 1, ...base });
    render(wrap(<AddEntryButton entry={TABERU} meaning="vi" />));
    expect(screen.getByRole("button", { name: "Đã thêm vào flashcard" })).toBeTruthy();
  });
});

const MEANING: Record<string, string> = { 犬: "chó", 猫: "mèo", 水: "nước", 火: "lửa" };
const cardOf = (term: string) => readState().cards.find((c) => c.term === term)!;

describe("LearnMode", () => {
  it("flips a card, records each answer and finishes with a score and a retry of the missed ones", () => {
    const cards = seed([["犬", "chó"], ["猫", "mèo"]]);
    render(wrap(<LearnMode deckId="deck1" cards={cards} direction="term" />));
    fireEvent.click(screen.getByLabelText("Xáo trộn thứ tự"));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));

    expect(screen.getByText("犬")).toBeTruthy();
    expect(screen.getByText("1 / 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Lật thẻ" }));
    expect(screen.getByText("chó")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Đã nhớ/ }));
    expect(cardOf("犬")).toMatchObject({ box: 1, right: 1 });

    fireEvent.click(screen.getByRole("button", { name: /Chưa nhớ/ }));
    expect(cardOf("猫")).toMatchObject({ box: 0, wrong: 1 });

    expect(screen.getByText("Hoàn thành!")).toBeTruthy();
    expect(screen.getByText("Bạn nhớ 1/2 từ.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Học lại 1 từ chưa nhớ" })).toBeTruthy();
  });

  it("asks the definition first when the direction says so", () => {
    const cards = seed([["犬", "chó"]]);
    render(wrap(<LearnMode deckId="deck1" cards={cards} direction="definition" />));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    expect(screen.getByText("chó")).toBeTruthy();
    expect(screen.queryByText("犬")).toBeNull();
  });

  it("answers from the keyboard", () => {
    const cards = seed([["犬", "chó"], ["猫", "mèo"]]);
    render(wrap(<LearnMode deckId="deck1" cards={cards} direction="term" />));
    fireEvent.click(screen.getByLabelText("Xáo trộn thứ tự"));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByText("chó")).toBeTruthy();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(cardOf("犬").right).toBe(1);
  });

  it("only studies cards that are due when asked", () => {
    const cards = seed([["犬", "chó"], ["猫", "mèo"]]);
    const later = cards.map((c, i) => (i === 0 ? { ...c, due: Date.now() + 1e9 } : c));
    render(wrap(<LearnMode deckId="deck1" cards={later} direction="term" />));
    expect(screen.getByRole("radio", { name: "Cần ôn hôm nay (1)" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    expect(screen.getByText("1 / 1")).toBeTruthy();
  });
});

describe("LearnMode flip and auto-flip", () => {
  const begin = (cards = seed([["犬", "chó"], ["猫", "mèo"]])) => {
    render(wrap(<LearnMode deckId="deck1" cards={cards} direction="term" />));
    fireEvent.click(screen.getByLabelText("Xáo trộn thứ tự"));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
  };
  beforeEach(() => vi.useFakeTimers());

  it("turns the card with a 3D flip: the question side stays, the answer side is drawn only once it is turned", async () => {
    begin();
    const card = document.querySelector(".fc-flash")!;
    expect(card.className).not.toContain("is-back");
    expect(document.querySelector(".fc-flash__side--back")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Lật thẻ" }));
    expect(card.className).toContain("is-back");
    expect(document.querySelector(".fc-flash__side--front")!.getAttribute("aria-hidden")).toBe("true");
    expect(document.querySelector(".fc-flash__side--back")!.getAttribute("aria-hidden")).toBe("false");
    // turning back keeps the answer drawn until the turn is over, then drops it
    fireEvent.click(screen.getByRole("button", { name: "Lật thẻ" }));
    expect(card.className).not.toContain("is-back");
    expect(document.querySelector(".fc-flash__side--back")).toBeTruthy();
    await act(async () => void vi.advanceTimersByTime(700));
    expect(document.querySelector(".fc-flash__side--back")).toBeNull();
  });

  it("does not turn by itself unless asked, and the choice is remembered", async () => {
    begin();
    await act(async () => void vi.advanceTimersByTime(60000));
    expect(document.querySelector(".fc-flash.is-back")).toBeNull();
    expect(document.querySelector(".fc-flash__timer")).toBeNull();
  });

  it("turns over after the chosen seconds, 5 by default", async () => {
    render(wrap(<LearnMode deckId="deck1" cards={seed([["犬", "chó"], ["猫", "mèo"]])} direction="term" />));
    fireEvent.click(screen.getByLabelText("Tự động lật thẻ sau một khoảng thời gian"));
    expect((screen.getByLabelText("Số giây trước khi lật") as HTMLSelectElement).value).toBe("5");
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    expect(document.querySelector(".fc-flash__timer")).toBeTruthy();
    await act(async () => void vi.advanceTimersByTime(4900));
    expect(document.querySelector(".fc-flash.is-back")).toBeNull();
    await act(async () => void vi.advanceTimersByTime(200));
    expect(document.querySelector(".fc-flash.is-back")).toBeTruthy();
    expect(document.querySelector(".fc-flash__timer")).toBeNull();
    // the next card starts its own countdown
    fireEvent.click(screen.getByRole("button", { name: /Đã nhớ/ }));
    expect(document.querySelector(".fc-flash.is-back")).toBeNull();
    await act(async () => void vi.advanceTimersByTime(5100));
    expect(document.querySelector(".fc-flash.is-back")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("jd.flash_autoflip.v1")!)).toEqual({ on: true, seconds: 5 });
  });

  it("uses the seconds that were picked, and can be switched off during the round", async () => {
    localStorage.setItem("jd.flash_autoflip.v1", JSON.stringify({ on: true, seconds: 3 }));
    begin();
    expect(screen.getByRole("button", { name: /Tự lật: 3s/ })).toBeTruthy();
    await act(async () => void vi.advanceTimersByTime(3100));
    expect(document.querySelector(".fc-flash.is-back")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Đã nhớ/ }));
    fireEvent.click(screen.getByRole("button", { name: /Tự lật: 3s/ }));
    expect(screen.getByRole("button", { name: /Tự lật: tắt/ })).toBeTruthy();
    await act(async () => void vi.advanceTimersByTime(10000));
    expect(document.querySelector(".fc-flash.is-back")).toBeNull();
  });
});

describe("LearnMode keeps your place", () => {
  const deckCards = () => seed([["犬", "chó"], ["猫", "mèo"], ["水", "nước"], ["火", "lửa"]]);
  const open = (cards: Card[]) => render(wrap(<LearnMode deckId="deck1" cards={cards} direction="term" />));
  const begin = (cards: Card[]) => {
    const r = open(cards);
    fireEvent.click(screen.getByLabelText("Xáo trộn thứ tự"));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    return r;
  };
  const promptNow = () => document.querySelector(".fc-flash__side--front .fc-side__text")!.textContent!;

  it("comes back to the same card, in the same order, with the same ones marked missed", () => {
    const cards = deckCards();
    const first = begin(cards);
    const order = [promptNow()];
    fireEvent.click(screen.getByRole("button", { name: /Chưa nhớ/ }));
    order.push(promptNow());
    fireEvent.click(screen.getByRole("button", { name: /Đã nhớ/ }));
    const third = promptNow();
    first.unmount();

    open(readState().cards);
    // straight into the round, no start screen
    expect(screen.queryByRole("button", { name: "Bắt đầu" })).toBeNull();
    expect(screen.getByText("3 / 4")).toBeTruthy();
    expect(promptNow()).toBe(third);
    expect(screen.getByRole("status").textContent).toBe("Đã nhớ chỗ bạn học dở, tiếp tục ở thẻ 3/4.");
    // finishing shows the one missed earlier for another go
    fireEvent.click(screen.getByRole("button", { name: /Đã nhớ/ }));
    fireEvent.click(screen.getByRole("button", { name: /Đã nhớ/ }));
    expect(screen.getByRole("button", { name: "Học lại 1 từ chưa nhớ" })).toBeTruthy();
    expect(order).toHaveLength(2);
  });

  it("is forgotten once the round is finished, so the next visit starts fresh", () => {
    const cards = deckCards();
    const first = begin(cards.slice(0, 2));
    fireEvent.click(screen.getByRole("button", { name: /Đã nhớ/ }));
    fireEvent.click(screen.getByRole("button", { name: /Đã nhớ/ }));
    expect(screen.getByText("Hoàn thành!")).toBeTruthy();
    expect(localStorage.getItem("jd.flash_learn.v1")).toBeNull();
    first.unmount();
    open(readState().cards);
    expect(screen.getByRole("button", { name: "Bắt đầu" })).toBeTruthy();
  });

  it("start over goes back to the start screen and drops the saved place", () => {
    begin(deckCards());
    fireEvent.click(screen.getByRole("button", { name: /Đã nhớ/ }));
    expect(localStorage.getItem("jd.flash_learn.v1")).toContain("deck1");
    fireEvent.click(screen.getByRole("button", { name: /Bắt đầu lại/ }));
    expect(screen.getByRole("button", { name: "Bắt đầu" })).toBeTruthy();
    expect(localStorage.getItem("jd.flash_learn.v1")).toBeNull();
  });

  it("skips cards that were deleted meanwhile and keeps the position", () => {
    const cards = deckCards();
    const first = begin(cards);
    const shown: string[] = [promptNow()];
    fireEvent.click(screen.getByRole("button", { name: /Đã nhớ/ }));
    shown.push(promptNow());
    fireEvent.click(screen.getByRole("button", { name: /Đã nhớ/ }));
    const next = promptNow();
    first.unmount();
    // the card answered first is deleted
    const remaining = readState().cards.filter((c) => c.term !== shown[0]);
    open(remaining);
    expect(screen.getByText("2 / 3")).toBeTruthy();
    expect(promptNow()).toBe(next);
  });

  it("does not resume a round older than a month, or one for another deck", () => {
    const cards = deckCards();
    const first = begin(cards);
    fireEvent.click(screen.getByRole("button", { name: /Đã nhớ/ }));
    first.unmount();
    const store = JSON.parse(localStorage.getItem("jd.flash_learn.v1")!);
    store.deck1.at = Date.now() - 40 * 24 * 3600 * 1000;
    localStorage.setItem("jd.flash_learn.v1", JSON.stringify(store));
    open(readState().cards);
    expect(screen.getByRole("button", { name: "Bắt đầu" })).toBeTruthy();
    cleanup();
    render(wrap(<LearnMode deckId="deck-other" cards={readState().cards} direction="term" />));
    expect(screen.getByRole("button", { name: "Bắt đầu" })).toBeTruthy();
  });
});

describe("LearnMode swipe", () => {
  const start = () => {
    const cards = seed([["犬", "chó"], ["猫", "mèo"]]);
    render(wrap(<LearnMode deckId="deck1" cards={cards} direction="term" />));
    fireEvent.click(screen.getByLabelText("Xáo trộn thứ tự"));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    return document.querySelector(".fc-flash__drag") as HTMLElement;
  };
  const drag = (el: HTMLElement, from: number, to: number, y = 0) => {
    fireEvent.pointerDown(el, { clientX: from, clientY: 0, pointerId: 1, pointerType: "touch", button: 0 });
    fireEvent.pointerMove(el, { clientX: (from + to) / 2, clientY: y / 2, pointerId: 1, pointerType: "touch" });
    fireEvent.pointerMove(el, { clientX: to, clientY: y, pointerId: 1, pointerType: "touch" });
    fireEvent.pointerUp(el, { clientX: to, clientY: y, pointerId: 1, pointerType: "touch" });
  };
  beforeEach(() => vi.useFakeTimers());

  it("a swipe to the right marks the card known, after the card flies off", async () => {
    const el = start();
    drag(el, 100, 260);
    expect(el.className).toContain("is-right");
    // not answered until it has left
    expect(cardOf("犬").right).toBe(0);
    await act(async () => void vi.advanceTimersByTime(300));
    expect(cardOf("犬")).toMatchObject({ box: 1, right: 1 });
    expect(screen.getByText("2 / 2")).toBeTruthy();
    expect((document.querySelector(".fc-flash__drag") as HTMLElement).style.transform).toBe("");
  });

  it("a swipe to the left marks it not known", async () => {
    const el = start();
    drag(el, 260, 100);
    expect(el.className).toContain("is-left");
    await act(async () => void vi.advanceTimersByTime(300));
    expect(cardOf("犬")).toMatchObject({ box: 0, wrong: 1 });
  });

  it("a short drag springs back and does not flip or answer", async () => {
    const el = start();
    drag(el, 100, 130);
    await act(async () => void vi.advanceTimersByTime(300));
    expect(cardOf("犬").right + cardOf("犬").wrong).toBe(0);
    expect(screen.getByText("1 / 2")).toBeTruthy();
    expect(screen.getByText("犬")).toBeTruthy();
    expect(el.style.transform).toBe("");
  });

  it("a mostly vertical move is a scroll, not a swipe", async () => {
    const el = start();
    drag(el, 100, 190, 300);
    await act(async () => void vi.advanceTimersByTime(300));
    expect(screen.getByText("1 / 2")).toBeTruthy();
    expect(cardOf("犬").right).toBe(0);
  });

  it("a drag does not count as a tap, but a tap still flips", () => {
    const el = start();
    drag(el, 100, 130);
    fireEvent.click(screen.getByRole("button", { name: "Lật thẻ" }));
    expect(screen.queryByText("chó")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Lật thẻ" }));
    expect(screen.getByText("chó")).toBeTruthy();
  });
});

describe("TestMode", () => {
  it("builds a written test, scores it, and records the answers", () => {
    const cards = seed();
    const { container } = render(wrap(<TestMode deckId="deck1" cards={cards} direction="term" />));
    for (const name of ["Trắc nghiệm", "Đúng / Sai", "Nối cặp"]) fireEvent.click(screen.getByLabelText(name));
    fireEvent.click(screen.getByLabelText("Tất cả trên một trang"));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu kiểm tra" }));

    const questions = [...container.querySelectorAll(".fc-q")];
    expect(questions).toHaveLength(4);
    let n = 0;
    for (const q of questions) {
      const term = q.querySelector(".fc-side__text")!.textContent!;
      // two right answers (one missing its accent), two wrong
      const answer = n < 2 ? MEANING[term]! : "sai";
      fireEvent.change(q.querySelector("input")!, { target: { value: n === 0 ? MEANING[term]!.normalize("NFD").replace(/\p{M}/gu, "") : answer } });
      n++;
    }
    expect(screen.getByText("Đã trả lời 4/4 câu")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));

    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("Đúng 2/4")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Làm lại 2 từ sai" })).toBeTruthy();
    expect(readState().cards.filter((c) => c.right === 1)).toHaveLength(2);
    expect(readState().cards.filter((c) => c.wrong === 1)).toHaveLength(2);
    // wrong ones show the right answer
    expect(container.querySelectorAll(".fc-q--bad .fc-q__correct")).toHaveLength(2);
  });

  it("grades a multiple choice question by the option picked", () => {
    const cards = seed();
    const { container } = render(wrap(<TestMode deckId="deck1" cards={cards} direction="term" />));
    for (const name of ["Đúng / Sai", "Điền đáp án", "Nối cặp"]) fireEvent.click(screen.getByLabelText(name));
    fireEvent.click(screen.getByLabelText("Tất cả trên một trang"));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu kiểm tra" }));
    const [first, second] = [...container.querySelectorAll(".fc-q")];
    const pick = (q: Element, text: string) => fireEvent.click(within(q as HTMLElement).getByRole("radio", { name: text }));
    pick(first!, MEANING[first!.querySelector(".fc-side__text")!.textContent!]!);
    const wrong = Object.values(MEANING).find((m) => m !== MEANING[second!.querySelector(".fc-side__text")!.textContent!])!;
    pick(second!, wrong);
    fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));
    expect(screen.getByText("Đúng 1/2")).toBeTruthy();
  });

  it("will not start without a question type", () => {
    render(wrap(<TestMode deckId="deck1" cards={seed()} direction="term" />));
    for (const name of ["Trắc nghiệm", "Đúng / Sai", "Điền đáp án", "Nối cặp"]) fireEvent.click(screen.getByLabelText(name));
    expect((screen.getByRole("button", { name: "Bắt đầu kiểm tra" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("MatchMode", () => {
  it("clears a matched pair, counts a wrong pair, and finishes when everything is matched", async () => {
    const cards = seed();
    render(wrap(<MatchMode deckId="deck1" cards={cards} direction="term" />));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    const tile = (text: string) => screen.getByRole("button", { name: text });

    fireEvent.click(tile("犬"));
    fireEvent.click(tile("mèo"));
    expect(screen.getByText("Nối sai: 1")).toBeTruthy();
    // wait for the red flash to clear before the next pick
    await waitFor(() => expect(tile("犬").className).not.toContain("is-wrong"));

    for (const term of Object.keys(MEANING)) {
      fireEvent.click(tile(term));
      fireEvent.click(tile(MEANING[term]!));
    }
    expect(screen.getByText("Xong rồi!")).toBeTruthy();
    expect(screen.getByText("Nối sai: 1", { selector: ".fc-result__score" })).toBeTruthy();
    expect(localStorage.getItem("jd.flash_best.v1")).toContain("deck1:match");
  });

  it("ignores a second tile of the same side", () => {
    render(wrap(<MatchMode deckId="deck1" cards={seed()} direction="term" />));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    fireEvent.click(screen.getByRole("button", { name: "犬" }));
    fireEvent.click(screen.getByRole("button", { name: "猫" }));
    expect(screen.getByText("Nối sai: 0")).toBeTruthy();
  });
});

describe("DropMode", () => {
  const optionFor = (text: string) =>
    [...document.querySelectorAll(".fc-drop__options button")].find((b) => b.textContent?.includes(text)) as HTMLElement;
  const current = () => document.querySelector(".fc-drop__word .fc-side__text")!.textContent!;
  const settle = () => act(async () => void vi.advanceTimersByTime(1100));

  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));

  it("scores a right answer and moves to the next word", async () => {
    render(wrap(<DropMode deckId="deck1" cards={seed()} direction="term" />));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    expect(screen.getByText("1 / 4")).toBeTruthy();
    fireEvent.click(optionFor(MEANING[current()]!));
    await settle();
    expect(screen.getByText("Điểm: 10")).toBeTruthy();
    expect(screen.getByText("2 / 4")).toBeTruthy();
  });

  it("takes a life for a wrong answer and for a word that reaches the ground, and ends at zero lives", async () => {
    render(wrap(<DropMode deckId="deck1" cards={seed()} direction="term" />));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    const wrongFor = () => Object.values(MEANING).find((m) => m !== MEANING[current()])!;

    fireEvent.click(optionFor(wrongFor()));
    // the right answer is shown while the word waits
    expect(document.querySelector(".fc-q__option.is-right")).toBeTruthy();
    await settle();
    expect(screen.getByLabelText("Còn 2 mạng")).toBeTruthy();

    fireEvent.animationEnd(document.querySelector(".fc-drop__word")!);
    await settle();
    expect(screen.getByLabelText("Còn 1 mạng")).toBeTruthy();

    fireEvent.click(optionFor(wrongFor()));
    await settle();
    expect(screen.getByText("Hết mạng rồi")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Chơi lại" })).toBeTruthy();
  });

  it("wins after the last word with lives left", async () => {
    render(wrap(<DropMode deckId="deck1" cards={seed()} direction="term" />));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    for (let i = 0; i < 4; i++) {
      fireEvent.click(optionFor(MEANING[current()]!));
      await settle();
    }
    expect(screen.getByText("Bạn đã vượt qua!")).toBeTruthy();
    expect(screen.getByText(/Đúng 4\/4 từ/)).toBeTruthy();
  });
});

describe("TestMode one question at a time", () => {
  const writeOnly = () => {
    for (const name of ["Trắc nghiệm", "Đúng / Sai", "Nối cặp"]) fireEvent.click(screen.getByLabelText(name));
  };

  it("is the default: one question shows, with next and previous, and submits on the last", () => {
    render(wrap(<TestMode deckId="deck1" cards={seed([["犬", "chó"], ["猫", "mèo"], ["水", "nước"]])} direction="term" />));
    expect((screen.getByLabelText("Từng câu một") as HTMLInputElement).checked).toBe(true);
    writeOnly();
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu kiểm tra" }));

    expect(document.querySelectorAll(".fc-q")).toHaveLength(1);
    expect(screen.getByText("Câu 1/3")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Câu trước" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Nộp bài" })).toBeNull();

    const answerHere = () => {
      const term = document.querySelector(".fc-q .fc-side__text")!.textContent!;
      fireEvent.change(document.querySelector(".fc-q input")!, { target: { value: MEANING[term]! } });
    };
    answerHere();
    fireEvent.click(screen.getByRole("button", { name: "Câu sau" }));
    expect(screen.getByText("Câu 2/3")).toBeTruthy();
    answerHere();
    // jump with the numbered dots, then back to the one left
    fireEvent.click(screen.getByRole("button", { name: "Đến câu 3" }));
    expect(screen.getByRole("button", { name: "Nộp bài" })).toBeTruthy();
    expect(screen.getByText("Đã trả lời 2/3 câu")).toBeTruthy();
    answerHere();
    fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));
    expect(screen.getByText("100%")).toBeTruthy();
    // the review lists every question
    expect(document.querySelectorAll(".fc-q")).toHaveLength(3);
  });

  it("moves on with Enter in the answer box", () => {
    render(wrap(<TestMode deckId="deck1" cards={seed()} direction="term" />));
    writeOnly();
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu kiểm tra" }));
    fireEvent.keyDown(document.querySelector(".fc-q input")!, { key: "Enter" });
    expect(screen.getByText("Câu 2/4")).toBeTruthy();
  });
});

describe("MemoryMode", () => {
  it("keeps a matched pair face up, turns a mismatch back, and finishes with stars", async () => {
    render(wrap(<MemoryMode deckId="deck1" cards={seed()} direction="term" />));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    const down = () => screen.getAllByRole("button", { name: /Thẻ úp/ });
    expect(down()).toHaveLength(8);
    const tileFor = (text: string) => [...document.querySelectorAll(".fc-mem")].find((b) => b.querySelector(".fc-mem__back")?.textContent === text) as HTMLElement;

    // a wrong pair counts a mistake and turns back
    fireEvent.click(tileFor("犬"));
    fireEvent.click(tileFor("mèo"));
    expect(screen.getByText("Lật sai: 1")).toBeTruthy();
    await waitFor(() => expect(down()).toHaveLength(8), { timeout: 2000 });

    for (const term of Object.keys(MEANING)) {
      fireEvent.click(tileFor(term));
      fireEvent.click(tileFor(MEANING[term]!));
      // the last pair swaps the board for the result
      await waitFor(() => expect(!tileFor(term) || tileFor(term).className.includes("is-done")).toBe(true), { timeout: 2000 });
    }
    expect(await screen.findByText("Tìm đủ các cặp!")).toBeTruthy();
    expect(screen.getByRole("img", { name: /sao/ })).toBeTruthy();
    expect(localStorage.getItem("jd.flash_best.v1")).toContain("deck1:memory");
  });
});

describe("BlitzMode", () => {
  const optionFor = (text: string) => [...document.querySelectorAll(".fc-drop__options button")].find((b) => b.textContent?.includes(text)) as HTMLElement;
  const current = () => document.querySelector(".fc-blitz__prompt .fc-side__text")!.textContent!;
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));

  it("scores right answers with a growing combo and takes time off a wrong one", async () => {
    render(wrap(<BlitzMode deckId="deck1" cards={seed()} direction="term" />));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    for (let i = 0; i < 4; i++) {
      fireEvent.click(optionFor(MEANING[current()]!));
      await act(async () => void vi.advanceTimersByTime(400));
    }
    // 10 + 10 + 10 + 20
    expect(screen.getByText("Điểm: 50")).toBeTruthy();
    expect(document.querySelector(".fc-combo")?.textContent).toBe("Combo x2");

    const before = Number(document.querySelector(".fc-blitz__time")!.textContent!.trim());
    const wrong = Object.values(MEANING).find((m) => m !== MEANING[current()])!;
    fireEvent.click(optionFor(wrong));
    await act(async () => void vi.advanceTimersByTime(700));
    const after = Number(document.querySelector(".fc-blitz__time")!.textContent!.trim());
    expect(before - after).toBeGreaterThanOrEqual(3);
    expect(document.querySelector(".fc-combo")).toBeNull();
  });

  it("ends when the minute is up and remembers the high score", async () => {
    render(wrap(<BlitzMode deckId="deck1" cards={seed()} direction="term" />));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    fireEvent.click(optionFor(MEANING[current()]!));
    await act(async () => void vi.advanceTimersByTime(61000));
    expect(screen.getByText("Hết giờ!")).toBeTruthy();
    expect(screen.getByText("Đúng 1 · sai 0 · chuỗi đúng dài nhất 1")).toBeTruthy();
    expect(screen.getByText("Điểm cao mới!")).toBeTruthy();
  });
});

describe("MillionaireMode", () => {
  const MORE: Array<[string, string]> = [["犬", "chó"], ["猫", "mèo"], ["水", "nước"], ["火", "lửa"], ["木", "cây"], ["山", "núi"]];
  const deck = () => seed(MORE);
  const MEANINGS: Record<string, string> = Object.fromEntries(MORE);
  const answers = () => [...document.querySelectorAll<HTMLButtonElement>(".fc-mil__ans")];
  const promptNow = () => document.querySelector(".fc-mil__question .fc-side__text")!.textContent!;
  const rightIndex = () => answers().findIndex((b) => b.querySelector(".fc-side__text")!.textContent === MEANINGS[promptNow()]);
  const wrongIndex = () => answers().findIndex((b, i) => i !== rightIndex() && !b.className.includes("is-removed"));
  const frames = (ms: number) => act(async () => void vi.advanceTimersByTime(ms));
  const play = () => fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
  /** Picks an answer and sits through the suspense and the reveal. */
  const answer = async (i: number, then = 1800) => {
    fireEvent.click(answers()[i]!);
    await frames(1400);
    await frames(then);
    // a safe level stops on its card; carry on from it
    const card = screen.queryByRole("dialog", { name: "Mốc an toàn" });
    if (card) fireEvent.click(within(card).getByRole("button", { name: "Chơi tiếp" }));
  };
  const life = (name: RegExp) => screen.getByRole("button", { name }) as HTMLButtonElement;
  beforeEach(() => vi.useFakeTimers());

  it("explains the show, with the clock on by default and a way to turn it off", () => {
    render(wrap(<MillionaireMode deckId="deck1" cards={deck()} direction="term" />));
    expect(screen.getByText(/Câu 5 và câu 10 là mốc an toàn/)).toBeTruthy();
    const timer = screen.getByLabelText("Tính giờ 30 giây cho mỗi câu") as HTMLInputElement;
    expect(timer.checked).toBe(true);
    fireEvent.click(timer);
    expect(localStorage.getItem("jd.flash_mil_timer.v1")).toBe("off");
    play();
    expect(document.querySelector(".fc-mil__clock")).toBeNull();
  });

  it("shows question 1 of 15 with four lettered answers, the lifelines and the prize ladder", () => {
    render(wrap(<MillionaireMode deckId="deck1" cards={deck()} direction="term" />));
    play();
    expect(screen.getByText("Câu 1/15")).toBeTruthy();
    expect(document.querySelector(".fc-mil__worth")!.textContent).toBe("200.000");
    expect(answers().map((b) => b.querySelector(".fc-mil__letter")!.textContent)).toEqual(["A", "B", "C", "D"]);
    expect(screen.getAllByRole("button", { name: /50:50|khán giả|người thân|Đổi câu hỏi/ })).toHaveLength(4);
    const rungs = [...document.querySelectorAll(".fc-mil__ladder li")];
    expect(rungs).toHaveLength(15);
    expect(rungs[0]!.textContent).toContain("250.000.000");
    expect(rungs[14]!.textContent).toContain("200.000");
    expect(document.querySelector(".fc-mil__ladder .is-current")!.textContent).toContain("200.000");
    expect(document.querySelectorAll(".fc-mil__ladder .is-safe")).toHaveLength(2);
    expect(document.querySelector(".fc-mil__clock")!.textContent).toBe("30");
  });

  it("locks an answer with a moment's suspense, then shows it right and climbs to question 2", async () => {
    render(wrap(<MillionaireMode deckId="deck1" cards={deck()} direction="term" />));
    play();
    const right = rightIndex();
    fireEvent.click(answers()[right]!);
    expect(answers()[right]!.className).toContain("is-locked");
    expect(screen.getByRole("status").textContent).toContain("Khóa đáp án");
    // nothing else can be picked meanwhile
    expect(answers().every((b) => b.disabled)).toBe(true);
    await frames(1400);
    expect(answers()[right]!.className).toContain("is-right");
    expect(screen.getByRole("status").textContent).toBe("Chính xác!");
    await frames(1800);
    expect(screen.getByText("Câu 2/15")).toBeTruthy();
    expect(document.querySelector(".fc-mil__worth")!.textContent).toBe("400.000");
    expect(document.querySelector(".fc-mil__ladder .is-done")).toBeTruthy();
  });

  it("answers from the keyboard", async () => {
    render(wrap(<MillionaireMode deckId="deck1" cards={deck()} direction="term" />));
    play();
    fireEvent.keyDown(window, { key: String(rightIndex() + 1) });
    await frames(1400);
    expect(document.querySelector(".fc-mil__ans.is-right")).toBeTruthy();
    await frames(1800);
    fireEvent.keyDown(window, { key: "abcd"[rightIndex()]! });
    expect(document.querySelector(".fc-mil__ans.is-locked")).toBeTruthy();
  });

  it("a wrong answer shows the right one, then ends with no prize before the first safe level", async () => {
    render(wrap(<MillionaireMode deckId="deck1" cards={deck()} direction="term" />));
    play();
    const right = rightIndex();
    const wrong = wrongIndex();
    fireEvent.click(answers()[wrong]!);
    await frames(1400);
    expect(answers()[wrong]!.className).toContain("is-wrong");
    expect(answers()[right]!.className).toContain("is-right");
    expect(screen.getByRole("status").textContent).toContain("đáp án đúng là");
    await frames(2500);
    expect(screen.getByText("Rất tiếc, bạn đã trả lời sai")).toBeTruthy();
    expect(document.querySelector(".fc-result__big")!.textContent).toBe("0");
    expect(screen.getByText("Trả lời đúng 0/15 câu.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Chơi lại" })).toBeTruthy();
  });

  it("keeps the safe prize after question 5 when a later answer is wrong", async () => {
    render(wrap(<MillionaireMode deckId="deck1" cards={deck()} direction="term" />));
    play();
    for (let q = 0; q < 5; q++) await answer(rightIndex());
    expect(screen.getByText("Câu 6/15")).toBeTruthy();
    await answer(wrongIndex(), 2600);
    expect(document.querySelector(".fc-result__big")!.textContent).toBe("2.000.000");
    expect(screen.getByText("Bạn nhận được 2.000.000 điểm thưởng.")).toBeTruthy();
    expect(screen.getByText("Trả lời đúng 5/15 câu.")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("jd.flash_best.v1")!)["deck1:millionaire2"]).toBe(2_000_000);
  });

  it("stops on a card at each safe level, saying what is now certain, and goes on when asked", async () => {
    render(wrap(<MillionaireMode deckId="deck1" cards={deck()} direction="term" />));
    play();
    for (let q = 0; q < 4; q++) await answer(rightIndex());
    // no card between safe levels
    expect(screen.queryByRole("dialog", { name: "Mốc an toàn" })).toBeNull();
    expect(screen.getByText("Câu 5/15")).toBeTruthy();
    expect(screen.getByText("Câu hỏi mốc")).toBeTruthy();

    fireEvent.click(answers()[rightIndex()]!);
    await frames(1400);
    await frames(1800);
    let card = screen.getByRole("dialog", { name: "Mốc an toàn" });
    expect(card.textContent).toContain("Chúc mừng! Bạn đã vượt qua câu 5");
    expect(card.querySelector(".fc-mil__chequeprize")!.textContent).toBe("2.000.000");
    expect(card.textContent).toContain("Mốc tiếp theo: 22.000.000");
    // the game waits on the card: no question 6 yet, and the answers cannot be touched
    expect(screen.queryByText("Câu 6/15")).toBeNull();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(screen.queryByRole("dialog", { name: "Mốc an toàn" })).toBeNull();
    expect(screen.getByText("Câu 6/15")).toBeTruthy();

    for (let q = 0; q < 4; q++) await answer(rightIndex());
    fireEvent.click(answers()[rightIndex()]!);
    await frames(1400);
    await frames(1800);
    card = screen.getByRole("dialog", { name: "Mốc an toàn" });
    expect(card.querySelector(".fc-mil__chequeprize")!.textContent).toBe("22.000.000");
    expect(card.textContent).toContain("Giải thưởng lớn nhất: 250.000.000");
    fireEvent.click(within(card).getByRole("button", { name: "Chơi tiếp" }));
    expect(screen.getByText("Câu 11/15")).toBeTruthy();
  });

  it("50:50 takes away two wrong answers and never the right one, once", async () => {
    render(wrap(<MillionaireMode deckId="deck1" cards={deck()} direction="term" />));
    play();
    const right = rightIndex();
    fireEvent.click(life(/50:50/));
    const gone = answers().filter((b) => b.className.includes("is-removed"));
    expect(gone).toHaveLength(2);
    expect(answers()[right]!.className).not.toContain("is-removed");
    expect(life(/50:50/).disabled).toBe(true);
    expect(life(/50:50/).getAttribute("aria-label")).toContain("đã dùng");
    // the next question has all four again, and the lifeline stays used
    await answer(right);
    expect(answers().filter((b) => b.className.includes("is-removed"))).toHaveLength(0);
    expect(life(/50:50/).disabled).toBe(true);
  });

  it("ask the audience shows votes that add up to 100 and pauses the clock while it is open", async () => {
    render(wrap(<MillionaireMode deckId="deck1" cards={deck()} direction="term" />));
    play();
    await frames(5000);
    fireEvent.click(life(/khán giả/));
    const dialog = screen.getByRole("dialog", { name: "Khán giả bình chọn" });
    const votes = [...dialog.querySelectorAll(".fc-mil__bar b")].map((b) => Number(b.textContent!.replace("%", "")));
    expect(votes).toHaveLength(4);
    expect(votes.reduce((a, b) => a + b, 0)).toBe(100);
    expect(Math.max(...votes)).toBe(votes[rightIndex()]);
    const shown = document.querySelector(".fc-mil__clock")!.textContent;
    await frames(10000);
    expect(document.querySelector(".fc-mil__clock")!.textContent).toBe(shown);
    fireEvent.click(within(dialog).getByRole("button", { name: "Đóng" }));
    await frames(1000);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(Number(document.querySelector(".fc-mil__clock")!.textContent)).toBeGreaterThan(Number(shown) - 3);
  });

  it("phone a friend: thinking dots first, then a lettered answer", async () => {
    render(wrap(<MillionaireMode deckId="deck1" cards={deck()} direction="term" />));
    play();
    fireEvent.click(life(/người thân/));
    const dialog = screen.getByRole("dialog", { name: "Người thân của bạn nói" });
    expect(within(dialog).getByLabelText("Đang suy nghĩ")).toBeTruthy();
    expect((within(dialog).getByRole("button", { name: "Đóng" }) as HTMLButtonElement).disabled).toBe(true);
    await frames(1700);
    expect(dialog.querySelector(".fc-mil__speech")!.textContent).toMatch(/[ABCD]/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Đóng" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("swap gives another question at the same prize", () => {
    render(wrap(<MillionaireMode deckId="deck1" cards={deck()} direction="term" />));
    play();
    const before = promptNow();
    fireEvent.click(life(/Đổi câu hỏi/));
    expect(promptNow()).not.toBe(before);
    expect(screen.getByText("Câu 1/15")).toBeTruthy();
    expect(life(/Đổi câu hỏi/).disabled).toBe(true);
  });

  it("walking away asks first, then pays what is in hand", async () => {
    render(wrap(<MillionaireMode deckId="deck1" cards={deck()} direction="term" />));
    play();
    expect((screen.getByRole("button", { name: /Dừng cuộc chơi/ }) as HTMLButtonElement).disabled).toBe(true);
    await answer(rightIndex());
    await answer(rightIndex());
    fireEvent.click(screen.getByRole("button", { name: /Dừng cuộc chơi, nhận 400.000/ }));
    const dialog = screen.getByRole("dialog", { name: "Dừng cuộc chơi?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Chơi tiếp" }));
    expect(screen.getByText("Câu 3/15")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Dừng cuộc chơi, nhận 400.000/ }));
    fireEvent.click(screen.getByRole("button", { name: "Dừng và nhận thưởng" }));
    expect(screen.getByText("Bạn đã dừng cuộc chơi")).toBeTruthy();
    expect(document.querySelector(".fc-result__big")!.textContent).toBe("400.000");
  });

  it("runs out of time: the answer is shown and the game ends", async () => {
    render(wrap(<MillionaireMode deckId="deck1" cards={deck()} direction="term" />));
    play();
    await frames(31000);
    expect(document.querySelector(".fc-mil__ans.is-right")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Hết giờ rồi!");
    await frames(2600);
    expect(screen.getByText("Hết giờ!")).toBeTruthy();
  });

  it("shows where you are on the ladder as dots too, for when there is no room for the ladder", async () => {
    render(wrap(<MillionaireMode deckId="deck1" cards={deck()} direction="term" />));
    play();
    const dots = () => [...document.querySelectorAll(".fc-mil__dots li")];
    expect(dots()).toHaveLength(15);
    expect(dots()[0]!.className).toContain("is-current");
    expect(dots().filter((d) => d.className.includes("is-safe"))).toHaveLength(2);
    await answer(rightIndex());
    await answer(rightIndex());
    expect(dots()[0]!.className).toContain("is-done");
    expect(dots()[1]!.className).toContain("is-done");
    expect(dots()[2]!.className).toContain("is-current");
  });

  it("never scrolls the stage: the stage clips its contents, and scrolling one into view would slide the whole game aside", async () => {
    const spy = vi.fn();
    Element.prototype.scrollIntoView = spy;
    render(wrap(<MillionaireMode deckId="deck1" cards={deck()} direction="term" />));
    play();
    for (let q = 0; q < 3; q++) await answer(rightIndex());
    expect(spy).not.toHaveBeenCalled();
    const stage = document.querySelector<HTMLElement>(".fc-mil__stage")!;
    expect(stage.scrollLeft).toBe(0);
    // @ts-expect-error restoring jsdom's lack of the method
    delete Element.prototype.scrollIntoView;
  });

  it("a deck smaller than fifteen words still gives fifteen questions, never the same card twice running", async () => {
    render(wrap(<MillionaireMode deckId="deck1" cards={deck()} direction="term" />));
    play();
    let last = "";
    for (let q = 0; q < 15; q++) {
      const p = promptNow();
      if (q > 0) expect(p).not.toBe(last);
      last = p;
      await answer(rightIndex(), 1800);
    }
    expect(screen.getByText("Chúc mừng! Bạn là triệu phú!")).toBeTruthy();
    expect(document.querySelector(".fc-result__big")!.textContent).toBe("250.000.000");
    expect(screen.getByRole("img", { name: /3/ })).toBeTruthy();
  });
});

describe("MinerMode", () => {
  const nuggetButtons = () => [...document.querySelectorAll<HTMLElement>("button.fc-miner__nugget:not(.fc-miner__carry)")];
  const textOf = (b: Element) => b.querySelector(".fc-side__text")!.textContent!;
  const valueOf = (b: Element) => Number(b.querySelector(".fc-miner__value")!.textContent!.replace("+", ""));
  const prompt = () => document.querySelector(".fc-shoot__prompt .fc-side__text")!.textContent!;
  const frames = (ms: number) => act(async () => void vi.advanceTimersByTime(ms));
  const rightOne = () => nuggetButtons().find((b) => textOf(b) === MEANING[prompt()])!;
  const wrongOne = () => nuggetButtons().find((b) => textOf(b) !== MEANING[prompt()])!;
  const feedbackShown = () => !!document.querySelector(".fc-miner__carry.is-right, .fc-miner__carry.is-wrong");
  /** Lets the claw run until it is back with something and the verdict shows (or until it is back empty). */
  const untilJudged = async () => {
    for (let i = 0; i < 60 && !feedbackShown(); i++) await frames(100);
  };
  const play = () => fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
  beforeEach(() => vi.useFakeTimers());

  it("explains the rules and what each treasure is worth before starting", () => {
    render(wrap(<MinerMode deckId="deck1" cards={seed()} direction="term" />));
    const legend = screen.getByRole("list", { name: "Các loại báu vật và điểm" });
    expect([...legend.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
      "Vàng+10", "Bạc+12", "Ngọc lục bảo+16", "Hồng ngọc+20", "Rương báu+25", "Kim cương+30",
    ]);
    expect(screen.getByText(/Thuốc nổ \(phím D\)/)).toBeTruthy();
  });

  it("starts at level 1 with a target, a clock, three lives and three dynamite, and the old miner by the winch", () => {
    render(wrap(<MinerMode deckId="deck1" cards={seed()} direction="term" />));
    play();
    expect(screen.getByText("Mục tiêu")).toBeTruthy();
    expect(document.querySelector(".fc-mhud__sign strong")!.textContent).toBe("0/100");
    expect(screen.getByText("Màn 1")).toBeTruthy();
    expect(screen.getByLabelText("Còn 50 giây")).toBeTruthy();
    expect(screen.getByLabelText("Còn 3 mạng")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Thuốc nổ, còn 3" })).toBeTruthy();
    expect(document.querySelector(".fc-miner__man img")!.getAttribute("src")).toBe("/miner/old-miner.webp");
    expect(document.querySelector(".fc-miner__winch")).toBeTruthy();
    // four nuggets, each its own kind of treasure with its worth on it
    expect(nuggetButtons()).toHaveLength(4);
    for (const b of nuggetButtons()) expect([10, 12, 16, 20, 25, 30]).toContain(valueOf(b));
  });

  it("shrinks the field to the window's height so the whole of it is on screen, and leaves it alone when there is room", () => {
    const heights = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("fc-miner__scene") ? 620 : 900; // the field, and the whole game around it
    });
    const widths = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
    const inner = window.innerHeight;
    try {
      // 700 high: 700 - header (72 + 8) - the 280 around the field - 16 = 324 for the field, which is 522 wide at 100:62
      Object.defineProperty(window, "innerHeight", { configurable: true, value: 700 });
      render(wrap(<MinerMode deckId="deck1" cards={seed()} direction="term" />));
      play();
      const field = document.querySelector<HTMLElement>(".fc-miner__scene")!;
      expect(field.style.maxWidth).toBe("522px");
      expect(field.style.marginInline).toBe("auto");
      cleanup();

      Object.defineProperty(window, "innerHeight", { configurable: true, value: 1400 });
      render(wrap(<MinerMode deckId="deck1" cards={seed()} direction="term" />));
      play();
      expect(document.querySelector<HTMLElement>(".fc-miner__scene")!.style.maxWidth).toBe("");
    } finally {
      Object.defineProperty(window, "innerHeight", { configurable: true, value: inner });
      heights.mockRestore();
      widths.mockRestore();
    }
  });

  it("tapping a nugget sends the claw straight to it, even one off to the side, and pays what it is worth", async () => {
    render(wrap(<MinerMode deckId="deck1" cards={seed()} direction="term" />));
    play();
    // the right answer, wherever it is, is reached with one tap
    const right = rightOne();
    const worth = valueOf(right);
    fireEvent.click(right);
    await untilJudged();
    expect(document.querySelector(".fc-miner__carry.is-right")).toBeTruthy();
    // worth + 10 for a quick haul
    expect(screen.getByText(`Điểm: ${worth + 10}`)).toBeTruthy();
    expect(document.querySelector(".fc-mhud__sign strong")!.textContent).toBe(`${worth + 10}/100`);
    await frames(1000);
    expect(document.querySelector(".fc-miner__carry")).toBeNull();
  });

  it("a wrong haul costs a life and no points", async () => {
    render(wrap(<MinerMode deckId="deck1" cards={seed()} direction="term" />));
    play();
    fireEvent.click(wrongOne());
    await untilJudged();
    expect(document.querySelector(".fc-miner__carry.is-wrong")).toBeTruthy();
    expect(screen.getByLabelText("Còn 2 mạng")).toBeTruthy();
    expect(screen.getByText("Điểm: 0")).toBeTruthy();
  });

  it("dynamite blows up a wrong haul in time: no life lost, one stick used, and the question stays", async () => {
    render(wrap(<MinerMode deckId="deck1" cards={seed()} direction="term" />));
    play();
    const before = prompt();
    const boom = screen.getByRole("button", { name: "Thuốc nổ, còn 3" }) as HTMLButtonElement;
    expect(boom.disabled).toBe(true);
    fireEvent.click(wrongOne());
    // wait until the claw has hold of it and is on its way back
    for (let i = 0; i < 40 && !document.querySelector(".fc-miner__carry"); i++) await frames(50);
    expect(document.querySelector(".fc-miner__carry")).toBeTruthy();
    const ready = screen.getByRole("button", { name: "Thuốc nổ, còn 3" }) as HTMLButtonElement;
    expect(ready.disabled).toBe(false);
    fireEvent.click(ready);
    expect(screen.getByRole("button", { name: "Thuốc nổ, còn 2" })).toBeTruthy();
    expect(document.querySelector(".fc-miner__carry")).toBeNull();
    expect(document.querySelector(".fc-miner__boom")).toBeTruthy();
    await frames(2500);
    expect(screen.getByLabelText("Còn 3 mạng")).toBeTruthy();
    expect(prompt()).toBe(before);
    expect(nuggetButtons().every((b) => !b.className.includes("is-taken"))).toBe(true);
  });

  it("dropping the claw yourself still works and catches what is under it", async () => {
    render(wrap(<MinerMode deckId="deck1" cards={seed()} direction="term" />));
    play();
    const underClaw = nuggetButtons()[0]!;
    const right = textOf(underClaw) === MEANING[prompt()];
    fireEvent.keyDown(window, { key: " " });
    await untilJudged();
    expect(document.querySelector(right ? ".fc-miner__carry.is-right" : ".fc-miner__carry.is-wrong")).toBeTruthy();
  });

  it("the number keys aim at a nugget and D uses dynamite", async () => {
    render(wrap(<MinerMode deckId="deck1" cards={seed()} direction="term" />));
    play();
    fireEvent.keyDown(window, { key: "2" });
    await frames(700);
    expect(document.querySelector(".fc-miner__carry")).toBeTruthy();
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByRole("button", { name: "Thuốc nổ, còn 2" })).toBeTruthy();
  });

  it("clears a level on reaching the target, shows the bonus, and the next level asks for more with perks", async () => {
    render(wrap(<MinerMode deckId="deck1" cards={seed()} direction="term" />));
    play();
    for (let q = 0; q < 12 && !document.querySelector('[role="dialog"]'); q++) {
      fireEvent.click(rightOne());
      await untilJudged();
      await frames(900);
    }
    const card = screen.getByRole("dialog", { name: "Qua màn 1!" });
    expect(within(card).getByText(/Điểm màn này: \d+/)).toBeTruthy();
    expect(within(card).getByText(/Thưởng thời gian: \+\d+ điểm/)).toBeTruthy();
    const bonus = Number(within(card).getByText(/Thưởng thời gian/).textContent!.match(/\+(\d+)/)![1]);
    expect(bonus).toBeGreaterThan(0);
    fireEvent.click(within(card).getByRole("button", { name: "Sang màn 2" }));
    expect(screen.getByText("Màn 2")).toBeTruthy();
    expect(document.querySelector(".fc-mhud__sign strong")!.textContent).toBe("0/180");
    expect(screen.getByRole("button", { name: "Thuốc nổ, còn 4" })).toBeTruthy();
    expect(screen.getByLabelText("Còn 53 giây")).toBeTruthy();
    // the total carries over: the first level's points plus the time bonus
    const total = Number(screen.getByText(/^Điểm: \d+$/).textContent!.replace("Điểm: ", ""));
    expect(total).toBeGreaterThanOrEqual(100 + bonus);
  });

  it("ends when the clock runs out short of the target", async () => {
    render(wrap(<MinerMode deckId="deck1" cards={seed()} direction="term" />));
    play();
    await frames(51000);
    expect(screen.getByText("Hết giờ!")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Chơi lại" })).toBeTruthy();
    expect(screen.getByText(/Màn 1 · đúng 0 · sai 0/)).toBeTruthy();
  });

  it("ends at no lives and keeps the high score", async () => {
    render(wrap(<MinerMode deckId="deck1" cards={seed()} direction="term" />));
    play();
    for (let q = 0; q < 3; q++) {
      fireEvent.click(wrongOne());
      await untilJudged();
      await frames(1100);
    }
    expect(screen.getByText("Hết mạng rồi")).toBeTruthy();
    expect(screen.getByText(/sai 3/)).toBeTruthy();
    expect(localStorage.getItem("jd.flash_best.v1")).toContain("deck1:miner");
  });

  it("an empty drop comes back and nothing is lost", async () => {
    render(wrap(<MinerMode deckId="deck1" cards={seed()} direction="term" />));
    play();
    // swing to the far edge where nothing hangs, and drop
    await frames(700);
    fireEvent.click(document.querySelector(".fc-miner__scene")!);
    await frames(3500);
    expect(screen.getByLabelText(/Còn \d mạng/)).toBeTruthy();
    expect(screen.getByText(/^Điểm: \d+$/)).toBeTruthy();
  });
});

describe("pages", () => {
  const AppShellMock = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  void AppShellMock;

  it("the create page lists every word already in the deck and points out the new one", async () => {
    const { FlashcardCreatePage } = await import("../../pages/FlashcardCreatePage");
    seed();
    searchDictionary.mockResolvedValue({ query: "", lang: "ja", entries: [], kanji: [] });
    render(
      <MemoryRouter initialEntries={["/flashcards/create?deck=deck1"]}>
        <UiLanguageProvider>
          <Routes>
            <Route path="/flashcards/create" element={<FlashcardCreatePage />} />
          </Routes>
        </UiLanguageProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("Các từ trong bộ (4)")).toBeTruthy();
    expect(screen.getByText("犬")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Từ"), { target: { value: "木" } });
    fireEvent.change(screen.getByLabelText("Nghĩa"), { target: { value: "cây" } });
    fireEvent.click(screen.getByRole("button", { name: "Thêm thẻ" }));
    expect(screen.getByText("Các từ trong bộ (5)")).toBeTruthy();
    expect(screen.getByText("Mới thêm")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Mở bộ thẻ" })).toBeTruthy();
  });

  it("the deck list shows the kanji alone and the reading in front of its meaning", async () => {
    const { FlashcardDeckPage } = await import("../../pages/FlashcardDeckPage");
    const d = createDeck("Bộ đọc", "deck1");
    addCard({ deckId: d.id, term: "購入", definition: "mua; mua sắm", reading: "こうにゅう", ...base });
    render(
      <MemoryRouter initialEntries={["/flashcards/deck1"]}>
        <UiLanguageProvider>
          <Routes>
            <Route path="/flashcards/:deckId" element={<FlashcardDeckPage />} />
          </Routes>
        </UiLanguageProvider>
      </MemoryRouter>,
    );
    const row = document.querySelector(".fc-row")!;
    expect(row.querySelectorAll(".fc-side__text")[0]!.textContent).toBe("購入");
    expect(row.querySelectorAll(".fc-side__text")[1]!.textContent).toBe("こうにゅう: mua; mua sắm");
    expect(row.querySelector(".fc-side__reading")).toBeNull();
  });

  it("the deck page counts words and searches them", async () => {
    const { FlashcardDeckPage } = await import("../../pages/FlashcardDeckPage");
    seed();
    render(
      <MemoryRouter initialEntries={["/flashcards/deck1"]}>
        <UiLanguageProvider>
          <Routes>
            <Route path="/flashcards/:deckId" element={<FlashcardDeckPage />} />
          </Routes>
        </UiLanguageProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("4 từ")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Lật hình/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Đua thời gian/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Ai là triệu phú/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Đào vàng/ })).toBeTruthy();
    const search = screen.getByRole("searchbox", { name: "Tìm từ trong bộ" });
    fireEvent.change(search, { target: { value: "mèo" } });
    expect(screen.getByText("猫")).toBeTruthy();
    expect(screen.queryByText("犬")).toBeNull();
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText("Không có từ nào khớp “zzz”.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xóa tìm kiếm" }));
    expect(screen.getByText("犬")).toBeTruthy();
  });
});

describe("readings next to the meaning", () => {
  const withReading = () => {
    const d = createDeck("Bộ đọc", "deck1");
    addCard({ deckId: d.id, term: "購入", definition: "mua; mua sắm", reading: "こうにゅう", ...base });
    return readState().cards;
  };

  it("the study card hides the reading on the kanji question and shows it with the meaning", () => {
    render(wrap(<LearnMode deckId="deck1" cards={withReading()} direction="term" />));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    expect(screen.getByText("購入")).toBeTruthy();
    expect(screen.queryByText("こうにゅう")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Lật thẻ" }));
    expect(document.querySelector(".fc-flash__side--back .fc-side__text")!.textContent).toBe("こうにゅう: mua; mua sắm");
  });

  it("a multiple choice question shows the kanji alone and readings before meaning choices", () => {
    const d = readState().decks[0] ?? createDeck("Bộ", "deck1");
    void d;
    const cards = (() => {
      const deck = createDeck("Bộ đọc 2", "deck2");
      addCard({ deckId: deck.id, term: "購入", definition: "mua", reading: "こうにゅう", ...base });
      addCard({ deckId: deck.id, term: "犬", definition: "chó", reading: "いぬ", ...base });
      return readState().cards.filter((c) => c.deckId === "deck2");
    })();
    const { container } = render(wrap(<TestMode deckId="deck2" cards={cards} direction="term" />));
    for (const name of ["Đúng / Sai", "Điền đáp án", "Nối cặp"]) fireEvent.click(screen.getByLabelText(name));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu kiểm tra" }));
    expect(container.querySelector(".fc-q__prompt .fc-side__lead")).toBeNull();
    expect(container.querySelector(".fc-q__prompt .fc-side__reading")).toBeNull();
    expect(container.querySelector(".fc-q__options")!.textContent).toContain("こうにゅう: mua");
    expect(container.querySelector(".fc-q__options")!.textContent).toContain("いぬ: chó");
  });
});

describe("hiragana display preference for tests and games", () => {
  function readingCards() {
    const deck = createDeck("Bộ đọc", "deck1");
    for (const [term, definition, reading] of [["購入", "mua", "こうにゅう"], ["犬", "chó", "いぬ"], ["猫", "mèo", "ねこ"], ["水", "nước", "みず"]]) {
      addCard({ deckId: deck.id, term: term!, definition: definition!, reading, ...base });
    }
    return readState().cards;
  }

  it.each(["mc", "tf", "match"] as const)("shows readings for %s questions by default and remembers turning them off", (kind) => {
    const cards = readingCards();
    const begin = () => {
      const labels = { mc: "Trắc nghiệm", tf: "Đúng / Sai", match: "Nối cặp", write: "Điền đáp án" };
      for (const [key, label] of Object.entries(labels)) if (key !== kind) fireEvent.click(screen.getByLabelText(label));
      fireEvent.click(screen.getByRole("button", { name: "Bắt đầu kiểm tra" }));
    };
    const { unmount } = render(wrap(<StudyModes deckId="deck1" cards={cards} mode="test" />));
    expect(screen.getByRole("radio", { name: "Có Hiragana" }).getAttribute("aria-checked")).toBe("true");
    begin();
    const meaningTexts = () => kind === "match"
      ? [...document.querySelectorAll(".fc-q__match option")].map((o) => o.textContent).join(" ")
      : document.querySelector(".fc-q")!.textContent!;
    expect(meaningTexts()).toMatch(/(こうにゅう: mua|いぬ: chó|ねこ: mèo|みず: nước)/);

    fireEvent.click(screen.getByRole("radio", { name: "Không Hiragana" }));
    expect(meaningTexts()).not.toMatch(/こうにゅう|いぬ|ねこ|みず/);
    unmount();

    render(wrap(<StudyModes deckId="deck1" cards={cards} mode="test" />));
    expect(screen.getByRole("radio", { name: "Không Hiragana" }).getAttribute("aria-checked")).toBe("true");
    begin();
    expect(meaningTexts()).not.toMatch(/こうにゅう|いぬ|ねこ|みず/);
  });

  it.each(["match", "memory", "drop", "blitz", "millionaire", "miner"] as const)("shows readings in %s and allows disabling them before starting", (mode) => {
    const cards = readingCards();
    const { unmount } = render(wrap(<StudyModes deckId="deck1" cards={cards} mode={mode} />));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    const leads = [...document.querySelectorAll(".fc-side__lead")];
    expect(leads.length).toBeGreaterThan(0);
    for (const lead of leads) expect(lead.parentElement!.textContent).toMatch(/(こうにゅう: mua|いぬ: chó|ねこ: mèo|みず: nước)/);
    unmount();

    render(wrap(<StudyModes deckId="deck1" cards={cards} mode={mode} />));
    fireEvent.click(screen.getByRole("radio", { name: "Không Hiragana" }));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    expect(document.querySelector(".fc-side__lead")).toBeNull();
    expect(document.querySelector(".fc-side__colon")).toBeNull();
  });
});

describe("Sino-Vietnamese reading on cards", () => {
  const withHv = () => {
    const d = createDeck("Bộ Hán Việt", "deck1");
    addCard({ deckId: d.id, term: "購入", definition: "mua; mua sắm", reading: "こうにゅう", hanViet: "CẤU NHẬP", ...base });
    return readState().cards;
  };
  const deckPage = async () => {
    const { FlashcardDeckPage } = await import("../../pages/FlashcardDeckPage");
    return (
      <MemoryRouter initialEntries={["/flashcards/deck1"]}>
        <UiLanguageProvider>
          <Routes>
            <Route path="/flashcards/:deckId" element={<FlashcardDeckPage />} />
          </Routes>
        </UiLanguageProvider>
      </MemoryRouter>
    );
  };

  it("shows it at the end of the meaning, and the two options switch it off and on", async () => {
    withHv();
    render(await deckPage());
    expect(document.querySelector(".fc-row .fc-side__trail")?.textContent).toBe("CẤU NHẬP");
    expect(screen.getByRole("radio", { name: "Có Hán Việt" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "Không Hán Việt" }));
    expect(document.querySelector(".fc-side__trail")).toBeNull();
    expect(localStorage.getItem("jd.flash_hv.v1")).toBe("off");
    fireEvent.click(screen.getByRole("radio", { name: "Có Hán Việt" }));
    expect(document.querySelector(".fc-side__trail")?.textContent).toBe("CẤU NHẬP");
  });

  it("the study card shows it on the answer side and respects the option", () => {
    render(wrap(<LearnMode deckId="deck1" cards={withHv()} direction="term" />));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    expect(document.querySelector(".fc-side__trail")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Lật thẻ" }));
    expect(document.querySelector(".fc-flash .fc-side__trail")?.textContent).toBe("CẤU NHẬP");
  });

  it("does not show it when the option is off", () => {
    localStorage.setItem("jd.flash_hv.v1", "off");
    render(wrap(<LearnMode deckId="deck1" cards={withHv()} direction="term" />));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    fireEvent.click(screen.getByRole("button", { name: "Lật thẻ" }));
    expect(document.querySelector(".fc-side__trail")).toBeNull();
  });

  it("fills it in once for older cards made from a dictionary entry", async () => {
    const d = createDeck("Cũ", "deck1");
    addCard({ deckId: d.id, term: "購入", definition: "mua", reading: "こうにゅう", entryId: 77, ...base });
    fetchEntry.mockResolvedValue({ ...TABERU, id: 77, kanji: [{ text: "購入", common: true, tags: [] }], kana: [{ text: "こうにゅう", common: true, tags: [], appliesToKanji: null }], hanViet: { 購入: "CẤU NHẬP" } });
    const ui = await deckPage();
    const { unmount } = render(ui);
    await waitFor(() => expect(readState().cards[0]!.hanViet).toBe("CẤU NHẬP"));
    expect(fetchEntry).toHaveBeenCalledTimes(1);
    unmount();
    render(ui);
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchEntry).toHaveBeenCalledTimes(1);
  });

  it("remembers a word that has none, so it is not asked again", async () => {
    const d = createDeck("Cũ", "deck1");
    addCard({ deckId: d.id, term: "ありがとう", definition: "cảm ơn", entryId: 88, ...base });
    fetchEntry.mockResolvedValue({ ...TABERU, id: 88 });
    const ui = await deckPage();
    const { unmount } = render(ui);
    await waitFor(() => expect(fetchEntry).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(localStorage.getItem("jd.flash_hv_tried.v1")).toContain("88"));
    unmount();
    render(ui);
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchEntry).toHaveBeenCalledTimes(1);
    expect(readState().cards[0]!.hanViet).toBeUndefined();
  });

  it("the card form fills it from the dictionary and saves it", async () => {
    const e = { ...TABERU, hanViet: { 食べる: "THỰC" } };
    searchDictionary.mockResolvedValue({ query: "", lang: "ja", entries: [e], kanji: [] });
    const onSubmit = vi.fn<(v: CardValue) => string | void>();
    render(wrap(<CardEditor submitLabel="Lưu" onSubmit={onSubmit} />));
    fireEvent.change(screen.getByLabelText("Từ"), { target: { value: "食べる" } });
    await waitFor(() => expect((screen.getByPlaceholderText("CẤU NHẬP") as HTMLInputElement).value).toBe("THỰC"));
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ hanViet: "THỰC", reading: "たべる" }));
  });
});

describe("routing", () => {
  it("the study page opens a mode of a deck", async () => {
    const { FlashcardStudyPage } = await import("../../pages/FlashcardStudyPage");
    seed();
    render(
      <MemoryRouter initialEntries={["/flashcards/deck1/match"]}>
        <UiLanguageProvider>
          <Routes>
            <Route path="/flashcards/:deckId/:mode" element={<FlashcardStudyPage />} />
          </Routes>
        </UiLanguageProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("button", { name: "Bắt đầu" })).toBeTruthy();
  });
});
