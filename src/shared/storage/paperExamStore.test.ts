import { beforeEach, describe, expect, it } from "vitest";
import {
  clearExam,
  finishExam,
  formatClock,
  getExam,
  getExamHistory,
  getExamSitting,
  lastMinutes,
  listRunningExams,
  markExamPlayed,
  parseMinutes,
  reviewableSittings,
  setExamAnswer,
  startExam,
  toggleExamFlag,
} from "./paperExamStore";

beforeEach(() => localStorage.clear());

describe("parseMinutes", () => {
  it("accepts whole minutes from 1 to 180", () => {
    expect(parseMinutes("45")).toBe(45);
    expect(parseMinutes(" 1 ")).toBe(1);
    expect(parseMinutes("180")).toBe(180);
  });

  it("rejects empty, zero, too long, decimals and text", () => {
    for (const bad of ["", "0", "181", "999", "12.5", "-5", "abc", "4 5"]) {
      expect(parseMinutes(bad), bad).toBeNull();
    }
  });
});

describe("formatClock", () => {
  it("shows minutes:seconds, and hours from one hour", () => {
    expect(formatClock(5 * 60_000 + 7_000)).toBe("5:07");
    expect(formatClock(60 * 60_000)).toBe("1:00:00");
    expect(formatClock(65 * 60_000 + 5_000)).toBe("1:05:05");
  });

  it("rounds a partial second up and never goes negative", () => {
    expect(formatClock(1_200)).toBe("0:02");
    expect(formatClock(-5_000)).toBe("0:00");
  });
});

describe("exam session", () => {
  it("fixes the deadline at start so a reload does not restart the clock", () => {
    const s = startExam("l", "all", 25, 1_000_000);
    expect(s.endsAt).toBe(1_000_000 + 25 * 60_000);
    expect(getExam("l")?.endsAt).toBe(s.endsAt);
  });

  it("keeps answers and flags, and the result once finished", () => {
    startExam("l", "vocab", 20);
    setExamAnswer("l", "q1", "3");
    toggleExamFlag("l", "q1");
    expect(getExam("l")).toMatchObject({ answers: { q1: "3" }, flagged: { q1: true } });
    toggleExamFlag("l", "q1");
    expect(getExam("l")?.flagged).toEqual({});

    finishExam("l", { scope: "vocab", total: 1, answered: 1, correct: 1, items: [] }, 5);
    expect(getExam("l")).toMatchObject({ submittedAt: 5, result: { correct: 1 } });
    clearExam("l");
    expect(getExam("l")).toBeNull();
  });

  it("remembers the last chosen minutes", () => {
    expect(lastMinutes()).toBe(40);
    startExam("l", "all", 25);
    expect(lastMinutes()).toBe(25);
  });
});

describe("exam history", () => {
  const result = (correct: number) => ({ scope: "all" as const, total: 71, answered: 70, correct, items: [] });

  it("keeps a line for each submitted sitting, newest first, even after a retake replaces the session", () => {
    startExam("a", "all", 40, 1_000);
    finishExam("a", result(50), 2_000);
    startExam("a", "all", 40, 3_000);
    finishExam("a", result(60), 4_000);
    const history = getExamHistory();
    expect(history.map((h) => h.correct)).toEqual([60, 50]);
    expect(history[0]).toMatchObject({ lessonId: "a", scope: "all", minutes: 40, startedAt: 3_000, submittedAt: 4_000, total: 71 });
  });

  it("does not list a sitting that was never submitted", () => {
    startExam("a", "vocab", 20);
    expect(getExamHistory()).toEqual([]);
  });

  it("does not record the same sitting twice", () => {
    startExam("a", "all", 40, 1_000);
    finishExam("a", result(50), 2_000);
    finishExam("a", result(50), 2_500);
    expect(getExamHistory()).toHaveLength(1);
  });
});

describe("reviewing past sittings", () => {
  const item = { item_id: "q1", no: 1, part: "vocab" as const, mondai: 1, selected: "2", correct_choice_id: "1", correct: false };
  const result = (correct: number) => ({ scope: "all" as const, total: 1, answered: 1, correct, items: [item] });

  it("opens a sitting a retake has since replaced, from the history", () => {
    startExam("a", "all", 40, 1_000);
    finishExam("a", result(0), 2_000);
    startExam("a", "all", 40, 3_000);
    finishExam("a", result(1), 4_000);
    expect(getExamSitting("a", 3_000)?.result?.correct).toBe(1);
    expect(getExamSitting("a", 1_000)).toMatchObject({ lessonId: "a", minutes: 40, submittedAt: 2_000, result: { correct: 0 } });
    expect(reviewableSittings()).toEqual(new Set(["a:1000", "a:3000"]));
  });

  it("has nothing to open for a sitting that was not submitted or is unknown", () => {
    startExam("a", "all", 40, 1_000);
    expect(getExamSitting("a", 1_000)).toBeNull();
    expect(getExamSitting("a", 9)).toBeNull();
    expect(reviewableSittings().size).toBe(0);
  });

  it("keeps the detail of the newest sittings only, the score line of older ones", () => {
    for (let i = 0; i < 32; i++) {
      startExam(`l${i}`, "all", 40, 1_000 + i);
      finishExam(`l${i}`, result(1), 2_000 + i);
      clearExam(`l${i}`);
    }
    const history = getExamHistory();
    expect(history).toHaveLength(32);
    expect(history[0]!.result).toBeDefined();
    expect(history[29]!.result).toBeDefined();
    expect(history[30]!.result).toBeUndefined();
    expect(reviewableSittings().size).toBe(30);
  });
});

describe("listRunningExams", () => {
  it("lists only sittings not yet submitted, the one ending soonest first", () => {
    startExam("late", "all", 60, 0);
    startExam("soon", "vocab", 20, 0);
    startExam("done", "all", 40, 0);
    finishExam("done", { scope: "all", total: 1, answered: 1, correct: 1, items: [] }, 10);
    expect(listRunningExams().map((s) => s.lessonId)).toEqual(["soon", "late"]);
  });
});

describe("listening sittings", () => {
  it("remember whether replays are allowed and which questions were already played", () => {
    const strict = startExam("a", "listening", 40, 0);
    expect(strict).toMatchObject({ scope: "listening", allowReplay: false, played: {} });
    markExamPlayed("a", "unit-1");
    expect(getExam("a")?.played).toEqual({ "unit-1": true });

    const loose = startExam("b", "listening", 40, 0, { allowReplay: true });
    expect(loose.allowReplay).toBe(true);
  });

  it("leave the listening options out of a written sitting", () => {
    const written = startExam("w", "all", 40, 0, { allowReplay: true });
    expect(written.allowReplay).toBeUndefined();
    expect(written.played).toBeUndefined();
  });
});
