import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { UiLanguageProvider } from "../shared/i18n/UiLanguageContext";
import { DictionaryPage } from "./DictionaryPage";

const searchDictionary = vi.fn();
vi.mock("../shared/api/dictionary", async (orig) => ({
  ...(await orig<typeof import("../shared/api/dictionary")>()),
  searchDictionary: (...a: unknown[]) => searchDictionary(...a),
}));
vi.mock("../features/handwriting/templates", () => ({ loadTemplates: () => new Promise(() => undefined) }));
vi.mock("../shared/ui/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const entry = {
  id: 1,
  common: true,
  jlpt: 5,
  kanji: [{ text: "暇", common: true, tags: [] }],
  kana: [{ text: "ひま", common: true, tags: [], appliesToKanji: null }],
  senses: [
    {
      pos: ["n"], field: [], misc: [], info: [], appliesToKanji: null, appliesToKana: null,
      glosses: ["spare time"], vi: ["thời gian rảnh"],
      examples: [],
    },
  ],
  viSource: "ai",
};

beforeEach(() => {
  localStorage.clear();
  searchDictionary.mockReset();
  searchDictionary.mockResolvedValue({ query: "暇", lang: "ja", entries: [entry], kanji: [] });
});
afterEach(() => cleanup());

function renderPage(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <UiLanguageProvider>
        <DictionaryPage />
      </UiLanguageProvider>
    </MemoryRouter>,
  );
}

describe("DictionaryPage", () => {
  it("picks the dictionary from a list, with no language chips under the search", () => {
    renderPage("/dictionary");
    const select = screen.getByRole("combobox", { name: "Chọn từ điển" }) as HTMLSelectElement;
    expect(select.value).toBe("vi");
    expect([...select.options].map((o) => o.text)).toEqual(["Nhật - Việt", "Nhật - Anh"]);
    expect(screen.queryByRole("button", { name: "Tự nhận" })).toBeNull();
  });

  it("shows only the Vietnamese meaning in Nhật - Việt, and only English after switching to Nhật - Anh", async () => {
    renderPage("/dictionary?q=暇");
    await waitFor(() => expect(screen.getByText("thời gian rảnh")).toBeTruthy());
    expect(screen.queryByText("spare time")).toBeNull();
    expect(searchDictionary).toHaveBeenLastCalledWith("暇", expect.anything(), "vi");

    fireEvent.change(screen.getByRole("combobox", { name: "Chọn từ điển" }), { target: { value: "en" } });
    await waitFor(() => expect(screen.getByText("spare time")).toBeTruthy());
    expect(screen.queryByText("thời gian rảnh")).toBeNull();
    expect(searchDictionary).toHaveBeenLastCalledWith("暇", expect.anything(), "en");
    expect(localStorage.getItem("jd.dict_pair.v1")).toBe("en");
  });

  it("remembers the last dictionary for the next visit", () => {
    localStorage.setItem("jd.dict_pair.v1", "en");
    renderPage("/dictionary");
    expect((screen.getByRole("combobox", { name: "Chọn từ điển" }) as HTMLSelectElement).value).toBe("en");
  });
});

describe("DictionaryPage microphone", () => {
  type Fake = {
    lang: string;
    started: boolean;
    onstart: (() => void) | null;
    onresult: ((e: unknown) => void) | null;
    onerror: ((e: { error: string }) => void) | null;
    onend: (() => void) | null;
  };
  let current: Fake | null;

  beforeEach(() => {
    current = null;
    class FakeRecognition implements Fake {
      lang = "";
      started = false;
      interimResults = false;
      continuous = false;
      maxAlternatives = 1;
      onstart: (() => void) | null = null;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      constructor() {
        current = this;
      }
      start() {
        this.started = true;
        this.onstart?.();
      }
      stop() {
        this.onend?.();
      }
      abort() {}
    }
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
  });
  afterEach(() => vi.unstubAllGlobals());

  const heard = (text: string, isFinal: boolean) =>
    act(() => current!.onresult!({ resultIndex: 0, results: [{ isFinal, length: 1, 0: { transcript: text } }] }));

  it("listens for Japanese and puts what it hears in the search box without searching yet", () => {
    renderPage("/dictionary");
    fireEvent.click(screen.getByRole("button", { name: "Nói tiếng Nhật để tra" }));
    expect(current!.lang).toBe("ja-JP");
    expect(screen.getByRole("status").textContent).toMatch(/Đang nghe/);

    heard("ひ", false);
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("ひ");
    heard("ひま", true);
    act(() => current!.onend!());

    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("ひま");
    expect(screen.queryByRole("status")).toBeNull();
    expect(searchDictionary).not.toHaveBeenCalled();
  });

  it("explains a refused microphone", () => {
    renderPage("/dictionary");
    fireEvent.click(screen.getByRole("button", { name: "Nói tiếng Nhật để tra" }));
    act(() => current!.onerror!({ error: "not-allowed" }));
    expect(screen.getByRole("alert").textContent).toMatch(/Chưa cho phép dùng micro/);
  });

  it("stays quiet when the person stops it themselves", () => {
    renderPage("/dictionary");
    fireEvent.click(screen.getByRole("button", { name: "Nói tiếng Nhật để tra" }));
    act(() => current!.onerror!({ error: "aborted" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("has no microphone where the browser cannot recognise speech", () => {
    vi.unstubAllGlobals();
    renderPage("/dictionary");
    expect(screen.queryByRole("button", { name: "Nói tiếng Nhật để tra" })).toBeNull();
  });
});

describe("DictionaryPage handwriting", () => {
  it("opens and closes the drawing board from the search box", () => {
    // jsdom has no canvas
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    renderPage("/dictionary");
    expect(screen.queryByRole("region", { name: "Viết tay" })).toBeNull();
    const open = screen.getByRole("button", { name: "Viết tay chữ Hán, kana để tra" });
    fireEvent.click(open);
    expect(screen.getByRole("region", { name: "Viết tay" })).toBeTruthy();
    expect(open.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /Đóng/ }));
    expect(screen.queryByRole("region", { name: "Viết tay" })).toBeNull();
  });
});
