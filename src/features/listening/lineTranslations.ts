import type { LocalizedText } from "../../shared/content/getLocalizedText";

export type TranslatableSegment = {
  id?: string;
  speaker_id: string;
  text: LocalizedText;
};

export type SupportedTranslationLang = "vi" | "en";

function usable(text: string): boolean {
  const s = text.trim();
  return s !== "" && s !== "—";
}

/**
 * Splits a translated turn into sentences. A "." only ends a sentence when whitespace (or the end)
 * follows it, so "3.5" stays whole, and an ellipsis ("..." or "…") never ends one, because the
 * translator uses it mid-sentence ("thùng rác... từ kho hiện tại ra quảng trường").
 */
export function splitSentences(text: string): string[] {
  const sents: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    cur += ch;
    if (ch === "“" || ch === "”" || ch === "\"" || ch === "「" || ch === "」") {
      inQuote = !inQuote;
    }
    if (!inQuote && (ch === "." || ch === "?" || ch === "!")) {
      const nextChar = text[i + 1];
      if (ch === "." && nextChar && /\d/.test(nextChar)) continue;
      if (ch === "." && (nextChar === "." || text[i - 1] === ".")) continue;
      if (i === text.length - 1 || /\s/.test(nextChar ?? "")) {
        sents.push(cur.trim());
        cur = "";
      }
    }
  }
  if (cur.trim()) sents.push(cur.trim());
  return sents.filter(Boolean);
}

/** The translated sentences of one turn, or null when their number differs from the Japanese segments. */
export function alignTurnSentences(lineText: string, segmentCount: number): string[] | null {
  const sents = splitSentences(lineText);
  return sents.length === segmentCount ? sents : null;
}

export type LineTranslationIssue = {
  turnIndex: number;
  segmentIds: string[];
  translatedSentences: number;
};

/**
 * Translation of every segment: its own `text[lang]` first, otherwise the matching part of the
 * whole-dialogue translation. A turn whose translated sentences don't line up one to one with its
 * Japanese segments is left empty (and reported in `issues`) rather than guessed, since a guess
 * shifts every following line.
 */
export function resolveLineTranslationsWithIssues(
  segments: TranslatableSegment[],
  dialogue: LocalizedText | null | undefined,
  lang: SupportedTranslationLang,
): { lines: string[]; issues: LineTranslationIssue[] } {
  const direct = segments.map((s) => (usable(s.text[lang] ?? "") ? s.text[lang]!.trim() : ""));
  const issues: LineTranslationIssue[] = [];
  if (direct.every((t) => !!t)) return { lines: direct, issues };

  const full = dialogue && usable(dialogue[lang] ?? "") ? dialogue[lang]!.trim() : "";
  if (!full) return { lines: direct, issues };

  const lines = full.split("\n").map((l) => l.trim()).filter(Boolean);
  const turns: Array<{ speaker_id: string; segments: Array<{ seg: TranslatableSegment; sIdx: number }> }> = [];
  for (let sIdx = 0; sIdx < segments.length; sIdx++) {
    const seg = segments[sIdx]!;
    const last = turns[turns.length - 1];
    if (last && last.speaker_id === seg.speaker_id) last.segments.push({ seg, sIdx });
    else turns.push({ speaker_id: seg.speaker_id, segments: [{ seg, sIdx }] });
  }

  const result = [...direct];

  if (lines.length === turns.length) {
    for (let tIdx = 0; tIdx < turns.length; tIdx++) {
      const turn = turns[tIdx]!;
      const lineText = lines[tIdx]!.replace(/^[^:：]+[:：]\s*/, "").trim();
      if (turn.segments.length === 1) {
        const sIdx = turn.segments[0]!.sIdx;
        if (!result[sIdx]) result[sIdx] = lineText;
        continue;
      }
      if (turn.segments.every(({ sIdx }) => !!result[sIdx])) continue;
      const sents = alignTurnSentences(lineText, turn.segments.length);
      if (!sents) {
        issues.push({
          turnIndex: tIdx,
          segmentIds: turn.segments.map(({ seg }) => seg.id ?? ""),
          translatedSentences: splitSentences(lineText).length,
        });
        continue;
      }
      for (let i = 0; i < sents.length; i++) {
        const sIdx = turn.segments[i]!.sIdx;
        if (!result[sIdx]) result[sIdx] = sents[i]!;
      }
    }
  } else if (lines.length === segments.length) {
    for (let i = 0; i < segments.length; i++) {
      if (!result[i]) result[i] = lines[i]!.replace(/^[^:：]+[:：]\s*/, "").trim();
    }
  } else {
    issues.push({ turnIndex: -1, segmentIds: segments.map((s) => s.id ?? ""), translatedSentences: lines.length });
  }

  return { lines: result, issues };
}

export function resolveLineTranslations(
  segments: TranslatableSegment[],
  dialogue: LocalizedText | null | undefined,
  lang: SupportedTranslationLang,
): string[] {
  return resolveLineTranslationsWithIssues(segments, dialogue, lang).lines;
}
