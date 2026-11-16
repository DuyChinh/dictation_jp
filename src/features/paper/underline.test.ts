import { describe, expect, it } from "vitest";
import { findPhrase, underlinePieces } from "./underline";

const texts = (rows: ReturnType<typeof underlinePieces>) => rows.map((r) => r.map((p) => (p.mark ? `[${p.text}]` : p.text)).join(""));

describe("underlinePieces", () => {
  it("marks the phrase inside its sentence, once", () => {
    const pending = new Set(["当たり前のこと"]);
    const rows = underlinePieces([{ text: "これは当たり前のことです。" }, { text: "当たり前のことは多い。" }], pending);
    expect(texts(rows)).toEqual(["これは[当たり前のこと]です。", "当たり前のことは多い。"]);
    expect(pending.size).toBe(0);
  });

  it("marks a phrase that runs from one sentence into the next", () => {
    const rows = underlinePieces([{ text: "必ずしも良いこと" }, { text: "ではない。次の文。" }], new Set(["良いことではない"]));
    expect(texts(rows)).toEqual(["必ずしも[良いこと]", "[ではない]。次の文。"]);
  });

  it("leaves a phrase that is not in this paragraph for a later one", () => {
    const pending = new Set(["別の段落の語"]);
    expect(texts(underlinePieces([{ text: "何もない文。" }], pending))).toEqual(["何もない文。"]);
    expect(pending.has("別の段落の語")).toBe(true);
  });

  it("keeps two phrases apart and never overlaps them", () => {
    const rows = underlinePieces([{ text: "ねこは孤独な生き物です。" }], new Set(["孤独な生き物", "生き物です"]));
    expect(texts(rows)).toEqual(["ねこは[孤独な生き物]です。"]);
  });

  it("finds a phrase that has a footnote marker in the middle of it", () => {
    const text = "それがモチベーショ（注2）ンへの責任も持つことだ。";
    expect(findPhrase(text, "モチベーションへの責任も持つ")).toEqual([3, text.indexOf("持つ") + 2]);
    expect(findPhrase(text, "存在しない")).toBeNull();
    const rows = underlinePieces([{ text }], new Set(["モチベーションへの責任も持つ"]));
    expect(rows[0]!.filter((p) => p.mark)).toHaveLength(1);
  });
});
