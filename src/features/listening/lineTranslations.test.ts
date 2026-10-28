import { describe, expect, it } from "vitest";
import { resolveLineTranslations, resolveLineTranslationsWithIssues, splitSentences } from "./lineTranslations";

const seg = (id: string, speaker_id: string, ja: string, vi?: string) => ({
  id,
  speaker_id,
  text: { ja, ...(vi ? { vi } : {}) },
});

describe("splitSentences", () => {
  it("does not end a sentence at an ellipsis or inside a number", () => {
    expect(splitSentences("Mọi người chuyển đồ, thùng rác... từ kho ra quảng trường. Giá 3.5 triệu.")).toEqual([
      "Mọi người chuyển đồ, thùng rác... từ kho ra quảng trường.",
      "Giá 3.5 triệu.",
    ]);
  });
});

describe("resolveLineTranslations", () => {
  const segments = [
    seg("a", "narrator", "ナレ"),
    seg("b", "female", "一つ目。"),
    seg("c", "female", "二つ目。"),
    seg("d", "female", "三つ目。"),
  ];

  it("splits a turn by sentence when the counts match", () => {
    const lines = resolveLineTranslations(
      segments,
      { vi: "Người dẫn: Mở đầu.\nNữ: Một... đó. Hai. Ba." },
      "vi",
    );
    expect(lines).toEqual(["Mở đầu.", "Một... đó.", "Hai.", "Ba."]);
  });

  it("leaves a turn empty instead of shifting its sentences when the counts differ", () => {
    const { lines, issues } = resolveLineTranslationsWithIssues(
      segments,
      { vi: "Người dẫn: Mở đầu.\nNữ: Một. Hai." },
      "vi",
    );
    expect(lines).toEqual(["Mở đầu.", "", "", ""]);
    expect(issues).toEqual([{ turnIndex: 1, segmentIds: ["b", "c", "d"], translatedSentences: 2 }]);
  });

  it("prefers a segment's own translation", () => {
    const own = [seg("a", "narrator", "ナレ", "Một"), seg("b", "female", "二", "Hai")];
    expect(resolveLineTranslations(own, { vi: "Người dẫn: sai\nNữ: sai" }, "vi")).toEqual(["Một", "Hai"]);
  });
});
