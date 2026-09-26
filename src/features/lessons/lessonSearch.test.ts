import { describe, expect, it } from "vitest";
import type { LessonSummary } from "../../shared/api/content";
import { lessonStatus, matchesLessonQuery, sortLessons, timeAgo } from "./lessonSearch";

function lesson(level: string, year: number, month: number): LessonSummary {
  return {
    id: `jlpt-${level.toLowerCase()}-${year}-${String(month).padStart(2, "0")}`,
    title: { vi: "" },
    source: { type: "jlpt", level, year, month },
    status: "published",
    content_version: 1,
    counts: { sections: 5, questions: 30, dictation_segments: 100 },
  };
}

const n2Jul23 = lesson("N2", 2023, 7);
const n2Dec23 = lesson("N2", 2023, 12);
const n3Jul23 = lesson("N3", 2023, 7);
const n2Dec25 = lesson("N2", 2025, 12);
const n2Jul25 = lesson("N2", 2025, 7);
const n2Dec24 = lesson("N2", 2024, 12);

function find(query: string, lessons = [n2Jul23, n2Dec23, n3Jul23, n2Dec25]) {
  return lessons.filter((l) => matchesLessonQuery(l, query, `JLPT ${l.source.level} — ${l.source.month}/${l.source.year}`)).map((l) => l.id);
}

describe("matchesLessonQuery", () => {
  it("finds every sitting of a year", () => {
    expect(find("2023")).toEqual([n2Jul23.id, n2Dec23.id, n3Jul23.id]);
  });

  it("finds one sitting, however it is written", () => {
    for (const q of ["7/2023", "07/2023", "t7/2023", "T7/2023", "7-2023", "2023/7", "2023-07", "tháng 7 2023", "2023年7月"]) {
      expect(find(q), q).toEqual([n2Jul23.id, n3Jul23.id]);
    }
  });

  it("combines a level with a sitting", () => {
    expect(find("n2 7/2023")).toEqual([n2Jul23.id]);
    expect(find("JLPT N2 2023")).toEqual([n2Jul23.id, n2Dec23.id]);
  });

  it("finds a month across years", () => {
    expect(find("t12")).toEqual([n2Dec23.id, n2Dec25.id]);
  });

  it("shows everything for an empty box and nothing for a miss", () => {
    expect(find("  ")).toHaveLength(4);
    expect(find("2019")).toEqual([]);
  });
});

describe("sortLessons", () => {
  const all = [n2Dec24, n2Jul23, n2Dec25, n2Jul25];

  it("puts the newest sitting first by default", () => {
    expect(sortLessons(all, {}).map((l) => l.id)).toEqual([n2Dec25.id, n2Jul25.id, n2Dec24.id, n2Jul23.id]);
  });

  it("puts recently practised lessons first, most recent first", () => {
    const sorted = sortLessons(all, { [n2Jul23.id]: 1000, [n2Jul25.id]: 2000 });
    expect(sorted.map((l) => l.id)).toEqual([n2Jul25.id, n2Jul23.id, n2Dec25.id, n2Dec24.id]);
  });
});

describe("lessonStatus", () => {
  it("is todo before any sentence, doing part-way, done once every sentence is attempted", () => {
    expect(lessonStatus(0, 300)).toBe("todo");
    expect(lessonStatus(1, 300)).toBe("doing");
    expect(lessonStatus(300, 300)).toBe("done");
  });
});

describe("timeAgo", () => {
  const now = Date.UTC(2026, 8, 26, 12);
  const ago = (ms: number) => timeAgo(now - ms, now, "vi");
  const MIN = 60_000;

  it("counts in the largest whole unit", () => {
    expect(ago(30 * 1000)).toBeNull();
    expect(ago(5 * MIN)).toBe("5 phút trước");
    expect(ago(3 * 60 * MIN)).toBe("3 giờ trước");
    expect(ago(2 * 24 * 60 * MIN)).toBe("2 ngày trước");
    expect(ago(21 * 24 * 60 * MIN)).toBe("3 tuần trước");
    expect(timeAgo(now - 2 * 24 * 60 * MIN, now, "en")).toBe("2 days ago");
  });
});
