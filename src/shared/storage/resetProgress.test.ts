import { beforeEach, describe, expect, it } from "vitest";
import { clearLessonProgress, getLessonProgress, saveSegmentProgress } from "./dictationProgressStore";
import { getPaperProgress, resetPaperPart, saveAnswer, saveSentence } from "./paperProgressStore";
import { clearResume, loadResume, saveResume } from "./resumeStore";

beforeEach(() => localStorage.clear());

describe("resetPaperPart", () => {
  it("forgets one part's answers and its translation marks, and leaves the other parts and lessons", () => {
    saveAnswer("l", "l-v-q1", { choiceId: "1", correct: true, at: 1, part: "vocab" });
    saveAnswer("l", "l-r-q52", { choiceId: "2", correct: false, at: 2, part: "reading" });
    saveAnswer("l", "l-g-q35", { choiceId: "3", correct: true, at: 3, part: "grammar" });
    saveSentence("l", "l-r-p1-s1", "good");
    saveSentence("l", "l-g-p9-s1", "weak");
    saveAnswer("other", "other-r-q52", { choiceId: "2", correct: false, at: 4, part: "reading" });

    const after = resetPaperPart("l", "reading");
    expect(Object.keys(after.answers).sort()).toEqual(["l-g-q35", "l-v-q1"]);
    expect(after.sentences).toEqual({ "l-g-p9-s1": "weak" });
    expect(Object.keys(getPaperProgress("other").answers)).toEqual(["other-r-q52"]);
  });

  it("keeps passage translation marks when a part without passages is reset", () => {
    saveAnswer("l", "l-v-q1", { choiceId: "1", correct: true, at: 1, part: "vocab" });
    saveSentence("l", "l-r-p1-s1", "good");
    expect(resetPaperPart("l", "vocab").sentences).toEqual({ "l-r-p1-s1": "good" });
  });
});

describe("clearLessonProgress / clearResume", () => {
  it("clears the dictation of one lesson and the saved place only when it is in that lesson", () => {
    saveSegmentProgress("a", "a-q1", "a-q1-s1", { status: "correct", score: 100 });
    saveSegmentProgress("b", "b-q1", "b-q1-s1", { status: "correct", score: 100 });
    saveResume({ lesson_id: "b", mode: "sentence_dictation" });

    clearLessonProgress("a");
    clearResume("a");
    expect(getLessonProgress("a")).toEqual({});
    expect(Object.keys(getLessonProgress("b"))).toEqual(["b-q1-s1"]);
    expect(loadResume()?.lesson_id).toBe("b");

    clearResume("b");
    expect(loadResume()).toBeNull();
  });
});
