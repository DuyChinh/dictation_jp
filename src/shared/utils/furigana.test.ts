import { describe, expect, it } from "vitest";
import { furiganaSegments } from "./furigana";

describe("furiganaSegments", () => {
  it("puts the reading only on the kanji, not on the okurigana", () => {
    expect(furiganaSegments("湧かす", "わかす")).toEqual([{ text: "湧", reading: "わ" }, { text: "かす" }]);
    expect(furiganaSegments("食べる", "たべる")).toEqual([{ text: "食", reading: "た" }, { text: "べる" }]);
  });

  it("handles kana between kanji and in front of them", () => {
    expect(furiganaSegments("受け付け", "うけつけ")).toEqual([
      { text: "受", reading: "う" },
      { text: "け" },
      { text: "付", reading: "つ" },
      { text: "け" },
    ]);
    expect(furiganaSegments("お金", "おかね")).toEqual([{ text: "お" }, { text: "金", reading: "かね" }]);
  });

  it("keeps the whole reading over a pure kanji word", () => {
    expect(furiganaSegments("購入", "こうにゅう")).toEqual([{ text: "購入", reading: "こうにゅう" }]);
  });

  it("matches a katakana reading against hiragana okurigana", () => {
    expect(furiganaSegments("食べる", "タベル")).toEqual([{ text: "食", reading: "た" }, { text: "べる" }]);
  });

  it("falls back to the full reading over the whole word when they cannot be lined up", () => {
    expect(furiganaSegments("今日は", "きょう")).toEqual([{ text: "今日は", reading: "きょう" }]);
  });

  it("returns null when there is nothing to annotate", () => {
    expect(furiganaSegments("コップ", "こっぷ")).toBeNull();
    expect(furiganaSegments("食べる", "")).toBeNull();
    expect(furiganaSegments("食べる", null)).toBeNull();
  });
});
