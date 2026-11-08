import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import type { DictEntry } from "../../shared/api/dictionary";
import { CardEditor, type CardValue } from "./CardEditor";
import { DropMode } from "./DropMode";
import { LearnMode } from "./LearnMode";
import { MatchMode } from "./MatchMode";
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
    expect(screen.getByText("Bạn nhớ 1/2 thẻ.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Học lại 1 thẻ chưa nhớ" })).toBeTruthy();
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
    expect(screen.getByRole("button", { name: "Làm lại 2 thẻ sai" })).toBeTruthy();
    expect(readState().cards.filter((c) => c.right === 1)).toHaveLength(2);
    expect(readState().cards.filter((c) => c.wrong === 1)).toHaveLength(2);
    // wrong ones show the right answer
    expect(container.querySelectorAll(".fc-q--bad .fc-q__correct")).toHaveLength(2);
  });

  it("grades a multiple choice question by the option picked", () => {
    const cards = seed();
    const { container } = render(wrap(<TestMode deckId="deck1" cards={cards} direction="term" />));
    for (const name of ["Đúng / Sai", "Điền đáp án", "Nối cặp"]) fireEvent.click(screen.getByLabelText(name));
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
