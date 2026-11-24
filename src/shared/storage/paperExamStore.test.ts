import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  advanceToListening,
  clearExam,
  finishExam,
  formatClock,
  getExam,
  getExamHistory,
  getExamSitting,
  lastMinutes,
  levelMinutes,
  listRunningExams,
  markExamPlayed,
  parseMinutes,
  reviewableSittings,
  setExamAnswer,
  startExam,
  startFullExam,
  suggestedMinutes,
  syncExamHistoryFromServer,
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

describe("official time per level", () => {
  it("is the JLPT written + listening time of each level", () => {
    expect(levelMinutes("N1")).toEqual({ written: 110, listening: 60 });
    expect(levelMinutes("N2")).toEqual({ written: 105, listening: 50 });
    expect(levelMinutes("N3")).toEqual({ written: 100, listening: 40 });
    expect(levelMinutes("N4")).toEqual({ written: 80, listening: 35 });
    expect(levelMinutes("n5")).toEqual({ written: 60, listening: 30 });
  });

  it("times a lesson of no known level as N2", () => {
    expect(levelMinutes(undefined)).toEqual(levelMinutes("N2"));
    expect(levelMinutes("N9")).toEqual(levelMinutes("N2"));
  });

  it("suggests the block time for the whole written part, listening and the full exam", () => {
    expect(suggestedMinutes("N1", "all")).toBe(110);
    expect(suggestedMinutes("N4", "listening")).toBe(35);
    expect(suggestedMinutes("N3", "full")).toBe(140);
    expect(suggestedMinutes("N2", "full")).toBe(155);
  });

  it("splits the written time over the parts by their size, in steps of 5, and the parts add up to about the block", () => {
    const counts = { vocab: 30, grammar: 21, reading: 20 };
    const parts = (["vocab", "grammar", "reading"] as const).map((p) => suggestedMinutes("N2", p, counts));
    expect(parts.every((m) => m % 5 === 0 && m > 0)).toBe(true);
    expect(parts[2]).toBeGreaterThan(parts[0]!); // reading takes the longest
    expect(Math.abs(parts.reduce((a, b) => a + b, 0) - 105)).toBeLessThanOrEqual(10);
  });
});

describe("full exam session", () => {
  it("starts on the written part with the level's written time", () => {
    const s = startFullExam("l", "N2", 1_000_000);
    expect(s).toMatchObject({ scope: "full", phase: "written", writtenMinutes: 105, listeningMinutes: 50, minutes: 155 });
    expect(s.endsAt).toBe(1_000_000 + 105 * 60_000);
    expect(s.played).toEqual({});
    expect(getExam("l")?.phase).toBe("written");
  });

  it("hands the written part in and starts the listening clock, keeping the written answers", () => {
    startFullExam("l", "N1", 1_000_000);
    setExamAnswer("l", "w1", "2");
    const s = advanceToListening("l", 9_000_000)!;
    expect(s.phase).toBe("listening");
    expect(s.endsAt).toBe(9_000_000 + 60 * 60_000);
    expect(s.answers).toEqual({ w1: "2" });
    expect(s.cursor).toBeUndefined();
  });

  it("advances only once and only a full exam", () => {
    startFullExam("l", "N2", 0);
    const first = advanceToListening("l", 100)!;
    const again = advanceToListening("l", 500_000)!;
    expect(again.endsAt).toBe(first.endsAt);
    startExam("v", "vocab", 20);
    expect(advanceToListening("v")?.phase).toBeUndefined();
  });

  it("stays running until it is graded, even while its listening clock runs", () => {
    startFullExam("l", "N2", 0);
    advanceToListening("l", 100);
    expect(listRunningExams().map((s) => s.lessonId)).toEqual(["l"]);
  });

  it("keeps the scaled score on the history line", () => {
    startFullExam("l", "N2", 1_000);
    const score = {
      method: "irt-3pl-eap",
      level: "N2",
      scales: [],
      total: 120,
      total_max: 180,
      pass_total: 90,
      passed: true,
    };
    finishExam("l", { scope: "full", total: 2, answered: 2, correct: 2, items: [], score }, 5_000);
    expect(getExamHistory()[0]).toMatchObject({ scope: "full", minutes: 155, score: { total: 120, passed: true } });
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

  it("keeps the detail of all sittings without the 30-entry limit when logged in", () => {
    localStorage.setItem("token", "test-token");
    for (let i = 0; i < 35; i++) {
      startExam(`l${i}`, "all", 40, 1_000 + i);
      finishExam(`l${i}`, result(1), 2_000 + i);
      clearExam(`l${i}`);
    }
    const history = getExamHistory();
    expect(history).toHaveLength(35);
    expect(history[0]!.result).toBeDefined();
    expect(history[30]!.result).toBeDefined();
    expect(history[34]!.result).toBeDefined();
    expect(reviewableSittings().size).toBe(35);
  });

  it("syncs exam history from server and merges with local storage", async () => {
    localStorage.setItem("token", "test-token");
    const serverSittings = [
      {
        lessonId: "serv1",
        scope: "all" as const,
        minutes: 40,
        startedAt: 1000,
        submittedAt: 5000,
        total: 10,
        answered: 10,
        correct: 8,
        result: result(8),
      },
      {
        lessonId: "serv2",
        scope: "vocab" as const,
        minutes: 20,
        startedAt: 2000,
        submittedAt: 6000,
        total: 10,
        answered: 10,
        correct: 9,
        result: result(9),
      },
    ];

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ history: serverSittings }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const synced = await syncExamHistoryFromServer();
    expect(synced).toHaveLength(2);
    expect(synced[0]!.lessonId).toBe("serv2"); // sorted newest to oldest (submittedAt: 6000 > 5000)
    expect(synced[1]!.lessonId).toBe("serv1");
    expect(getExamHistory()).toHaveLength(2);

    vi.unstubAllGlobals();
  });

  it("preserves local result detail when server sitting entry lacks result", async () => {
    localStorage.setItem("token", "test-token");
    startExam("s-preserve", "vocab", 20, 1000);
    finishExam("s-preserve", result(10), 2000);
    expect(getExamHistory()[0]?.result).toBeDefined();

    // Server returns the same sitting, but without result detail
    const serverSittings = [
      {
        lessonId: "s-preserve",
        scope: "vocab" as const,
        minutes: 20,
        startedAt: 1000,
        submittedAt: 2000,
        total: 10,
        answered: 10,
        correct: 10,
      },
    ];

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ history: serverSittings }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const synced = await syncExamHistoryFromServer();
    expect(synced[0]?.result).toBeDefined();
    expect(getExamHistory()[0]?.result).toBeDefined();

    vi.unstubAllGlobals();
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
