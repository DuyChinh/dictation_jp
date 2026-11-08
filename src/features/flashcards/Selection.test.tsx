import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import type { DictEntry } from "../../shared/api/dictionary";
import { LookupLayer } from "../dictionary/LookupLayer";
import { createDeck, readState, writeState } from "./store";
import { syncFlashcards } from "./sync";

const searchDictionary = vi.fn();
vi.mock("../../shared/api/dictionary", async (orig) => ({
  ...(await orig<typeof import("../../shared/api/dictionary")>()),
  searchDictionary: (...a: unknown[]) => searchDictionary(...a),
  lookupWord: vi.fn(),
}));

const TABERU: DictEntry = {
  id: 1,
  common: true,
  jlpt: 5,
  kanji: [{ text: "食べる", common: true, tags: [] }],
  kana: [{ text: "たべる", common: true, tags: [], appliesToKanji: null }],
  senses: [{ pos: ["v1"], field: [], misc: [], info: [], appliesToKanji: null, appliesToKana: null, glosses: ["to eat"], vi: ["ăn"], examples: [] }],
  viSource: "ai",
};

beforeEach(() => {
  localStorage.clear();
  searchDictionary.mockReset();
  searchDictionary.mockResolvedValue({ query: "食べる", lang: "ja", entries: [TABERU], kanji: [] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.getSelection()?.removeAllRanges();
});

function select(el: Element) {
  window.getSelection()!.selectAllChildren(el);
  document.dispatchEvent(new Event("selectionchange"));
}

describe("select a word to make a flashcard", () => {
  it("offers a button for selected text, opens the form filled with the meaning, and saves the card", async () => {
    render(
      <MemoryRouter>
        <UiLanguageProvider>
          <LookupLayer>
            <p data-testid="text">朝ごはんに食べる</p>
          </LookupLayer>
        </UiLanguageProvider>
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button", { name: /Tạo flashcard/ })).toBeNull();

    act(() => select(screen.getByTestId("text")));
    const button = await screen.findByRole("button", { name: /Tạo flashcard/ });
    fireEvent.click(button);

    const dialog = await screen.findByRole("dialog", { name: "Tạo flashcard" });
    expect((dialog.querySelector('input[aria-label="Từ"]') as HTMLInputElement).value).toBe("朝ごはんに食べる");
    // the default deck is offered before any exists
    expect(screen.getByRole("option", { name: "Từ của tôi" })).toBeTruthy();

    fireEvent.change(dialog.querySelector('input[aria-label="Từ"]')!, { target: { value: "食べる" } });
    await waitFor(() => expect((dialog.querySelector('input[aria-label="Nghĩa"]') as HTMLInputElement).value).toBe("ăn"));
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    expect(await screen.findByText("Đã lưu vào “Từ của tôi”")).toBeTruthy();
    expect(readState().cards).toEqual([expect.objectContaining({ term: "食べる", reading: "たべる", definition: "ăn", entryId: 1 })]);
  });

  it("saves into the deck that was picked", async () => {
    const deck = createDeck("Bài 5");
    render(
      <MemoryRouter>
        <UiLanguageProvider>
          <LookupLayer>
            <p data-testid="text">食べる</p>
          </LookupLayer>
        </UiLanguageProvider>
      </MemoryRouter>,
    );
    act(() => select(screen.getByTestId("text")));
    fireEvent.click(await screen.findByRole("button", { name: /Tạo flashcard/ }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect((dialog.querySelector('input[aria-label="Nghĩa"]') as HTMLInputElement).value).toBe("ăn"));
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    expect(readState().cards[0]!.deckId).toBe(deck.id);
  });

  it("goes away when the selection is cleared", async () => {
    render(
      <MemoryRouter>
        <UiLanguageProvider>
          <LookupLayer>
            <p data-testid="text">食べる</p>
          </LookupLayer>
        </UiLanguageProvider>
      </MemoryRouter>,
    );
    act(() => select(screen.getByTestId("text")));
    await screen.findByRole("button", { name: /Tạo flashcard/ });
    act(() => {
      window.getSelection()!.removeAllRanges();
      document.dispatchEvent(new Event("selectionchange"));
    });
    await waitFor(() => expect(screen.queryByRole("button", { name: /Tạo flashcard/ })).toBeNull());
  });

  it("ignores text selected outside the lookup area", async () => {
    render(
      <MemoryRouter>
        <UiLanguageProvider>
          <p data-testid="outside">食べる</p>
          <LookupLayer>
            <p>中</p>
          </LookupLayer>
        </UiLanguageProvider>
      </MemoryRouter>,
    );
    act(() => select(screen.getByTestId("outside")));
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByRole("button", { name: /Tạo flashcard/ })).toBeNull();
  });
});

describe("syncFlashcards", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("does nothing when signed out", async () => {
    expect(await syncFlashcards()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploads local cards and keeps cards the server had from another device", async () => {
    localStorage.setItem("token", "tok");
    const d = createDeck("Local", "d1");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        decks: [d, { id: "d2", name: "Từ máy khác", createdAt: 1, updatedAt: 1 }],
        cards: [],
      }),
    });
    expect(await syncFlashcards()).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/flashcards");
    expect(init.method).toBe("PUT");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body as string).decks.map((x: { id: string }) => x.id)).toEqual(["d1"]);
    expect(readState().decks.map((x) => x.id).sort()).toEqual(["d1", "d2"]);
  });

  it("leaves local data alone when the server refuses", async () => {
    localStorage.setItem("token", "tok");
    createDeck("Local", "d1");
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    expect(await syncFlashcards()).toBe(false);
    expect(readState().decks).toHaveLength(1);
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await syncFlashcards()).toBe(false);
  });

  it("uploads again when something changed while the request was in flight", async () => {
    vi.useFakeTimers();
    localStorage.setItem("token", "tok");
    createDeck("A", "d1");
    let release!: (v: unknown) => void;
    fetchMock.mockReturnValueOnce(new Promise((r) => (release = r)));
    const pending = syncFlashcards();
    // an edit made now is not in what was sent
    writeState({ ...readState(), decks: [...readState().decks, { id: "d3", name: "Mới", createdAt: 9, updatedAt: 9 }] }, { fromServer: true });
    release({ ok: true, json: async () => ({ decks: [{ id: "d1", name: "A", createdAt: 1, updatedAt: 1 }], cards: [] }) });
    await pending;
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ decks: [], cards: [] }) });
    await vi.advanceTimersByTimeAsync(2100);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(readState().decks.map((x) => x.id)).toContain("d3");
  });
});
