import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import type { DictEntry, LookupResult } from "../../shared/api/dictionary";
import { EntryCard, headwordOf } from "./EntryCard";
import { LookupLayer } from "./LookupLayer";
import { posLabel, reasonLabel } from "./dictLabels";

const lookupWord = vi.fn();
vi.mock("../../shared/api/dictionary", async (orig) => ({
  ...(await orig<typeof import("../../shared/api/dictionary")>()),
  lookupWord: (...a: unknown[]) => lookupWord(...a),
}));

const entry = (vi_: string[]): DictEntry => ({
  id: 1,
  common: true,
  jlpt: 5,
  kanji: [{ text: "食べる", common: true, tags: [] }],
  kana: [{ text: "たべる", common: true, tags: [], appliesToKanji: null }],
  senses: [
    {
      pos: ["v1", "vt"],
      field: [],
      misc: [],
      info: [],
      appliesToKanji: null,
      appliesToKana: null,
      glosses: ["to eat"],
      vi: vi_,
      examples: [{ ja: "りんごを食べる。", en: "I eat an apple.", vi: "Tôi ăn một quả táo." }],
    },
  ],
  viSource: vi_.length ? "ai" : null,
});

const wrap = (ui: React.ReactNode) => (
  <MemoryRouter>
    <UiLanguageProvider>{ui}</UiLanguageProvider>
  </MemoryRouter>
);

beforeEach(() => {
  localStorage.clear();
  lookupWord.mockReset();
});
afterEach(() => cleanup());

describe("EntryCard", () => {
  it("shows the Vietnamese meaning first, with English beneath, and the word class in Vietnamese", () => {
    render(wrap(<EntryCard entry={entry(["ăn"])} />));
    expect(screen.getByText("ăn")).toBeTruthy();
    expect(screen.getByText("to eat")).toBeTruthy();
    expect(screen.getByText(/động từ nhóm 2/)).toBeTruthy();
    expect(screen.getByText("N5")).toBeTruthy();
    expect(screen.getByText("りんごを食べる。")).toBeTruthy();
    expect(screen.getByText("Tôi ăn một quả táo.")).toBeTruthy();
  });

  it("falls back to English and says the Vietnamese is missing", () => {
    render(wrap(<EntryCard entry={entry([])} />));
    expect(screen.getByText("to eat")).toBeTruthy();
    expect(screen.getByText(/Chưa có nghĩa tiếng Việt/)).toBeTruthy();
  });

  it("leaves the examples out of the compact popup form", () => {
    render(wrap(<EntryCard entry={entry(["ăn"])} compact />));
    expect(screen.queryByText("りんごを食べる。")).toBeNull();
  });
});

describe("headwordOf", () => {
  it("shows the kanji, or the kana when the word is usually written in kana", () => {
    const base = entry(["ăn"]);
    expect(headwordOf(base)).toEqual({ word: "食べる", reading: "たべる" });
    const uk = { ...base, kanji: [{ text: "洋杯", common: false, tags: [] }], kana: [{ text: "コップ", common: true, tags: [], appliesToKanji: null }] };
    uk.senses = [{ ...base.senses[0]!, misc: ["uk"] }];
    expect(headwordOf(uk)).toEqual({ word: "コップ", reading: null });
  });
});

describe("labels", () => {
  it("names word classes, folding the godan variants, and falls back to the raw tag", () => {
    expect(posLabel("v5k-s", "vi")).toBe("động từ nhóm 1");
    expect(posLabel("adj-i", "en")).toBe("i-adjective");
    expect(posLabel("zzz", "vi")).toBe("zzz");
    expect(reasonLabel("past", "vi")).toContain("quá khứ");
  });
});

describe("LookupLayer", () => {
  const result: LookupResult = {
    start: 0,
    length: 3,
    matched: "食べる",
    reasons: [],
    entries: [entry(["ăn"])],
    kanji: [],
  };

  function clickOn(el: Element) {
    const text = el.firstChild as Text;
    (document as unknown as { caretPositionFromPoint: unknown }).caretPositionFromPoint = () => ({ offsetNode: text, offset: 1 });
    fireEvent.click(el, { clientX: 10, clientY: 10 });
  }

  it("looks the clicked word up and shows its meaning, then closes on Escape", async () => {
    lookupWord.mockResolvedValue(result);
    render(wrap(<LookupLayer><p>食べる</p></LookupLayer>));
    clickOn(screen.getByText("食べる"));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    expect(lookupWord).toHaveBeenCalledWith("食べる", 1);
    await waitFor(() => expect(screen.getByText("ăn")).toBeTruthy());
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("says so when the word is not in the dictionary", async () => {
    lookupWord.mockResolvedValue(null);
    render(wrap(<LookupLayer><p>ぬぬぬ</p></LookupLayer>));
    clickOn(screen.getByText("ぬぬぬ"));
    await waitFor(() => expect(screen.getByText(/Không tìm thấy từ này/)).toBeTruthy());
  });

  it("ignores clicks on buttons so answering a question is unaffected", () => {
    render(wrap(<LookupLayer><button type="button">選ぶ</button></LookupLayer>));
    clickOn(screen.getByText("選ぶ"));
    expect(lookupWord).not.toHaveBeenCalled();
  });
});
