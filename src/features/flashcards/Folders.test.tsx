import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import { FlashcardsPage } from "../../pages/FlashcardsPage";
import { PAGE_SIZE } from "./DeckBrowser";
import { mergeState } from "./merge";
import {
  MAX_FOLDERS,
  addCard,
  createDeck,
  createFolder,
  deleteDeck,
  deleteFolder,
  importSharedDeck,
  liveDecks,
  liveFolders,
  migrateLegacyDefault,
  moveDeck,
  readState,
  renameFolder,
} from "./store";

vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("../../shared/ui/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("./sync", () => ({ syncFlashcards: () => Promise.resolve() }));

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

describe("folders in the store", () => {
  it("makes folders, refusing empty, repeated and too many", () => {
    expect(createFolder("   ")).toBeNull();
    const a = createFolder("  N3  ")!;
    expect(a.name).toBe("N3");
    expect(createFolder("n3")).toBeNull();
    for (let i = 1; i < MAX_FOLDERS; i++) expect(createFolder(`f${i}`)).not.toBeNull();
    expect(createFolder("one too many")).toBeNull();
    expect(liveFolders(readState())).toHaveLength(MAX_FOLDERS);
  });

  it("moves a deck in and out of a folder without touching the others", () => {
    const f = createFolder("N3")!;
    createDeck("A", "a");
    createDeck("B", "b");
    moveDeck("a", f.id);
    expect(liveDecks(readState()).find((d) => d.id === "a")?.folderId).toBe(f.id);
    expect(liveDecks(readState()).find((d) => d.id === "b")?.folderId).toBeUndefined();
    moveDeck("a", undefined);
    expect("folderId" in liveDecks(readState()).find((d) => d.id === "a")!).toBe(false);
  });

  it("renames a folder, and deleting it keeps its decks but takes them out of it", () => {
    const f = createFolder("N3")!;
    createDeck("A", "a");
    moveDeck("a", f.id);
    renameFolder(f.id, "JLPT N3");
    expect(liveFolders(readState())[0].name).toBe("JLPT N3");
    deleteFolder(f.id);
    expect(liveFolders(readState())).toHaveLength(0);
    expect(readState().folders?.[0].deleted).toBe(true); // a tombstone, so another device does not bring it back
    expect(liveDecks(readState()).map((d) => [d.id, d.folderId])).toEqual([["a", undefined]]);
  });

  it("keeps folders through the other edits that rewrite the whole state", () => {
    const f = createFolder("N3")!;
    const d = createDeck("A", "a");
    addCard({ deckId: d.id, term: "犬", termLang: "ja", definition: "chó", definitionLang: "vi" });
    importSharedDeck("Shared", [{ id: "x", term: "猫", termLang: "ja", definition: "mèo", definitionLang: "vi" }]);
    deleteDeck("a");
    migrateLegacyDefault();
    expect(liveFolders(readState()).map((x) => x.id)).toEqual([f.id]);
  });

  it("merges folders from the account like decks, and an older device without folders loses nothing", () => {
    const f = createFolder("N3")!;
    const local = readState();
    const remote = { decks: [], cards: [], folders: [{ id: "r", name: "Remote", createdAt: 1, updatedAt: Date.now() }] };
    expect(mergeState(local, remote).folders?.map((x) => x.id).sort()).toEqual([f.id, "r"].sort());
    expect(mergeState(local, { decks: [], cards: [] }).folders).toHaveLength(1);
  });
});

describe("the deck list with folders", () => {
  it("shows decks in a collapsible folder and the rest under 'not in a folder'", () => {
    const f = createFolder("N3")!;
    createDeck("Trong thư mục", "a");
    createDeck("Ở ngoài", "b");
    moveDeck("a", f.id);
    page();
    expect(screen.getByRole("button", { name: /^N3/ }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Trong thư mục")).toBeNull();
    expect(screen.getByText("Ở ngoài")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Chưa xếp vào thư mục" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^N3/ }));
    expect(screen.getByRole("button", { name: /^N3/ }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Trong thư mục")).toBeTruthy();
  });

  it("creates a folder from the toolbar and opens it", () => {
    createDeck("A", "a");
    page();
    fireEvent.click(screen.getByRole("button", { name: /Thư mục mới/ }));
    const box = screen.getByRole("textbox", { name: "Tên thư mục" });
    fireEvent.change(box, { target: { value: "Từ vựng" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo thư mục" }));
    expect(liveFolders(readState()).map((f) => f.name)).toEqual(["Từ vựng"]);
    expect(screen.getByRole("button", { name: /^Từ vựng/ }).getAttribute("aria-expanded")).toBe("true");
  });

  it("moves a deck with the folder picker on its card", () => {
    const f = createFolder("N3")!;
    createDeck("Bộ A", "a");
    page();
    fireEvent.change(screen.getByRole("combobox", { name: /Bộ A/ }), { target: { value: f.id } });
    expect(liveDecks(readState())[0].folderId).toBe(f.id);
  });

  it("lists search matches flat, saying which folder each is in", () => {
    const f = createFolder("N3")!;
    createDeck("Kanji bài 1", "a");
    createDeck("Ngữ pháp", "b");
    moveDeck("a", f.id);
    page();
    fireEvent.change(screen.getByRole("textbox", { name: "Tìm hoặc tạo bộ thẻ" }), { target: { value: "kanji" } });
    const item = screen.getByText("Kanji bài 1").closest("li")!;
    expect(within(item).getByText("N3", { selector: ".fc-deck__folder" })).toBeTruthy();
    expect(screen.queryByText("Ngữ pháp")).toBeNull();
  });

  it("deletes only the folder after confirmation, keeping its decks", () => {
    const f = createFolder("N3")!;
    createDeck("Bộ A", "a");
    moveDeck("a", f.id);
    page();
    fireEvent.click(screen.getByRole("button", { name: "Xóa thư mục N3" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Xóa thư mục" }).pop()!);
    expect(liveFolders(readState())).toHaveLength(0);
    expect(liveDecks(readState())).toHaveLength(1);
    expect(screen.getByText("Bộ A")).toBeTruthy();
  });

  it("shows a long list a page at a time", () => {
    for (let i = 0; i < PAGE_SIZE + 5; i++) createDeck(`Bộ ${String(i).padStart(2, "0")}`, `d${i}`);
    page();
    expect(document.querySelectorAll("li.fc-decks__item")).toHaveLength(PAGE_SIZE);
    fireEvent.click(screen.getByRole("button", { name: /Xem thêm 5 bộ/ }));
    expect(document.querySelectorAll("li.fc-decks__item")).toHaveLength(PAGE_SIZE + 5);
    expect(screen.queryByRole("button", { name: /Xem thêm/ })).toBeNull();
  });
});
