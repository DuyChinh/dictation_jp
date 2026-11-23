import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import { FlashcardsPage } from "../../pages/FlashcardsPage";
import { TestMode } from "./TestMode";
import { DEFAULT_TEST_PREFS, loadTestPrefs, saveTestPrefs } from "./prefs";
import { addCard, createDeck, deckNameTaken, liveDecks, readState } from "./store";

vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("../../shared/ui/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("./sync", () => ({ syncFlashcards: () => Promise.resolve() }));

const base = { termLang: "ja", definitionLang: "vi" } as const;

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const page = () =>
  render(
    <MemoryRouter initialEntries={["/flashcards"]}>
      <UiLanguageProvider>
        <Routes>
          <Route path="/flashcards" element={<FlashcardsPage />} />
          <Route path="/flashcards/:deckId" element={<p>deck page</p>} />
        </Routes>
      </UiLanguageProvider>
    </MemoryRouter>,
  );

describe("deck names", () => {
  it("count as taken whatever the case or spacing, but not for the deck being renamed or a deleted one", () => {
    const a = createDeck("Vocab 1311", "a");
    createDeck("Cũ", "old");
    const decks = liveDecks(readState());
    expect(deckNameTaken(decks, "  vocab   1311 ")).toBe(true);
    expect(deckNameTaken(decks, "Vocab 1311", a.id)).toBe(false);
    expect(deckNameTaken(decks, "Vocab 1312")).toBe(false);
    expect(deckNameTaken(decks, "   ")).toBe(false);
  });
});

describe("the deck list's search and create box", () => {
  beforeEach(() => {
    createDeck("Vocab1311", "d1");
    createDeck("Listening 08/11", "d2");
  });

  it("filters the decks as you type", () => {
    page();
    const box = screen.getByRole("textbox", { name: "Tìm hoặc tạo bộ thẻ" });
    expect(screen.getByText("Vocab1311")).toBeTruthy();
    fireEvent.change(box, { target: { value: "listen" } });
    expect(screen.queryByText("Vocab1311")).toBeNull();
    expect(screen.getByText("Listening 08/11")).toBeTruthy();
    fireEvent.change(box, { target: { value: "zzz" } });
    expect(screen.getByRole("status").textContent).toContain("zzz");
  });

  it("creates the deck that was typed and opens it", () => {
    page();
    const box = screen.getByRole("textbox", { name: "Tìm hoặc tạo bộ thẻ" });
    fireEvent.change(box, { target: { value: "Bộ mới" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo bộ" }));
    expect(liveDecks(readState()).map((d) => d.name)).toContain("Bộ mới");
    expect(screen.getByText("deck page")).toBeTruthy();
  });

  it("refuses a name that is already used and says so", () => {
    page();
    const box = screen.getByRole("textbox", { name: "Tìm hoặc tạo bộ thẻ" });
    fireEvent.change(box, { target: { value: " vocab1311 " } });
    expect(screen.getByRole("alert").textContent).toContain("Đã có bộ thẻ");
    const create = screen.getByRole("button", { name: "Tạo bộ" }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    fireEvent.submit(box.closest("form")!);
    expect(liveDecks(readState())).toHaveLength(2);
  });

  it("deletes a deck from its own button only after the dialog is confirmed", () => {
    addCard({ deckId: "d1", term: "犬", definition: "chó", ...base });
    page();
    fireEvent.click(screen.getByRole("button", { name: "Xóa bộ “Vocab1311”" }));
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog.textContent).toContain("1 thẻ");
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy", hidden: true }));
    expect(liveDecks(readState())).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Xóa bộ “Vocab1311”" }));
    fireEvent.click(within(screen.getByRole("dialog", { hidden: true })).getByRole("button", { name: "Xóa bộ thẻ", hidden: true }));
    expect(liveDecks(readState()).map((d) => d.name)).toEqual(["Listening 08/11"]);
  });
});

describe("test set-up is remembered", () => {
  const wrap = (ui: React.ReactNode) => (
    <MemoryRouter>
      <UiLanguageProvider>{ui}</UiLanguageProvider>
    </MemoryRouter>
  );
  const cards = () => {
    const deck = createDeck("Bộ", "deck1");
    for (const [t, d] of [["犬", "chó"], ["猫", "mèo"], ["水", "nước"], ["火", "lửa"]]) addCard({ deckId: deck.id, term: t!, definition: d!, ...base });
    return readState().cards;
  };

  it("reads back what was saved and falls back to the defaults for rubbish", () => {
    expect(loadTestPrefs()).toEqual(DEFAULT_TEST_PREFS);
    saveTestPrefs({ count: 7, kinds: { mc: true, tf: false, write: false, match: true }, view: "all", grading: "instant" });
    expect(loadTestPrefs()).toMatchObject({ count: 7, view: "all", grading: "instant", kinds: { tf: false, write: false } });
    localStorage.setItem("jd.flash_test.v1", JSON.stringify({ kinds: { mc: false, tf: false, write: false, match: false }, count: -3 }));
    expect(loadTestPrefs().kinds).toEqual(DEFAULT_TEST_PREFS.kinds);
    expect(loadTestPrefs().count).toBeNull();
    localStorage.setItem("jd.flash_test.v1", "not json");
    expect(loadTestPrefs()).toEqual(DEFAULT_TEST_PREFS);
  });

  it("ticks the question types as they were left", () => {
    const c = cards();
    const first = render(wrap(<TestMode deckId="deck1" cards={c} direction="term" />));
    fireEvent.click(screen.getByLabelText("Điền đáp án"));
    fireEvent.click(screen.getByLabelText("Nối cặp"));
    first.unmount();
    render(wrap(<TestMode deckId="deck1" cards={c} direction="term" />));
    expect((screen.getByLabelText("Điền đáp án") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("Nối cặp") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("Trắc nghiệm") as HTMLInputElement).checked).toBe(true);
  });

  it("grades each choice at once when asked to, and by default only at the end", () => {
    const c = cards();
    // default: nothing is marked until the test is submitted
    const first = render(wrap(<TestMode deckId="deck1" cards={c} direction="term" />));
    for (const name of ["Đúng / Sai", "Điền đáp án", "Nối cặp"]) fireEvent.click(screen.getByLabelText(name));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu kiểm tra" }));
    fireEvent.click(document.querySelectorAll(".fc-q__option")[0]!);
    expect(document.querySelector(".fc-q__option.is-right, .fc-q__option.is-wrong")).toBeNull();
    first.unmount();
    localStorage.removeItem("jd.flash_game.v1");

    saveTestPrefs({ ...loadTestPrefs(), grading: "instant" });
    render(wrap(<TestMode deckId="deck1" cards={c} direction="term" />));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu kiểm tra" }));
    fireEvent.click(document.querySelectorAll(".fc-q__option")[0]!);
    expect(document.querySelector(".fc-q__option.is-right")).toBeTruthy();
    // a graded question can no longer be changed
    expect((document.querySelectorAll(".fc-q__option")[1] as HTMLButtonElement).disabled).toBe(true);
  });
});
