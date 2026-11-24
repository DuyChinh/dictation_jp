import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { PracticePackage } from "../../shared/api/content";
import type { ExamResult, PaperItem, PaperPractice } from "../../shared/api/paper";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import { getListeningAnswers } from "../../shared/storage/listeningScoreStore";
import {
  advanceToListening,
  getExam,
  markExamPlayed,
  setExamAnswer,
  startFullExam,
  type ExamSession,
} from "../../shared/storage/paperExamStore";
import { getPaperProgress } from "../../shared/storage/paperProgressStore";
import { ExamListeningRunner } from "./ExamListeningRunner";
import { ExamResultView } from "./ExamResultView";
import { ExamRunner } from "./ExamRunner";
import { ExamSetup } from "./ExamSetup";

const submitFull = vi.fn();
const submitWritten = vi.fn();
vi.mock("../../shared/api/paper", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../shared/api/paper")>();
  return {
    ...real,
    submitFullExam: (...args: unknown[]) => submitFull(...args),
    submitPaperExam: (...args: unknown[]) => submitWritten(...args),
  };
});

vi.mock("../../shared/audio/useAudioEngine", () => ({
  useAudioEngine: () => ({
    engine: null,
    state: "idle",
    load: vi.fn(async () => undefined),
    playSegment: vi.fn(async () => undefined),
    resume: vi.fn(async () => undefined),
    seek: vi.fn(),
    pause: vi.fn(),
  }),
}));

const LESSON = "jlpt-n3-2025-12";

const score = {
  method: "irt-3pl-eap",
  level: "N3",
  scales: [
    { id: "language" as const, score: 48, max: 60, min: 19, correct: 1, total: 1, partial: false },
    { id: "reading" as const, score: 18, max: 60, min: 19, correct: 0, total: 1, partial: false },
    { id: "listening" as const, score: 50, max: 60, min: 19, correct: 1, total: 1, partial: false },
  ],
  total: 116,
  total_max: 180,
  pass_total: 95,
  passed: false,
};

const fullResult: ExamResult = {
  scope: "full",
  total: 3,
  answered: 3,
  correct: 2,
  score,
  items: [
    { item_id: "w1", no: 1, part: "vocab", mondai: 1, selected: "1", correct_choice_id: "1", correct: true },
    { item_id: "w2", no: 2, part: "reading", mondai: 10, selected: "2", correct_choice_id: "1", correct: false },
    { item_id: "q1", no: 1, part: "listening", mondai: 1, section_id: "sec1", selected: "1", correct_choice_id: "1", correct: true },
  ],
};

beforeEach(() => {
  localStorage.clear();
  window.scrollTo = vi.fn();
  submitFull.mockReset();
  submitWritten.mockReset();
  submitFull.mockResolvedValue({ result: fullResult });
});
afterEach(() => cleanup());

const wItem = (id: string, no: number, part: PaperItem["part"], mondai: number): PaperItem => ({
  id,
  no,
  part,
  mondai,
  type: "mcq",
  stem: { ja: `問題文${no}` },
  choices: ["1", "2", "3", "4"].map((c) => ({ id: c, text: `c${c}` })),
});

const paper: PaperPractice = {
  lesson_id: LESSON,
  status: "verified",
  content_version: 1,
  counts: { vocab: 1, grammar: 0, reading: 1 },
  items: [wItem("w1", 1, "vocab", 1), wItem("w2", 2, "reading", 10)],
  passages: [],
};

const lq = {
  id: "q1",
  order: 1,
  type: "listening_multiple_choice",
  audio: { start_ms: 0, end_ms: 1000 },
  prompt: { ja: "質問は？" },
  choice_display_mode: "text" as const,
  choices: [
    { id: "1", text: { ja: "答えA" } },
    { id: "2", text: { ja: "答えB" } },
  ],
  segments: [],
};
const practice: PracticePackage = {
  id: LESSON,
  title: { ja: "テスト" },
  source: {},
  audio_url: "/api/audio/l",
  speakers: [],
  sections: [{ id: "sec1", order: 1, title: { ja: "問題1" }, questions: [lq] }],
};

const wrap = (node: React.ReactNode) => (
  <MemoryRouter>
    <UiLanguageProvider>{node}</UiLanguageProvider>
  </MemoryRouter>
);

