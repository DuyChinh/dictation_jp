import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import { FlashcardCreatePage } from "../../pages/FlashcardCreatePage";
import { FlashcardDeckPage } from "../../pages/FlashcardDeckPage";
import { addCard, cardsOf, createDeck, liveCards, readState } from "./store";

const searchDictionary = vi.fn();
vi.mock("../../shared/api/dictionary", async (orig) => ({
  ...(await orig<typeof import("../../shared/api/dictionary")>()),
  searchDictionary: (...a: unknown[]) => searchDictionary(...a),
  lookupWord: vi.fn().mockResolvedValue(null),
  fetchEntry: vi.fn().mockRejectedValue(new Error("none")),
}));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("./sync", () => ({ syncFlashcards: vi.fn().mockResolvedValue(true), scheduleSync: () => undefined }));
vi.mock("../../shared/ui/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

const base = { termLang: "ja", definitionLang: "vi" } as const;

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}
function open(entries: string[], index = entries.length - 1) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={index}>
      <UiLanguageProvider>
        <Routes>
          <Route path="/flashcards/create" element={<><FlashcardCreatePage /><Link to="/elsewhere">go elsewhere</Link></>} />
          <Route path="/flashcards/:deckId" element={<FlashcardDeckPage />} />
          <Route path="*" element={<p>some other page</p>} />
        </Routes>
        <Where />
      </UiLanguageProvider>
    </MemoryRouter>,
  );
}
const CREATE = "/flashcards/create?deck=deck1";
const type = (term: string, meaning: string) => {
  fireEvent.change(screen.getByLabelText("Từ"), { target: { value: term } });
  fireEvent.change(screen.getByLabelText("Nghĩa"), { target: { value: meaning } });
};
const where = () => screen.getByTestId("where").textContent;
const terms = () => liveCards(readState()).map((c) => c.term).sort();

beforeEach(() => {
  localStorage.clear();
  searchDictionary.mockReset();
  searchDictionary.mockResolvedValue({ query: "", lang: "ja", entries: [], kanji: [] });
  createDeck("Bộ thử", "deck1");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the create page's count of added cards", () => {
  it("shows nothing at first, then how many cards were added on this visit", () => {
    open(["/before", CREATE]);
    expect(screen.queryByText(/Đã thêm \d+ từ/)).toBeNull();
    type("犬", "chó");
    fireEvent.click(screen.getByRole("button", { name: "Thêm thẻ" }));
    expect(screen.getByText("Đã thêm 1 từ")).toBeTruthy();
    type("猫", "mèo");
    fireEvent.click(screen.getByRole("button", { name: "Thêm thẻ" }));
    expect(screen.getByText("Đã thêm 2 từ")).toBeTruthy();
  });

  it("does not count cards that were already in the deck", () => {
    addCard({ deckId: "deck1", term: "水", definition: "nước", ...base });
    open(["/before", CREATE]);
    expect(screen.queryByText(/Đã thêm \d+ từ/)).toBeNull();
  });
});

describe("the create page's Back and Save", () => {
  it("has both buttons at the top and again under the list", () => {
    open(["/before", CREATE]);
    expect(screen.getAllByRole("button", { name: /Lưu/ })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /Quay lại/ })).toHaveLength(2);
  });

  it("Save adds what is typed and returns to the page before", () => {
    open(["/before", CREATE]);
    type("犬", "chó");
    fireEvent.click(screen.getAllByRole("button", { name: /Lưu/ })[0]!);
    expect(terms()).toEqual(["犬"]);
    expect(where()).toBe("/before");
  });

  it("Back does the same, without a click on Add or Save", () => {
    open(["/before", CREATE]);
    type("猫", "mèo");
    fireEvent.click(screen.getAllByRole("button", { name: /Quay lại/ })[1]!);
    expect(terms()).toEqual(["猫"]);
    expect(where()).toBe("/before");
  });

  it("opened directly, it goes to the deck instead", () => {
    open([CREATE]);
    fireEvent.click(screen.getAllByRole("button", { name: /Quay lại/ })[0]!);
    expect(where()).toBe("/flashcards/deck1");
  });

  it("saves a half-typed card when leaving by any other route too", () => {
    open(["/before", CREATE]);
    type("水", "nước");
    fireEvent.click(screen.getByRole("link", { name: "go elsewhere" }));
    expect(where()).toBe("/elsewhere");
    expect(terms()).toEqual(["水"]);
  });

  it("saves when the tab is closed or the page hidden", () => {
    open([CREATE]);
    type("火", "lửa");
    act(() => void window.dispatchEvent(new Event("pagehide")));
    expect(terms()).toEqual(["火"]);
    // and only once, whatever happens next
    cleanup();
    expect(terms()).toEqual(["火"]);
  });

  it("does not save a card that is only half filled in", () => {
    open(["/before", CREATE]);
    fireEvent.change(screen.getByLabelText("Từ"), { target: { value: "木" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Lưu/ })[0]!);
    expect(terms()).toEqual([]);
    expect(where()).toBe("/before");
  });

  it("does not add a card twice: Add then Save leaves one, and a repeat of an existing card is skipped", () => {
    addCard({ deckId: "deck1", term: "山", definition: "núi", ...base });
    open(["/before", CREATE]);
    type("川", "sông");
    fireEvent.click(screen.getByRole("button", { name: "Thêm thẻ" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Lưu/ })[0]!);
    expect(terms()).toEqual(["山", "川"]);
    cleanup();
    open(["/before", CREATE]);
    type("山", "núi");
    fireEvent.click(screen.getAllByRole("button", { name: /Lưu/ })[0]!);
    expect(terms()).toEqual(["山", "川"]);
  });

  it("puts a card typed after Add into the same deck", () => {
    open(["/before", CREATE]);
    type("犬", "chó");
    fireEvent.click(screen.getByRole("button", { name: "Thêm thẻ" }));
    type("猫", "mèo");
    fireEvent.click(screen.getAllByRole("button", { name: /Lưu/ })[0]!);
    expect(cardsOf(readState(), "deck1").map((c) => c.term).sort()).toEqual(["犬", "猫"]);
  });
});

