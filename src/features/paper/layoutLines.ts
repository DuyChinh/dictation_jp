/**
 * A notice, letter or e-mail is stored as a block of text with its own line breaks and indents. On a narrow screen a long
 * line must wrap rather than make the page scroll sideways, so the block is cut into runs:
 *  - tables (lines drawn with + | ┌ │ ..., or whose columns are lined up with runs of spaces) stay as they are and scroll;
 *  - a framed box (┌ ... └ with ｜ down the side) becomes a bordered box whose lines wrap;
 *  - every other line becomes a paragraph that wraps, with the sentences that the print width cut in two put back together.
 */
export type LayoutLine = { text: string; indent: number; end: boolean };
export type LayoutRun = { kind: "grid"; text: string } | { kind: "lines"; framed: boolean; lines: LayoutLine[] };

const BARS = "+|┌┐└┘├┤┬┴┼│─━｜＋";
const GRID_LINE = new RegExp(`^[\\s\\u3000]*[${BARS}]`);
const FRAME_TOP = /^[\s　]*[┌┏]/;
const FRAME_BOTTOM = /^[\s　]*[└┗]/;
const FRAME_SIDE = /^[\s　]*[｜│|]/;
/** Two or more spaces between words: columns lined up by hand. */
const COLUMNS = /\S[\s　]{2,}\S/;
const SENTENCE_END = /[。！？」』）)]$/;
/** A line that ends in a number or Latin letters is an address, a date or an e-mail header, not half a sentence. */
const DATA_END = /[0-9A-Za-z０-９]$/;
const LIST_START = /^[・▼●■◆◇▲△★☆○◎※]/;
/** A line pushed this far from the left edge is a date or a signature, kept at the right edge instead of indented. */
const END_ALIGNED = 8;
const MAX_INDENT = 3;
const FULL_LINE = 0.8;
/** Below this the block is too short to tell a print width from a short line. */
const MIN_PRINT_WIDTH = 24;

/** Display width in full-width characters: kana and kanji count 1, digits and Latin letters 0.5. */
const widthOf = (text: string): number => [...text].reduce((w, ch) => w + (ch.charCodeAt(0) < 0x2000 ? 0.5 : 1), 0);

function lead(line: string): { width: number; rest: string } {
  let width = 0;
  let i = 0;
  for (; i < line.length; i++) {
    if (line[i] === "　") width += 1;
    else if (line[i] === " ") width += 0.5;
    else break;
  }
  return { width, rest: line.slice(i) };
}

const isGrid = (line: string): boolean => GRID_LINE.test(line) || COLUMNS.test(line.trim());

function toLine(raw: string): LayoutLine {
  const { width, rest } = lead(raw);
  return rest === "" ? { text: "", indent: 0, end: false } : { text: rest, indent: Math.min(MAX_INDENT, width), end: width >= END_ALIGNED };
}

/** The exam prints a line at a fixed width and breaks a sentence wherever the line runs out; this puts such sentences back. */
function mendBreaks(lines: LayoutLine[], printWidth: number): LayoutLine[] {
  if (printWidth < MIN_PRINT_WIDTH) return lines;
  const out: LayoutLine[] = [];
  let lastRaw = 0;
  for (const l of lines) {
    const prev = out[out.length - 1];
    const joins =
      prev && prev.text && l.text && !prev.end && !l.end && !SENTENCE_END.test(prev.text) && !DATA_END.test(prev.text) && !LIST_START.test(l.text) && lastRaw >= printWidth * FULL_LINE;
    if (joins) prev.text += l.text;
    else out.push({ ...l });
    lastRaw = widthOf(l.text);
  }
  return out;
}

export function splitLayout(layout: string): LayoutRun[] {
  const runs: LayoutRun[] = [];
  let frame: LayoutLine[] | null = null;
  const pushLine = (item: LayoutLine) => {
    const last = runs[runs.length - 1];
    if (last?.kind === "lines" && !last.framed) last.lines.push(item);
    else runs.push({ kind: "lines", framed: false, lines: [item] });
  };
  for (const line of layout.split("\n")) {
    if (frame) {
      if (FRAME_BOTTOM.test(line)) {
        runs.push({ kind: "lines", framed: true, lines: frame });
        frame = null;
      } else frame.push(toLine(line.replace(FRAME_SIDE, "")));
      continue;
    }
    if (FRAME_TOP.test(line)) {
      frame = [];
      continue;
    }
    if (isGrid(line)) {
      const last = runs[runs.length - 1];
      if (last?.kind === "grid") last.text += `\n${line}`;
      else runs.push({ kind: "grid", text: line });
      continue;
    }
    pushLine(toLine(line));
  }
  if (frame) runs.push({ kind: "lines", framed: true, lines: frame });
  // a line the width cut off never finishes a sentence, and none is longer than the width: the longest such line is the width
  const printWidth = Math.max(
    0,
    ...runs.flatMap((r) => (r.kind === "lines" ? r.lines.filter((l) => !l.end && l.text && !SENTENCE_END.test(l.text) && !DATA_END.test(l.text)).map((l) => widthOf(l.text)) : [])),
  );
  return runs.map((r) => (r.kind === "lines" ? { ...r, lines: mendBreaks(r.lines, printWidth) } : r));
}
