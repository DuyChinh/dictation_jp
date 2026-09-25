import type { UiLang } from "../i18n/translations";

type Source = Record<string, unknown> | undefined;

function levelOf(source: Source): string {
  return String(source?.level ?? "").toUpperCase();
}

/** "7/2025" from the lesson source, or "" when the sitting is unknown. */
export function lessonSitting(source: Source): string {
  const year = source?.year;
  const month = source?.month;
  if (!year) return "";
  return month ? `${month}/${year}` : String(year);
}

/** Page title, e.g. "JLPT N2 — 7/2025". */
export function lessonTitle(source: Source, fallback: string): string {
  const level = levelOf(source);
  const sitting = lessonSitting(source);
  if (!level || !sitting) return fallback;
  return `JLPT ${level} — ${sitting}`;
}

/** Compact label for breadcrumbs and lists, e.g. "JLPT N2 · 7/2025". */
export function lessonShortTitle(source: Source, fallback: string): string {
  const level = levelOf(source);
  const sitting = lessonSitting(source);
  if (!level || !sitting) return fallback;
  return `JLPT ${level} · ${sitting}`;
}

export function lessonLevel(source: Source): string {
  return levelOf(source) || "JLPT";
}

type PartName = { ja: string; vi: string; en: string };

const PART: Record<string, PartName> = {
  kadai: { ja: "課題理解", vi: "Hiểu vấn đề", en: "Task comprehension" },
  point: { ja: "ポイント理解", vi: "Hiểu điểm chính", en: "Key-point comprehension" },
  gaiyou: { ja: "概要理解", vi: "Hiểu khái quát", en: "Summary comprehension" },
  hatsuwa: { ja: "発話表現", vi: "Diễn đạt bằng lời", en: "Verbal expressions" },
  sokuji: { ja: "即時応答", vi: "Phản xạ nhanh", en: "Quick response" },
  tougou: { ja: "統合理解", vi: "Hiểu tổng hợp", en: "Integrated comprehension" },
};

/** JLPT listening part layout per level (問題1, 問題2, …). */
const LAYOUT: Record<string, string[]> = {
  N1: ["kadai", "point", "gaiyou", "sokuji", "tougou"],
  N2: ["kadai", "point", "gaiyou", "sokuji", "tougou"],
  N3: ["kadai", "point", "gaiyou", "hatsuwa", "sokuji"],
  N4: ["kadai", "point", "hatsuwa", "sokuji"],
  N5: ["kadai", "point", "hatsuwa", "sokuji"],
};

/** Name of a listening part ("Hiểu vấn đề" / 課題理解) from its order, when the level is known. */
export function partType(source: Source, order: number): PartName | null {
  const key = LAYOUT[levelOf(source)]?.[order - 1];
  return key ? PART[key]! : null;
}

export function partLabel(name: PartName | null, lang: UiLang): string {
  if (!name) return "";
  return lang === "ja" ? name.ja : lang === "en" ? name.en : name.vi;
}
