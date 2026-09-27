import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addPracticeSession, getPracticeHistory, saveUserStats, syncHistoryFromServer } from "./practiceHistoryStore";

const base = { lessonTitle: "N2", level: "JLPT", score: 10, maxStreak: 3, correctCount: 30, totalCount: 300, mascot: "shiba" };

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("addPracticeSession", () => {
  it("keeps one session per lesson per day, updated by later checks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 26, 9));
    addPracticeSession({ ...base, lessonId: "a" });
    addPracticeSession({ ...base, lessonId: "b" });
    vi.setSystemTime(new Date(2026, 8, 26, 21));
    addPracticeSession({ ...base, lessonId: "a", correctCount: 45, maxStreak: 1 });

    const history = getPracticeHistory();
    expect(history.map((h) => h.lessonId)).toEqual(["a", "b"]);
    expect(history[0]).toMatchObject({ correctCount: 45, maxStreak: 3 });
  });

  it("starts a new session on a new day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 25, 9));
    addPracticeSession({ ...base, lessonId: "a" });
    vi.setSystemTime(new Date(2026, 8, 26, 9));
    addPracticeSession({ ...base, lessonId: "a" });
    expect(getPracticeHistory()).toHaveLength(2);
  });
});

describe("syncHistoryFromServer", () => {
  it("keeps this browser's running streak and the better best streak", async () => {
    localStorage.setItem("token", "t");
    saveUserStats({ bestStreak: 12, currentStreak: 4 });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ stats: { bestStreak: 8, currentStreak: 0 }, history: [] }))),
    );
    const { stats } = await syncHistoryFromServer();
    expect(stats).toMatchObject({ bestStreak: 12, currentStreak: 4 });
  });
});
