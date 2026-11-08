import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import { ApiError } from "../../shared/api/client";
import { FlashcardSharedPage, FlashcardSharedStudyPage } from "../../pages/FlashcardSharedPage";
import { DeckShare } from "./DeckShare";
import { addCard, createDeck, liveDecks, readState, useFlashcards } from "./store";
import type { SharedDeck } from "./shareApi";

const h = vi.hoisted(() => ({ user: null as null | { _id: string }, fetchSharedDeck: vi.fn(), enableShare: vi.fn(), disableShare: vi.fn(), sync: vi.fn() }));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ user: h.user, loading: false }) }));
vi.mock("./sync", () => ({ syncFlashcards: (...a: unknown[]) => h.sync(...a), scheduleSync: () => undefined }));
vi.mock("./shareApi", async (orig) => ({
  ...(await orig<typeof import("./shareApi")>()),
  fetchSharedDeck: (...a: unknown[]) => h.fetchSharedDeck(...a),
  enableShare: (...a: unknown[]) => h.enableShare(...a),
  disableShare: (...a: unknown[]) => h.disableShare(...a),
}));
vi.mock("../../shared/ui/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../../shared/utils/confetti", () => ({ triggerConfetti: () => undefined, triggerFireworks: () => undefined }));

const base = { termLang: "ja", definitionLang: "vi" } as const;
const shared = (over: Partial<SharedDeck> = {}): SharedDeck => ({
  name: "Bài 5",
  ownerName: "Linh",
  updatedAt: 100,
  cards: [
    { id: "s1", term: "犬", termLang: "ja", definition: "chó", definitionLang: "vi", reading: "いぬ", hanViet: "KHUYỂN" },
    { id: "s2", term: "猫", termLang: "ja", definition: "mèo", definitionLang: "vi" },
    { id: "s3", term: "水", termLang: "ja", definition: "nước", definitionLang: "vi" },
  ],
  ...over,
});

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}
const wrap = (ui: React.ReactNode, at = "/") => (
  <MemoryRouter initialEntries={[at]}>
    <UiLanguageProvider>{ui}</UiLanguageProvider>
  </MemoryRouter>
);

beforeEach(() => {
  localStorage.clear();
  h.user = { _id: "u1" };
  h.sync.mockReset().mockResolvedValue(true);
  h.fetchSharedDeck.mockReset();
  h.enableShare.mockReset();
  h.disableShare.mockReset();
  window.scrollTo = vi.fn();
});
afterEach(() => cleanup());

function ShareHarness() {
  const { decks } = useFlashcards();
  return decks[0] ? <DeckShare deck={decks[0]} /> : null;
}

