/**
 * A notice, letter or e-mail is stored as a block of text with its own line breaks and indents. On a narrow screen a long
 * line must wrap rather than make the page scroll sideways, so the block is cut into runs: drawn tables and frames
 * (lines that start with + | ┌ │ ...) stay as they are, and every other line becomes a paragraph that wraps.
 */
export type LayoutRun =
  | { kind: "grid"; text: string }
  | { kind: "lines"; lines: Array<{ text: string; indent: number; end: boolean }> };

const GRID_LINE = /^[\s　]*[+|┌┐└┘├┤┬┴┼│─━]/;
/** A line pushed this far from the left edge is a date or a signature, kept at the right edge instead of indented. */
const END_ALIGNED = 8;
const MAX_INDENT = 3;

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

export function splitLayout(layout: string): LayoutRun[] {
  const runs: LayoutRun[] = [];
  for (const line of layout.split("\n")) {
    if (GRID_LINE.test(line)) {
      const last = runs[runs.length - 1];
      if (last?.kind === "grid") last.text += `\n${line}`;
      else runs.push({ kind: "grid", text: line });
      continue;
    }
    const { width, rest } = lead(line);
    const item = rest === "" ? { text: "", indent: 0, end: false } : { text: rest, indent: Math.min(MAX_INDENT, width), end: width >= END_ALIGNED };
    const last = runs[runs.length - 1];
    if (last?.kind === "lines") last.lines.push(item);
    else runs.push({ kind: "lines", lines: [item] });
  }
  return runs;
}
