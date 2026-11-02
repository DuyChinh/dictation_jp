import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeDrawing, parseTemplates, recognize, type Point, type StrokeData, type Template } from "./recognize";

const data = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../../../public/handwriting/strokes-v1.json"), "utf8"),
) as StrokeData;
const templates: Template[] = parseTemplates(data);
const find = (ch: string) => templates.find((t) => t.ch === ch)!;

/** A person's drawing of a stored character: the same strokes, a little bigger and moved, with a wobble. */
function drawn(ch: string, opts: { reorder?: boolean; wobble?: number } = {}): Point[][] {
  let n = 0;
  const wobble = opts.wobble ?? 0.8;
  const strokes = find(ch).strokes.map((s) => {
    const pts: Point[] = [];
    for (let i = 0; i < 8; i++) {
      n++;
      pts.push({
        x: 40 + s[i * 2]! * 3.4 + Math.sin(n * 1.7) * wobble,
        y: 25 + s[i * 2 + 1]! * 3.4 + Math.cos(n * 2.3) * wobble,
      });
    }
    return pts;
  });
  return opts.reorder ? [...strokes].reverse() : strokes;
}

describe("handwriting data", () => {
  it("holds kana and kanji, every one with strokes of 8 points", () => {
    for (const ch of ["あ", "ア", "日", "漢", "ー"]) expect(find(ch), ch).toBeTruthy();
    expect(templates.length).toBeGreaterThan(3000);
    expect(templates.every((t) => t.strokes.every((s) => s.length === 16))).toBe(true);
  });
});

describe("normalizeDrawing", () => {
  it("scales a drawing into the 64-unit box whatever size and place it was drawn at", () => {
    const small = normalizeDrawing([[{ x: 10, y: 10 }, { x: 20, y: 30 }]]);
    const large = normalizeDrawing([[{ x: 100, y: 100 }, { x: 300, y: 500 }]]);
    expect([...small[0]!]).toEqual([...large[0]!].map((v) => expect.closeTo(v, 5)));
    const ys = [small[0]![1]!, small[0]![15]!];
    expect(Math.min(...ys)).toBeCloseTo(0, 5);
    expect(Math.max(...ys)).toBeCloseTo(63, 5);
  });

  it("gives nothing for an empty drawing", () => {
    expect(normalizeDrawing([])).toEqual([]);
    expect(recognize([], templates)).toEqual([]);
  });
});

describe("recognize", () => {
  it.each(["日", "人", "漢", "あ", "ア", "ぬ", "め"])("finds %s from a wobbly drawing of it", (ch) => {
    expect(recognize(drawn(ch), templates, 5)).toContain(ch);
    expect(recognize(drawn(ch), templates, 1)[0]).toBe(ch);
  });

  it("still finds it when the strokes were drawn in the wrong order", () => {
    expect(recognize(drawn("日", { reorder: true }), templates, 3)).toContain("日");
    expect(recognize(drawn("漢", { reorder: true }), templates, 5)).toContain("漢");
  });

  it("offers the look-alike pairs rather than only one of them", () => {
    const guesses = recognize(drawn("シ"), templates, 6);
    expect(guesses[0]).toBe("シ");
    expect(guesses).toContain("ツ");
  });

  it("copes with a stroke that was drawn in two pieces", () => {
    const strokes = drawn("日");
    const [first, ...rest] = strokes;
    const split = [first!.slice(0, 4), first!.slice(3), ...rest];
    expect(recognize(split, templates, 5)).toContain("日");
  });

  it("returns at most the number asked for", () => {
    expect(recognize(drawn("日"), templates, 4)).toHaveLength(4);
  });
});