describe("DeckShare (the owner's switch)", () => {
  it("starts private; going public syncs first, asks the server for a link and shows it", async () => {
    createDeck("Bài 1", "d1");
    h.enableShare.mockResolvedValue("AbCdEfGh1234");
    render(wrap(<ShareHarness />));
    expect(screen.getByRole("radio", { name: /Riêng tư/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Chỉ mình bạn thấy bộ thẻ này.")).toBeTruthy();
    expect(screen.queryByLabelText("Liên kết chia sẻ")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /Công khai/ }));
    await waitFor(() => expect(screen.getByLabelText("Liên kết chia sẻ")).toBeTruthy());
    expect(h.enableShare).toHaveBeenCalledWith("d1");
    // the deck had to be on the account before the server could share it
    expect(h.sync.mock.invocationCallOrder[0]!).toBeLessThan(h.enableShare.mock.invocationCallOrder[0]!);
    expect((screen.getByLabelText("Liên kết chia sẻ") as HTMLInputElement).value).toBe(`${window.location.origin}/flashcards/shared/AbCdEfGh1234`);
    expect(liveDecks(readState())[0]!.shareId).toBe("AbCdEfGh1234");
    expect(screen.getByRole("radio", { name: /Công khai/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("going private removes the link", async () => {
    const d = createDeck("Bài 1", "d1");
    readState();
    const { setDeckShare } = await import("./store");
    setDeckShare(d.id, "AbCdEfGh1234");
    h.disableShare.mockResolvedValue(undefined);
    render(wrap(<ShareHarness />));
    expect(screen.getByLabelText("Liên kết chia sẻ")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Riêng tư/ }));
    await waitFor(() => expect(screen.queryByLabelText("Liên kết chia sẻ")).toBeNull());
    expect(h.disableShare).toHaveBeenCalledWith("d1");
    expect(liveDecks(readState())[0]).not.toHaveProperty("shareId");
  });

  it("copies the link", async () => {
    const d = createDeck("Bài 1", "d1");
    const { setDeckShare } = await import("./store");
    setDeckShare(d.id, "AbCdEfGh1234");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(wrap(<ShareHarness />));
    fireEvent.click(screen.getByRole("button", { name: /Sao chép/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Đã sao chép/ })).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/flashcards/shared/AbCdEfGh1234"));
  });

  it("stays as it was and says so when the server refuses", async () => {
    createDeck("Bài 1", "d1");
    h.enableShare.mockRejectedValue(new ApiError(500, "X", "boom"));
    render(wrap(<ShareHarness />));
    fireEvent.click(screen.getByRole("radio", { name: /Công khai/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("Không thể đổi chế độ chia sẻ");
    expect(liveDecks(readState())[0]).not.toHaveProperty("shareId");
    h.enableShare.mockRejectedValue(new ApiError(409, "LIMIT", "limit"));
    fireEvent.click(screen.getByRole("radio", { name: /Công khai/ }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("tối đa 50"));
  });

  it("asks a signed-out visitor to sign in instead of offering the switch", () => {
    h.user = null;
    createDeck("Bài 1", "d1");
    render(wrap(<ShareHarness />));
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByRole("link", { name: "Đăng nhập" }).getAttribute("href")).toBe("/auth");
  });
});

describe("the page behind a share link", () => {
  const open = (at = "/flashcards/shared/abc12345") =>
    render(
      wrap(
        <>
          <Routes>
            <Route path="/flashcards/shared/:shareId" element={<FlashcardSharedPage />} />
            <Route path="/flashcards/shared/:shareId/:mode" element={<FlashcardSharedStudyPage />} />
            <Route path="/flashcards/:deckId" element={<p>my deck page</p>} />
          </Routes>
          <Where />
        </>,
        at,
      ),
    );

  it("shows the deck to someone who is not signed in: name, owner, words with readings and Hán Việt", async () => {
    h.user = null;
    h.fetchSharedDeck.mockResolvedValue(shared());
    open();
    expect(await screen.findByRole("heading", { level: 1, name: "Bài 5" })).toBeTruthy();
    expect(h.fetchSharedDeck).toHaveBeenCalledWith("abc12345", expect.anything());
    expect(screen.getByText("Chia sẻ bởi Linh")).toBeTruthy();
    expect(screen.getByText("3 từ")).toBeTruthy();
    const row = document.querySelector(".fc-row")!;
    expect(row.querySelectorAll(".fc-side__text")[1]!.textContent).toBe("いぬ: chó");
    expect(row.querySelector(".fc-side__trail")?.textContent).toBe("KHUYỂN");
    // one link per way to study, all under the shared address
    expect(screen.getByRole("link", { name: /Học thẻ/ }).getAttribute("href")).toBe("/flashcards/shared/abc12345/learn");
    expect(screen.getByRole("link", { name: /Đào vàng/ }).getAttribute("href")).toBe("/flashcards/shared/abc12345/miner");
  });

  it("searches the words", async () => {
    h.fetchSharedDeck.mockResolvedValue(shared());
    open();
    await screen.findByRole("heading", { level: 1 });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "mèo" } });
    expect(screen.getByText("猫")).toBeTruthy();
    expect(screen.queryByText("犬")).toBeNull();
  });

  it("keeps a copy in the visitor's own decks and opens it", async () => {
    h.fetchSharedDeck.mockResolvedValue(shared());
    open();
    fireEvent.click(await screen.findByRole("button", { name: /Lưu vào bộ thẻ của tôi/ }));
    const mine = liveDecks(readState());
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ name: "Bài 5" });
    expect(readState().cards.filter((c) => c.deckId === mine[0]!.id)).toHaveLength(3);
    expect(screen.getByTestId("where").textContent).toBe(`/flashcards/${mine[0]!.id}`);
    expect(h.sync).toHaveBeenCalled();
  });

  it("says so when the link is dead, and offers a retry when the server is down", async () => {
    h.fetchSharedDeck.mockRejectedValue(new ApiError(404, "NOT_FOUND", "gone"));
    open();
    expect(await screen.findByText(/không còn hiệu lực/)).toBeTruthy();
    cleanup();
    h.fetchSharedDeck.mockRejectedValueOnce(new ApiError(500, "X", "down")).mockResolvedValue(shared());
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Thử lại" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Bài 5" })).toBeTruthy();
  });

  it("studies straight from the link, with its own place saved and back leading to the shared page", async () => {
    h.fetchSharedDeck.mockResolvedValue(shared());
    open("/flashcards/shared/abc12345/learn");
    fireEvent.click(await screen.findByRole("button", { name: "Bắt đầu" }));
    expect(screen.getByText("1 / 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Đã nhớ/ }));
    expect(JSON.parse(localStorage.getItem("jd.flash_learn.v1")!)["shared-abc12345"].index).toBe(1);
    // answers are not written into the visitor's own cards
    expect(readState().cards).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /Đã nhớ/ }));
    fireEvent.click(screen.getByRole("button", { name: /Đã nhớ/ }));
    expect(screen.getByRole("link", { name: "Về bộ thẻ" }).getAttribute("href")).toBe("/flashcards/shared/abc12345");
  });

  it("does not open a mode the deck is too small for", async () => {
    h.fetchSharedDeck.mockResolvedValue(shared({ cards: [shared().cards[0]!] }));
    open("/flashcards/shared/abc12345/match");
    expect(await screen.findByText("Không tìm thấy bộ thẻ này.")).toBeTruthy();
  });
});

describe("the owner studies their own shared deck", () => {
  it("their answers do count, since the cards are theirs", async () => {
    const d = createDeck("Bài 5", "d1");
    const c = addCard({ deckId: d.id, term: "犬", definition: "chó", ...base });
    h.fetchSharedDeck.mockResolvedValue(shared({ cards: [{ id: c.id, term: "犬", termLang: "ja", definition: "chó", definitionLang: "vi" }, { id: "x", term: "猫", termLang: "ja", definition: "mèo", definitionLang: "vi" }] }));
    render(
      wrap(
        <Routes>
          <Route path="/flashcards/shared/:shareId/:mode" element={<FlashcardSharedStudyPage />} />
        </Routes>,
        "/flashcards/shared/abc12345/learn",
      ),
    );
    fireEvent.click(await screen.findByLabelText("Xáo trộn thứ tự"));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    const first = document.querySelector(".fc-flash__side--front .fc-side__text")!.textContent;
    fireEvent.click(screen.getByRole("button", { name: /Đã nhớ/ }));
    const mine = readState().cards.find((x) => x.id === c.id)!;
    expect(mine.right).toBe(first === "犬" ? 1 : 0);
  });
});
