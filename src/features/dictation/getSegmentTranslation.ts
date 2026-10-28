import type { PracticeQuestion, PracticeSegment } from "../../shared/api/content";
import { resolveLineTranslations } from "../listening/lineTranslations";

/**
 * Translation for one segment: its own `text[lang]`, otherwise the matching part of the question's
 * whole-dialogue translation. Returns "" rather than a guess when the dialogue translation can't be
 * matched to the segments one to one.
 */
export function getSegmentTranslation(
  segment: PracticeSegment,
  question: PracticeQuestion,
  lang: string
): string {
  if (lang !== "vi" && lang !== "en") return "";

  const idx = question.segments.findIndex((s) => s.id === segment.id);
  if (idx < 0) return "";

  const lines = resolveLineTranslations(
    question.segments,
    question.dialogue_translation,
    lang
  );
  return lines[idx] ?? "";
}
