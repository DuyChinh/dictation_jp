import { describe, expect, it } from "vitest";
import type { PracticePackage } from "../../shared/api/content";
import { attemptPct, buildAttempt } from "./attempts";

const q = (id: string) => ({
  id,
  order: 1,
  type: "listening_multiple_choice",
  audio: { start_ms: 0, end_ms: 1000 },
  prompt: { ja: "?" },
  choices: [{ id: "1", text: { ja: "a" } }, { id: "2", text: { ja: "b" } }],
});

const practice = {
  id: "p",
  title: { ja: "t" },
  source: {},
  audio_url: "/a",
  speakers: [],
  sections: [
    { id: "s1", order: 1, title: { ja: "問題1" }, questions: [q("a"), q("b")] },
    { id: "s2", order: 2, title: { ja: "問題2" }, questions: [q("c")] },
  ],
} as unknown as PracticePackage;

const ans = (correct: boolean, at: number) => ({ choiceId: "1", correct, correctChoiceId: "1", answeredAt: at });

describe("buildAttempt", () => {
  it("scores the whole test, counting unanswered questions in the total", () => {
    const a = buildAttempt("p", practice, { a: ans(true, 20), c: ans(false, 10) }, { now: 99 });
    expect(a).toMatchObject({ mode: "full", total: 3, right: 1, wrong: 1, startedAt: 10, submittedAt: 99 });
    expect(a.sections).toEqual([
      { sectionId: "s1", total: 2, right: 1, wrong: 0 },
      { sectionId: "s2", total: 1, right: 0, wrong: 1 },
    ]);
    expect(Object.keys(a.answers)).toEqual(["a", "c"]);
    expect(attemptPct(a)).toBe(50);
  });

  it("covers only the retried questions", () => {
    const a = buildAttempt("p", practice, { b: ans(true, 5), c: ans(true, 6) }, { onlyQuestionIds: ["b"] });
    expect(a).toMatchObject({ mode: "retry", total: 1, right: 1, wrong: 0 });
    expect(Object.keys(a.answers)).toEqual(["b"]);
  });
});
