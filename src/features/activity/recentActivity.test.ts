import { beforeEach, describe, expect, it } from "vitest";
import { saveAnswer } from "../../shared/storage/paperProgressStore";
import { recordListeningAnswer } from "../../shared/storage/listeningScoreStore";
import { saveSegmentProgress } from "../../shared/storage/dictationProgressStore";
import { lastPositionByLesson, positionText, recentPositions } from "./recentActivity";

beforeEach(() => localStorage.clear());

describe("recentPositions", () => {
  it("names the latest question of each part and links to reopen it", () => {
    saveAnswer("l", "l-r-q52", { choiceId: "1", correct: true, at: 1_000, part: "reading", mondai: 10 });
    saveAnswer("l", "l-r-q54", { choiceId: "3", correct: true, at: 3_000, part: "reading", mondai: 10 });
    saveAnswer("l", "l-v-q2", { choiceId: "2", correct: false, at: 2_000, part: "vocab" });

    const [reading, vocab] = recentPositions();
    expect(reading).toMatchObject({ lessonId: "l", kind: "reading", no: 54, at: 3_000, href: "/lessons/l/paper/reading?mondai=10&q=54" });
    // An answer saved before 問題 was kept still opens the part.
    expect(vocab).toMatchObject({ kind: "vocab", no: 2, href: "/lessons/l/paper/vocab" });
  });

  it("covers listening and dictation, newest first across lessons", () => {
    recordListeningAnswer("a", "a-m2-q3", { choiceId: "1", correct: true, correctChoiceId: "1" });
    saveSegmentProgress("b", "b-m1-q4", "b-m1-q4__b-m1-q4-t1-s1", { status: "correct", score: 100 });
    const positions = recentPositions();
    expect(positions.map((p) => p.kind).sort()).toEqual(["dictation", "listening"]);
    const listening = positions.find((p) => p.kind === "listening")!;
    expect(listening).toMatchObject({ no: 3, mondai: 2, href: "/lessons/a/listening?section=a-m2&question=a-m2-q3" });
    expect(positions.find((p) => p.kind === "dictation")).toMatchObject({ no: 4, href: "/lessons/b/dictation?section=b-m1&question=b-m1-q4" });
  });

  it("picks one position per lesson, the newest part", () => {
    saveAnswer("l", "l-v-q2", { choiceId: "2", correct: false, at: 1_000, part: "vocab" });
    saveAnswer("l", "l-g-q35", { choiceId: "2", correct: false, at: 2_000, part: "grammar" });
    expect(lastPositionByLesson().get("l")).toMatchObject({ kind: "grammar", no: 35 });
  });
});

describe("positionText", () => {
  const t = (k: string) => ({ "paper.title.reading": "Đọc hiểu", "paper.question": "Câu" })[k] ?? k;
  it("says the part and the question", () => {
    expect(positionText({ kind: "reading", no: 54 }, t as never)).toBe("Đọc hiểu · Câu 54");
    expect(positionText({ kind: "reading", no: null }, t as never)).toBe("Đọc hiểu");
  });
});
