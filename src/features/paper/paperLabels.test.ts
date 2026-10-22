import { describe, expect, it } from "vitest";
import { isPaperPart, levelOfLesson, mondaiLabel, mondaiNo, segmentSentence, splitTarget } from "./paperLabels";

describe("splitTarget", () => {
  it("marks the asked-about word of a stem", () => {
    expect(splitTarget("この家の柱はしっかり", "柱")).toEqual([
      { text: "この家の", mark: false },
      { text: "柱", mark: true },
      { text: "はしっかり", mark: false },
    ]);
  });

  it("leaves the stem alone without a target or when it is absent", () => {
    expect(splitTarget("文", undefined)).toEqual([{ text: "文", mark: false }]);
    expect(splitTarget("文", "柱")).toEqual([{ text: "文", mark: false }]);
  });
});

describe("segmentSentence", () => {
  it("cuts a sentence along its chunks in order and keeps the rest", () => {
    const chunks = [{ ja: "市場は" }, { ja: "集まる場" }];
    const parts = segmentSentence("市場はただ集まる場ではない。", chunks);
    expect(parts.map((p) => p.text).join("")).toBe("市場はただ集まる場ではない。");
    expect(parts.filter((p) => p.chunk).map((p) => p.text)).toEqual(["市場は", "集まる場"]);
  });

  it("skips a chunk that is not in the sentence instead of throwing", () => {
    expect(segmentSentence("文です", [{ ja: "学校" }]).map((p) => p.text)).toEqual(["文です"]);
  });
});

describe("labels", () => {
  it("knows the three parts and labels each 問題", () => {
    expect(isPaperPart("reading")).toBe(true);
    expect(isPaperPart("listening")).toBe(false);
    expect(mondaiLabel(8, "vi")).toContain("★");
    expect(mondaiLabel(99, "vi")).toBe("問題99");
  });
});

describe("N4 labels", () => {
  it("prints the booklet 問題 number and names each N4 group", () => {
    expect(levelOfLesson("jlpt-n4-2025-12")).toBe("N4");
    expect(mondaiNo(6, "jlpt-n4-2025-12")).toBe(1);
    expect(mondaiNo(9, "jlpt-n4-2025-12")).toBe(4);
    expect(mondaiNo(6, "jlpt-n2-2025-12")).toBe(6);
    expect(mondaiLabel(7, "vi", "jlpt-n4-2025-12")).toContain("★");
    expect(mondaiLabel(3, "vi", "jlpt-n4-2025-12")).toBe("Từ hợp ngữ cảnh");
  });

  it("names the N1 groups, which differ from N2", () => {
    expect(mondaiLabel(2, "vi", "jlpt-n1-2024-12")).toBe("Từ hợp ngữ cảnh");
    expect(mondaiLabel(2, "vi", "jlpt-n2-2025-12")).not.toBe("Từ hợp ngữ cảnh");
    expect(mondaiLabel(6, "vi", "jlpt-n1-2024-12")).toContain("★");
    expect(mondaiNo(6, "jlpt-n1-2024-12")).toBe(6);
  });
});
