/**
 * In the exam booklet the part of a passage a question asks about is underlined ("下線部…とあるが"). The question carries the
 * phrase (stem.target); this finds it in the passage so it can be underlined there too.
 */
export type Piece = { text: string; mark: boolean };

/** The phrases the questions underline, in the order of the questions. */
export const underlinesOf = (items: ReadonlyArray<{ stem: { target?: string } }>): string[] =>
  items.map((i) => i.stem.target).filter((t): t is string => !!t);

const MARKER = "(?:（注\\d*）)?";
/** Where a phrase sits in the text, allowing a footnote marker such as （注2） between its letters (the question leaves it out). */
export function findPhrase(text: string, phrase: string): [number, number] | null {
  const at = text.indexOf(phrase);
  if (at >= 0) return [at, at + phrase.length];
  const chars = [...phrase].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const m = new RegExp(chars.join(MARKER)).exec(text);
  return m ? [m.index, m.index + m[0].length] : null;
}

/**
 * Cuts the sentences of one paragraph into pieces, marking the first place each phrase of `pending` occurs (a phrase may run
 * from one sentence into the next). A phrase that was marked is taken out of `pending`, so it is underlined once in the passage.
 */
export function underlinePieces(sentences: ReadonlyArray<{ text: string }>, pending: Set<string>): Piece[][] {
  const joined = sentences.map((s) => s.text).join("");
  const ranges: Array<[number, number]> = [];
  for (const phrase of pending) {
    if (!phrase) continue;
    const hit = findPhrase(joined, phrase);
    if (!hit) continue;
    const [at, end] = hit;
    if (ranges.some(([a, b]) => at < b && end > a)) continue;
    ranges.push([at, end]);
    pending.delete(phrase);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  let offset = 0;
  return sentences.map((s) => {
    const start = offset;
    const end = start + s.text.length;
    offset = end;
    const pieces: Piece[] = [];
    let cursor = start;
    for (const [a, b] of ranges) {
      const from = Math.max(a, start);
      const to = Math.min(b, end);
      if (to <= from) continue;
      if (from > cursor) pieces.push({ text: joined.slice(cursor, from), mark: false });
      pieces.push({ text: joined.slice(from, to), mark: true });
      cursor = to;
    }
    if (cursor < end) pieces.push({ text: joined.slice(cursor, end), mark: false });
    return pieces.length ? pieces : [{ text: s.text, mark: false }];
  });
}
