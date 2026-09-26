import type { LessonSummary } from "../../shared/api/content";
import type { LessonActivity } from "../../shared/storage/lessonActivityStore";

type Sitting = { level: string; year: number; month: number };

function sittingOf(lesson: LessonSummary): Sitting {
  const s = lesson.source ?? {};
  return {
    level: String(s.level ?? "").toLowerCase(),
    year: Number(s.year) || 0,
    month: Number(s.month) || 0,
  };
}

/**
 * Whether a lesson matches what was typed in the search box. Every word must
 * match: a level ("n2"), a year ("2023"), a sitting ("7/2023", "t7/2023",
 * "07-2023", "2023/7", "2023年7月"), a month ("t7", "tháng 7") or, failing
 * those, part of the lesson's title.
 */
export function matchesLessonQuery(lesson: LessonSummary, query: string, title: string): boolean {
  const q = query
    .normalize("NFKC")
    .toLowerCase()
    .replace(/(\d{4})\s*年\s*(\d{1,2})\s*月?/g, "$1/$2")
    .replace(/(\d{1,2})\s*月/g, "t$1")
    .replace(/\b(tháng|thang)\s*(\d{1,2})\b/g, "t$2")
    .replace(/\b(năm|nam|jlpt)\b/g, " ")
    .trim();
  if (!q) return true;

  const { level, year, month } = sittingOf(lesson);
  const text = title.normalize("NFKC").toLowerCase();

  return q.split(/[\s,]+/).every((word) => {
    if (/^n[1-5]$/.test(word)) return word === level;
    if (/^\d{4}$/.test(word)) return Number(word) === year;
    let m = word.match(/^t?(\d{1,2})[/.-](\d{4})$/);
    if (m) return Number(m[1]) === month && Number(m[2]) === year;
    m = word.match(/^(\d{4})[/.-](\d{1,2})$/);
    if (m) return Number(m[1]) === year && Number(m[2]) === month;
    m = word.match(/^t?(\d{1,2})$/);
    if (m) return Number(m[1]) === month;
    return text.includes(word);
  });
}

/**
 * Lessons practised before come first, most recent first; the rest follow
 * newest sitting first (12/2025, 7/2025, 12/2024, …).
 */
export function sortLessons(lessons: LessonSummary[], activity: LessonActivity): LessonSummary[] {
  const key = (l: LessonSummary) => {
    const { year, month } = sittingOf(l);
    return year * 100 + month;
  };
  return [...lessons].sort((a, b) => {
    const at = activity[a.id] ?? 0;
    const bt = activity[b.id] ?? 0;
    if (at !== bt) return bt - at;
    return key(b) - key(a) || a.id.localeCompare(b.id);
  });
}

export type LessonStatus = "todo" | "doing" | "done";

/** Not started, under way, or every dictation sentence attempted (right or wrong). */
export function lessonStatus(attempted: number, total: number): LessonStatus {
  if (attempted <= 0) return "todo";
  return total > 0 && attempted >= total ? "done" : "doing";
}

/** "2 ngày trước" / "2日前" / "2 days ago", or null under a minute ago. */
export function timeAgo(at: number, now: number, lang: string): string | null {
  const minutes = Math.floor((now - at) / 60000);
  if (minutes < 1) return null;
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "always" });
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 7) return rtf.format(-days, "day");
  if (days < 30) return rtf.format(-Math.floor(days / 7), "week");
  if (days < 365) return rtf.format(-Math.floor(days / 30), "month");
  return rtf.format(-Math.floor(days / 365), "year");
}