describe("ExamSetup for the full exam", () => {
  function renderSetup(lessonId = LESSON) {
    return render(
      <MemoryRouter initialEntries={["/start"]}>
        <UiLanguageProvider>
          <Routes>
            <Route path="/start" element={<ExamSetup lessonId={lessonId} paper={paper} listeningCount={28} lessonLabel="JLPT N3" />} />
            <Route path={`/lessons/${lessonId}/paper/exam`} element={<div>exam room</div>} />
          </Routes>
        </UiLanguageProvider>
      </MemoryRouter>,
    );
  }

  it("is the first choice and the default when the lesson has both parts", () => {
    renderSetup();
    const full = screen.getByRole("radio", { name: /Đề đầy đủ/ });
    expect(full.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText(/30 câu/)).toBeTruthy(); // 2 written + 28 listening
  });

  it("is timed by the level and gives no way to change the time", () => {
    renderSetup();
    // N3: 100 minutes written + 40 listening, fixed.
    expect(screen.getByText("100 phút")).toBeTruthy();
    expect(screen.getByText("40 phút")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Số phút")).toBeNull();
    expect(screen.getByText(/cố định theo cấp độ N3/)).toBeTruthy();
  });

  it("starts the written part with the level's time", () => {
    renderSetup();
    fireEvent.click(screen.getByRole("button", { name: /Bắt đầu thi/ }));
    expect(screen.getByText("exam room")).toBeTruthy();
    expect(getExam(LESSON)).toMatchObject({ scope: "full", phase: "written", writtenMinutes: 100, listeningMinutes: 40, minutes: 140 });
  });

  it("gives the other parts their time back when one is picked", () => {
    renderSetup();
    fireEvent.click(screen.getByRole("radio", { name: /^Nghe hiểu/ }));
    // N3 listening is 40 minutes, one of the presets.
    expect(screen.getByRole("radio", { name: /^40/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByPlaceholderText("Số phút")).toBeTruthy();
  });

  it("is not offered when the lesson has no listening part", () => {
    render(
      <MemoryRouter>
        <UiLanguageProvider>
          <ExamSetup lessonId={LESSON} paper={paper} listeningCount={0} lessonLabel="JLPT N3" />
        </UiLanguageProvider>
      </MemoryRouter>,
    );
    expect(screen.queryByRole("radio", { name: /Đề đầy đủ/ })).toBeNull();
  });
});

describe("the full exam, part by part", () => {
  it("hands in the written part without grading it and moves on to the listening clock", () => {
    const session = startFullExam(LESSON, "N3", 0);
    const onChange = vi.fn();
    render(wrap(<ExamRunner lessonId={LESSON} paper={paper} session={{ ...session, endsAt: Date.now() + 60_000 }} onChange={onChange} />));
    expect(screen.getByText(/Phần 1\/2/)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /c1/ }));
    fireEvent.click(screen.getByRole("button", { name: "Sang phần nghe" }));
    expect(screen.getByRole("alertdialog").textContent).toMatch(/không thể quay lại/);
    fireEvent.click(screen.getAllByRole("button", { name: "Sang phần nghe" }).at(-1)!);

    expect(submitWritten).not.toHaveBeenCalled();
    expect(submitFull).not.toHaveBeenCalled();
    const after = getExam(LESSON)!;
    expect(after.phase).toBe("listening");
    expect(after.submittedAt).toBeUndefined();
    expect(after.answers).toEqual({ w1: "1" });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ phase: "listening" }));
  });

  it("moves on by itself when the written time is up", async () => {
    startFullExam(LESSON, "N3", Date.now() - 101 * 60_000);
    const onChange = vi.fn();
    render(wrap(<ExamRunner lessonId={LESSON} paper={paper} session={getExam(LESSON)!} onChange={onChange} />));
    await waitFor(() => expect(getExam(LESSON)?.phase).toBe("listening"));
    expect(submitWritten).not.toHaveBeenCalled();
  });

  it("grades written and listening answers together at the end, and records both as progress", async () => {
    startFullExam(LESSON, "N3", 0);
    setExamAnswer(LESSON, "w1", "1");
    setExamAnswer(LESSON, "w2", "2");
    advanceToListening(LESSON, Date.now());
    markExamPlayed(LESSON, "q1");
    render(wrap(<ExamListeningRunner lessonId={LESSON} practice={practice} session={getExam(LESSON)!} onChange={vi.fn()} />));
    expect(screen.getByText(/Phần 2\/2/)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /答えA/ }));
    cleanup();

    // Reload: the picks of both parts are still there.
    const onChange = vi.fn();
    render(wrap(<ExamListeningRunner lessonId={LESSON} practice={practice} session={getExam(LESSON)!} onChange={onChange} />));
    fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Nộp bài" }).at(-1)!);

    await waitFor(() => expect(submitFull).toHaveBeenCalledTimes(1));
    const body = submitFull.mock.calls[0]![0] as { lesson_id: string; answers: Array<{ item_id: string; choice_id: string }> };
    expect(body.lesson_id).toBe(LESSON);
    expect(body.answers).toEqual(
      expect.arrayContaining([
        { item_id: "w1", choice_id: "1" },
        { item_id: "w2", choice_id: "2" },
        { item_id: "q1", choice_id: "1" },
      ]),
    );
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(getExam(LESSON)?.result).toMatchObject({ scope: "full", score: { total: 116, passed: false } });
    expect(getPaperProgress(LESSON).answers.w1).toMatchObject({ correct: true, part: "vocab" });
    expect(getPaperProgress(LESSON).answers.w2).toMatchObject({ correct: false, part: "reading" });
    expect(getListeningAnswers(LESSON).q1).toMatchObject({ choiceId: "1", correct: true });
  });

  it("keeps the sitting in the history with its scaled score", async () => {
    startFullExam(LESSON, "N3", 0);
    advanceToListening(LESSON, Date.now());
    markExamPlayed(LESSON, "q1");
    render(wrap(<ExamListeningRunner lessonId={LESSON} practice={practice} session={getExam(LESSON)!} onChange={vi.fn()} />));
    fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Nộp bài" }).at(-1)!);
    await waitFor(() => expect(getExam(LESSON)?.submittedAt).toBeTruthy());
    const line = JSON.parse(localStorage.getItem("jd.paper_exam_history.v1") ?? "[]")[0];
    expect(line).toMatchObject({ scope: "full", minutes: 140, score: { total: 116 } });
  });
});

