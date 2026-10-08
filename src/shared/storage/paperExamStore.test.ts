import { beforeEach, describe, expect, it } from "vitest";
import {
  clearExam,
  finishExam,
  formatClock,
  getExam,
  lastMinutes,
  parseMinutes,
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
