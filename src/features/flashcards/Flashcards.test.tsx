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
import { ShootMode } from "./ShootMode";
import { MinerMode } from "./MinerMode";
import { TestMode } from "./TestMode";
import { AddEntryButton } from "./AddEntryButton";
import { addCard, createDeck, readState } from "./store";
import type { Card } from "./types";

const searchDictionary = vi.fn();
const lookupWord = vi.fn();
vi.mock("../../shared/api/dictionary", async (orig) => ({
  ...(await orig<typeof import("../../shared/api/dictionary")>()),
  searchDictionary: (...a: unknown[]) => searchDictionary(...a),
  lookupWord: (...a: unknown[]) => lookupWord(...a),
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

describe("ShootMode", () => {
  const bubble = (text: string) => [...document.querySelectorAll(".fc-bubble")].find((b) => b.textContent?.includes(text)) as HTMLElement;
  const prompt = () => document.querySelector(".fc-shoot__prompt .fc-side__text")!.textContent!;
  const settle = () => act(async () => void vi.advanceTimersByTime(1100));
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));

  it("scores a shot at the right bubble and leaves a bullet hole", async () => {
    render(wrap(<ShootMode deckId="deck1" cards={seed()} direction="term" />));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    expect(document.querySelectorAll(".fc-bubble")).toHaveLength(4);
    fireEvent.click(bubble(MEANING[prompt()]!));
    expect(document.querySelector(".fc-bubble.is-right")).toBeTruthy();
    expect(document.querySelector(".fc-shoot__hole")).toBeTruthy();
    await settle();
    expect(screen.getByText("Điểm: 10")).toBeTruthy();
    expect(screen.getByText("2 / 4")).toBeTruthy();
  });

  it("loses a life for a wrong bubble and for the right one escaping, and ends at no lives", async () => {
    render(wrap(<ShootMode deckId="deck1" cards={seed()} direction="term" />));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    const wrong = () => Object.values(MEANING).find((m) => m !== MEANING[prompt()])!;
    fireEvent.click(bubble(wrong()));
    expect(document.querySelector(".fc-bubble.is-wrong")).toBeTruthy();
    await settle();
    expect(screen.getByLabelText("Còn 2 mạng")).toBeTruthy();

    fireEvent.animationEnd(bubble(MEANING[prompt()]!));
    await settle();
    expect(screen.getByLabelText("Còn 1 mạng")).toBeTruthy();

    fireEvent.click(bubble(wrong()));
    await settle();
    expect(screen.getByText("Hết mạng rồi")).toBeTruthy();
  });

  it("a shot at empty water costs nothing, and the number keys shoot", async () => {
    render(wrap(<ShootMode deckId="deck1" cards={seed()} direction="term" />));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    fireEvent.click(document.querySelector(".fc-shoot__range")!);
    expect(screen.getByLabelText("Còn 3 mạng")).toBeTruthy();
    expect(document.querySelectorAll(".fc-shoot__hole")).toHaveLength(1);
    const right = MEANING[prompt()]!;
    const index = [...document.querySelectorAll(".fc-bubble")].findIndex((b) => b.textContent?.includes(right));
    fireEvent.keyDown(window, { key: String(index + 1) });
    await settle();
    expect(screen.getByText("Điểm: 10")).toBeTruthy();
  });
});

describe("MinerMode", () => {
  const nuggetTexts = () => [...document.querySelectorAll(".fc-miner__scene > .fc-miner__nugget")].map((n) => n.querySelector(".fc-side__text")!.textContent!);
  const prompt = () => document.querySelector(".fc-shoot__prompt .fc-side__text")!.textContent!;
  const frames = (ms: number) => act(async () => void vi.advanceTimersByTime(ms));
  beforeEach(() => vi.useFakeTimers());

  it("drops the claw, hauls up the nugget under it, and judges it", async () => {
    render(wrap(<MinerMode deckId="deck1" cards={seed()} direction="term" />));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    // the nugget straight under the claw is the first one
    const underClaw = nuggetTexts()[0]!;
    const right = underClaw === MEANING[prompt()];
    expect(screen.getByLabelText("Còn 3 mạng")).toBeTruthy();

    fireEvent.keyDown(window, { key: " " });
    await frames(300);
    // on the way back with it
    expect(document.querySelector(".fc-miner__carry")?.textContent).toContain(underClaw);
    expect(document.querySelector(".fc-miner__nugget.is-taken")).toBeTruthy();
    await frames(900);
    expect(document.querySelector(".fc-miner__carry")?.className).toContain(right ? "is-right" : "is-wrong");
    await frames(1100);
    expect(screen.getByText(right ? "Điểm: 10" : "Điểm: 0")).toBeTruthy();
    expect(screen.getByLabelText(right ? "Còn 3 mạng" : "Còn 2 mạng")).toBeTruthy();
    expect(screen.getByText("2 / 4")).toBeTruthy();
  });

  it("misses cost nothing: an empty claw comes back and the question stays", async () => {
    render(wrap(<MinerMode deckId="deck1" cards={seed()} direction="term" />));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    // let it swing to the far left, where the left column of nuggets is, then past it to the empty wall
    await frames(2100);
    fireEvent.click(document.querySelector(".fc-miner__scene")!);
    await frames(2500);
    expect(screen.getByText(/^\d \/ 4$/)).toBeTruthy();
    expect(screen.getByLabelText(/Còn \d mạng/)).toBeTruthy();
  });

  it("ends when the 90 seconds are up", async () => {
    render(wrap(<MinerMode deckId="deck1" cards={seed()} direction="term" />));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    await frames(91000);
    expect(screen.getByText("Hết giờ!")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Chơi lại" })).toBeTruthy();
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
    expect(screen.getByRole("link", { name: /Bắn chữ/ })).toBeTruthy();
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