describe("ExamResultView with a scaled score", () => {
  function renderResult(result: ExamResult, extra: Partial<ExamSession> = {}) {
    const session = {
      lessonId: LESSON,
      scope: result.scope,
      minutes: 140,
      startedAt: 0,
      endsAt: 140 * 60_000,
      answers: {},
      flagged: {},
      submittedAt: 60_000,
      result,
      ...extra,
    } as ExamSession;
    return render(wrap(<ExamResultView lessonId={LESSON} session={session} source={{}} onRetake={() => undefined} />));
  }

  it("leads with the total out of 180 and whether it passes", () => {
    renderResult(fullResult);
    expect(screen.getAllByText("116").length).toBeGreaterThan(0);
    expect(screen.getAllByText("/180").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Chưa đạt/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Điểm đạt N3: từ 95\/180/)).toBeTruthy();
  });

  it("shows each section's score and flags the one under its minimum", () => {
    renderResult(fullResult);
    expect(screen.getByText("Kiến thức ngôn ngữ (文字・語彙・文法)")).toBeTruthy();
    expect(screen.getByText(/Dưới mức tối thiểu 19/)).toBeTruthy(); // reading 18 < 19
    expect(screen.getAllByText(/tối thiểu 19/).length).toBe(3);
  });

  it("groups the questions of the two parts separately", () => {
    renderResult(fullResult);
    expect(screen.getAllByText(/聴解 問題1/).length).toBeGreaterThan(0);
  });

  it("says a written-only sitting has no total, and marks a single part as an estimate", () => {
    const written: ExamResult = {
      scope: "vocab",
      total: 1,
      answered: 1,
      correct: 1,
      items: [fullResult.items[0]!],
      score: {
        ...score,
        total: null,
        passed: null,
        scales: [{ id: "language", score: 40, max: 60, min: 19, correct: 1, total: 1, partial: true }],
      },
    };
    renderResult(written, { minutes: 20 });
    expect(screen.getByText("Ước lượng")).toBeTruthy();
    expect(screen.getByText(/chưa có tổng điểm hay kết quả đạt/)).toBeTruthy();
    expect(screen.queryByText(/Điểm đạt/)).toBeNull();
  });

  it("falls back to the plain count for sittings made before scaled scoring", () => {
    const old: ExamResult = { ...fullResult, score: undefined };
    renderResult(old);
    expect(screen.queryByText(/Điểm quy đổi theo thang JLPT/)).toBeNull();
    expect(screen.getByText(/chưa phải điểm quy đổi/)).toBeTruthy();
  });
});