describe("editing and deleting on the create page", () => {
  beforeEach(() => {
    addCard({ deckId: "deck1", term: "犬", definition: "chó", ...base });
    addCard({ deckId: "deck1", term: "猫", definition: "mèo", ...base });
  });

  it("edits a word in a box over the page", () => {
    open(["/before", CREATE]);
    fireEvent.click(screen.getByRole("button", { name: "Sửa: 犬" }));
    const dialog = screen.getByRole("dialog", { name: "Sửa" });
    fireEvent.change(within(dialog).getByLabelText("Nghĩa"), { target: { value: "con chó" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(cardsOf(readState(), "deck1").find((c) => c.term === "犬")!.definition).toBe("con chó");
    // still on the same page
    expect(where()).toBe("/flashcards/create");
  });

  it("closing the box leaves the word as it was; Escape closes it too", () => {
    open(["/before", CREATE]);
    fireEvent.click(screen.getByRole("button", { name: "Sửa: 猫" }));
    fireEvent.change(within(screen.getByRole("dialog")).getByLabelText("Nghĩa"), { target: { value: "đổi" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Hủy" }));
    expect(cardsOf(readState(), "deck1").find((c) => c.term === "猫")!.definition).toBe("mèo");
    fireEvent.click(screen.getByRole("button", { name: "Sửa: 猫" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("deletes a word, and Undo brings it back", () => {
    open(["/before", CREATE]);
    expect(screen.getByText("Các từ trong bộ (2)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xóa: 犬" }));
    expect(screen.getByText("Các từ trong bộ (1)")).toBeTruthy();
    expect(terms()).toEqual(["猫"]);
    expect(screen.getByText("Đã xóa “犬”.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hoàn tác" }));
    expect(screen.getByText("Các từ trong bộ (2)")).toBeTruthy();
    expect(terms()).toEqual(["犬", "猫"]);
    expect(screen.queryByText("Đã xóa “犬”.")).toBeNull();
  });

  it("the undo offer goes away after a few seconds, and the word stays deleted", () => {
    vi.useFakeTimers();
    open(["/before", CREATE]);
    fireEvent.click(screen.getByRole("button", { name: "Xóa: 犬" }));
    expect(screen.getByRole("button", { name: "Hoàn tác" })).toBeTruthy();
    act(() => void vi.advanceTimersByTime(7500));
    expect(screen.queryByRole("button", { name: "Hoàn tác" })).toBeNull();
    expect(terms()).toEqual(["猫"]);
  });

  it("the deck page deletes with the same undo, and edits through the same box", () => {
    open(["/flashcards/deck1"]);
    fireEvent.click(screen.getByRole("button", { name: "Xóa: 猫" }));
    expect(terms()).toEqual(["犬"]);
    fireEvent.click(screen.getByRole("button", { name: "Hoàn tác" }));
    expect(terms()).toEqual(["犬", "猫"]);
    fireEvent.click(screen.getByRole("button", { name: "Sửa: 犬" }));
    expect(screen.getByRole("dialog", { name: "Sửa" })).toBeTruthy();
  });
});
