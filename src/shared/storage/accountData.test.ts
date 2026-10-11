import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adoptLocalData, clearAccountData } from "./accountData";
import { saveSegmentProgress } from "./dictationProgressStore";
import { getListeningAnswers, recordListeningAnswer } from "./listeningScoreStore";
import { PAPER_EXAM_KEY, PAPER_EXAM_HISTORY_KEY } from "./paperExamStore";

const fetchMock = vi.fn();

function importCalls() {
  return fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/progress/import"));
}

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function practiceAsGuest() {
  saveSegmentProgress("lesson-1", "q1", "seg-1", { status: "correct", score: 100, lastAnswer: "こんにちは" });
  recordListeningAnswer("lesson-1", "q1", { choiceId: "2", correct: false, correctChoiceId: "3" });
}

describe("adoptLocalData", () => {
  it("sends guest practice to the account on sign-in", async () => {
    practiceAsGuest();
    await adoptLocalData("user-a", "token-a", { fromGuest: true });

    const bodies = importCalls().map(([, init]) => JSON.parse(init.body));
    expect(bodies).toContainEqual({
      dictation: [expect.objectContaining({ lesson_id: "lesson-1", segment_id: "seg-1", status: "correct" })],
    });
    expect(bodies).toContainEqual({
      listening: [expect.objectContaining({ lesson_id: "lesson-1", question_id: "q1", choice_id: "2" })],
    });
    expect(getListeningAnswers("lesson-1").q1).toBeDefined();
  });

  it("imports exam history when guest signs in", async () => {
    localStorage.setItem(
      PAPER_EXAM_HISTORY_KEY,
      JSON.stringify([
        { lessonId: "jlpt-n2-2022-07", scope: "all", minutes: 105, startedAt: 1000, submittedAt: 2000, total: 10, answered: 10, correct: 9 },
      ]),
    );
    await adoptLocalData("user-a", "token-a", { fromGuest: true });

    const bodies = importCalls().map(([, init]) => JSON.parse(init.body));
    expect(bodies).toContainEqual({
      examHistory: [expect.objectContaining({ lessonId: "jlpt-n2-2022-07", startedAt: 1000 })],
    });
  });

  it("doesn't upload unowned data on a page load with a saved session", async () => {
    practiceAsGuest();
    await adoptLocalData("user-a", "token-a", { fromGuest: false });
    expect(importCalls()).toHaveLength(0);
  });

  it("drops another account's data instead of showing or uploading it", async () => {
    await adoptLocalData("user-a", "token-a", { fromGuest: true });
    practiceAsGuest();
    fetchMock.mockClear();

    await adoptLocalData("user-b", "token-b", { fromGuest: true });
    expect(importCalls()).toHaveLength(0);
    expect(getListeningAnswers("lesson-1")).toEqual({});
  });

  it("retries a failed import on the next page load", async () => {
    practiceAsGuest();
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    await adoptLocalData("user-a", "token-a", { fromGuest: true });

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    await adoptLocalData("user-a", "token-a", { fromGuest: false });
    expect(importCalls().length).toBeGreaterThan(0);

    fetchMock.mockClear();
    await adoptLocalData("user-a", "token-a", { fromGuest: false });
    expect(importCalls()).toHaveLength(0);
  });
});

describe("clearAccountData", () => {
  it("removes practice data but keeps device preferences", () => {
    practiceAsGuest();
    localStorage.setItem(PAPER_EXAM_KEY, JSON.stringify({ l1: { lessonId: "l1" } }));
    localStorage.setItem(PAPER_EXAM_HISTORY_KEY, JSON.stringify([{ lessonId: "l1" }]));
    localStorage.setItem("jd.theme", "dark");
    clearAccountData();
    expect(getListeningAnswers("lesson-1")).toEqual({});
    expect(localStorage.getItem("jd.dictation_progress.v1")).toBeNull();
    expect(localStorage.getItem(PAPER_EXAM_KEY)).toBeNull();
    expect(localStorage.getItem(PAPER_EXAM_HISTORY_KEY)).toBeNull();
    expect(localStorage.getItem("jd.theme")).toBe("dark");
  });
});
