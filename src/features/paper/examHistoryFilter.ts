import type { LessonSummary } from "../../shared/api/content";
import type { ExamScope } from "../../shared/api/paper";
import type { ExamHistoryEntry } from "../../shared/storage/paperExamStore";
import { matchesLessonQuery } from "../lessons/lessonSearch";

export type HistoryFilter = {
  /** Free text: level, year, sitting ("7/2023") or part of the exam's title. */
  query: string;
  /** One exam's lesson id; empty for every exam. */
  lessonId: string;
  /** One part of the exam; "" for every part. */
  scope: ExamScope | "";
};

/**
 * The sittings that match every filter that is set, in their given (newest first) order.
 * `title` names a lesson the way the page shows it, so searching finds what the user sees.
 */
export function filterHistory(
  history: ExamHistoryEntry[],
  lessons: Map<string, LessonSummary>,
  title: (lessonId: string) => string,
  { query, lessonId, scope }: HistoryFilter,
): ExamHistoryEntry[] {
  return history.filter((h) => {
    if (lessonId && h.lessonId !== lessonId) return false;
    if (scope && h.scope !== scope) return false;
    if (!query.trim()) return true;
    const lesson = lessons.get(h.lessonId);
    // A lesson that is no longer listed can only be found by its title.
    return lesson ? matchesLessonQuery(lesson, query, title(h.lessonId)) : title(h.lessonId).toLowerCase().includes(query.trim().toLowerCase());
  });
}
