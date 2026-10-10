import { describe, expect, it } from "vitest";
import type { LessonSummary } from "../../shared/api/content";
import type { ExamHistoryEntry } from "../../shared/storage/paperExamStore";
import { filterHistory } from "./examHistoryFilter";

const lesson = (id: string, level: string, year: number, month: number) =>
  ({ id, title: {}, source: { level, year, month }, counts: { questions: 0 } }) as unknown as LessonSummary;
const lessons = new Map([
  ["a", lesson("a", "N2", 2025, 12)],
  ["b", lesson("b", "N2", 2025, 7)],
  ["c", lesson("c", "N1", 2024, 12)],
]);
const title = (id: string) => ({ a: "JLPT N2 · 12/2025", b: "JLPT N2 · 7/2025", c: "JLPT N1 · 12/2024", gone: "Đề cũ" })[id] ?? id;
const entry = (lessonId: string, scope: ExamHistoryEntry["scope"], startedAt: number) =>
  ({ lessonId, scope, minutes: 25, startedAt, submittedAt: startedAt + 1, total: 30, answered: 30, correct: 10 }) as ExamHistoryEntry;
const history = [entry("a", "vocab", 4), entry("b", "all", 3), entry("a", "listening", 2), entry("c", "all", 1)];
const none = { query: "", lessonId: "", scope: "" as const };
const starts = (list: ExamHistoryEntry[]) => list.map((h) => h.startedAt);

describe("filterHistory", () => {
  it("returns everything, in order, when no filter is set", () => {
    expect(starts(filterHistory(history, lessons, title, none))).toEqual([4, 3, 2, 1]);
  });

  it("filters by exam and by part, and by both", () => {
    expect(starts(filterHistory(history, lessons, title, { ...none, lessonId: "a" }))).toEqual([4, 2]);
    expect(starts(filterHistory(history, lessons, title, { ...none, scope: "all" }))).toEqual([3, 1]);
    expect(starts(filterHistory(history, lessons, title, { ...none, lessonId: "a", scope: "listening" }))).toEqual([2]);
  });

  it("searches by level, year and sitting like the lesson list does", () => {
    expect(starts(filterHistory(history, lessons, title, { ...none, query: "n1" }))).toEqual([1]);
    expect(starts(filterHistory(history, lessons, title, { ...none, query: "7/2025" }))).toEqual([3]);
    expect(starts(filterHistory(history, lessons, title, { ...none, query: "2025" }))).toEqual([4, 3, 2]);
  });

  it("still finds a sitting of an exam that is no longer listed, by its title", () => {
    const withGone = [entry("gone", "all", 9), ...history];
    expect(starts(filterHistory(withGone, lessons, title, { ...none, query: "đề cũ" }))).toEqual([9]);
  });
});
