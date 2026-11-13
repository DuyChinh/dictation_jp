import { describe, expect, it } from "vitest";
import { splitLayout } from "./layoutLines";

describe("splitLayout", () => {
  it("turns each line into a paragraph, keeping blank lines and small indents", () => {
    const runs = splitLayout("森田様\n\n　引っ越しの件です。");
    expect(runs).toEqual([
      { kind: "lines", lines: [{ text: "森田様", indent: 0, end: false }, { text: "", indent: 0, end: false }, { text: "引っ越しの件です。", indent: 1, end: false }] },
    ]);
  });

  it("puts a date or a signature far from the left edge at the right instead of padding it with spaces", () => {
    const [run] = splitLayout(`${"　".repeat(30)}9月1日\n本文`);
    expect(run).toMatchObject({ kind: "lines", lines: [{ text: "9月1日", end: true }, { text: "本文", end: false }] });
  });

  it("keeps drawn tables and frames as they are, so they still line up", () => {
    const runs = splitLayout("運賃\n+------+----+\n| 大人 | 3 |\n+------+----+\n・注意\n┌────┐\n│電話\n└────┘");
    expect(runs.map((r) => r.kind)).toEqual(["lines", "grid", "lines", "grid"]);
    expect(runs[1]).toEqual({ kind: "grid", text: "+------+----+\n| 大人 | 3 |\n+------+----+" });
  });
});
