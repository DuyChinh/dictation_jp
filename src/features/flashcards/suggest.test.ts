import { describe, expect, it } from "vitest";
import type { DictEntry } from "../../shared/api/dictionary";
import { guessLang, isFallback, suggestionFromEntry, suggestionsFromEntries, textFor } from "./suggest";

const entry = (over: Partial<DictEntry> = {}, vi: string[] = ["ăn", "dùng bữa", "ăn uống", "thừa"]): DictEntry => ({
  id: 7,
  common: true,
  jlpt: 5,
  kanji: [{ text: "食べる", common: true, tags: [] }],
  kana: [{ text: "たべる", common: true, tags: [], appliesToKanji: null }],
  senses: [
    { pos: ["v1"], field: [], misc: [], info: [], appliesToKanji: null, appliesToKana: null, glosses: ["to eat", "to have a meal", "to consume"], vi, examples: [] },
  ],
  viSource: "ai",
  ...over,
});

describe("suggestionFromEntry", () => {
  it("gives the headword, reading and the first few meanings in each language", () => {
    const s = suggestionFromEntry(entry());
    expect(s).toMatchObject({ entryId: 7, ja: "食べる", reading: "たべる", jlpt: 5, viFallback: false });
    expect(textFor(s, "vi")).toBe("ăn; dùng bữa");
    expect(textFor(s, "en")).toBe("to eat; to have a meal");
    expect(textFor(s, "ja")).toBe("食べる");
  });
  it("uses the English meaning, marked, when there is no Vietnamese yet", () => {
    const s = suggestionFromEntry(entry({}, []));
    expect(s.vi).toBe("to eat; to have a meal");
    expect(isFallback(s, "vi")).toBe(true);
    expect(isFallback(s, "en")).toBe(false);
  });
  it("shows the kana for a word usually written in kana", () => {
    const e = entry();
    e.senses[0]!.misc = ["uk"];
    expect(suggestionFromEntry(e).ja).toBe("たべる");
  });
  it("skips entries with no usable text", () => {
    const empty = entry({ kanji: [], kana: [] });
    expect(suggestionsFromEntries([empty, entry()])).toHaveLength(1);
  });
});

describe("guessLang", () => {
  it("tells Japanese, Vietnamese and English apart", () => {
    expect(guessLang("食べる")).toBe("ja");
    expect(guessLang("ラーメン")).toBe("ja");
    expect(guessLang("ăn cơm")).toBe("vi");
    expect(guessLang("to eat")).toBe("en");
  });
});
