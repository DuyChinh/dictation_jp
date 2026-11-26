/**
 * Furigana alignment: given a word and its full kana reading, work out which part of the reading belongs to the
 * kanji, so the reading is only written above the kanji and not above the kana that already spell themselves
 * (湧かす + わかす → 湧 gets "わ"; the "かす" is left alone).
 */

export type FuriganaSegment = { text: string; reading?: string };

const KANJI = /[㐀-䶿一-鿿豈-﫿々〆]/u;

const toHiragana = (s: string): string => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** Splits a word into alternating runs: kanji runs and everything else (okurigana, kana, symbols). */
function runsOf(word: string): { text: string; kanji: boolean }[] {
  const runs: { text: string; kanji: boolean }[] = [];
  for (const ch of word) {
    const kanji = KANJI.test(ch);
    const last = runs[runs.length - 1];
    if (last && last.kanji === kanji) last.text += ch;
    else runs.push({ text: ch, kanji });
  }
  return runs;
}

/** Matches the runs against the reading from `pos`; each kanji run takes the shortest reading that lets the rest fit. */
function align(runs: { text: string; kanji: boolean }[], reading: string, i: number, pos: number): string[] | null {
  const run = runs[i];
  if (!run) return pos === reading.length ? [] : null;
  if (!run.kanji) {
    const lit = toHiragana(run.text);
    if (!reading.startsWith(lit, pos)) return null;
    const rest = align(runs, reading, i + 1, pos + lit.length);
    return rest && ["", ...rest];
  }
  // A kanji run takes at least one kana; try the shortest first.
  for (let end = pos + 1; end <= reading.length; end++) {
    const rest = align(runs, reading, i + 1, end);
    if (rest) return [reading.slice(pos, end), ...rest];
  }
  return null;
}

/**
 * The word cut into segments, each kanji run carrying only its own reading. Returns null when the word has no
 * kanji (nothing to put furigana on); when the reading cannot be matched up with the word, the whole word is one
 * segment carrying the full reading.
 */
export function furiganaSegments(word: string, reading: string | null | undefined): FuriganaSegment[] | null {
  const runs = runsOf(word);
  if (!runs.some((r) => r.kanji)) return null;
  const kana = toHiragana((reading ?? "").trim());
  if (!kana || kana === toHiragana(word)) return null;
  const parts = align(runs, kana, 0, 0);
  if (!parts) return [{ text: word, reading: reading!.trim() }];
  return runs.map((r, i) => (r.kanji ? { text: r.text, reading: parts[i] } : { text: r.text }));
}
