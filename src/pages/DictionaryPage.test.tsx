import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { UiLanguageProvider } from "../shared/i18n/UiLanguageContext";
import { DictionaryPage } from "./DictionaryPage";

const searchDictionary = vi.fn();
vi.mock("../shared/api/dictionary", async (orig) => ({
  ...(await orig<typeof import("../shared/api/dictionary")>()),
  searchDictionary: (...a: unknown[]) => searchDictionary(...a),
}));
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
