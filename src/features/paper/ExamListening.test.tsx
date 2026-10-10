import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { PracticePackage } from "../../shared/api/content";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import { getListeningAnswers } from "../../shared/storage/listeningScoreStore";
import { getExam, markExamPlayed, startExam, type ExamSession } from "../../shared/storage/paperExamStore";
import { ExamListeningRunner } from "./ExamListeningRunner";
import { ExamSetup } from "./ExamSetup";

const submit = vi.fn();
vi.mock("../../shared/api/paper", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../shared/api/paper")>();
  return { ...real, submitListeningExam: (...args: unknown[]) => submit(...args) };
});

const playSegment = vi.fn(async () => undefined);
const pause = vi.fn();
let audioState: "idle" | "playing" = "idle";
vi.mock("../../shared/audio/useAudioEngine", () => ({
  useAudioEngine: () => ({
    engine: null,
    get state() {
      return audioState;
    },
    load: vi.fn(async () => undefined),
    playSegment,
    resume: vi.fn(async () => undefined),
    seek: vi.fn(),
    pause,
  }),
}));

beforeEach(() => {
  localStorage.clear();
  window.scrollTo = vi.fn();
  submit.mockReset();
  playSegment.mockClear();
  pause.mockClear();
  audioState = "idle";
  submit.mockResolvedValue({
    result: {
      scope: "listening",
      total: 2,
      answered: 1,
      correct: 1,
      items: [
        { item_id: "q1", no: 1, part: "listening", mondai: 1, section_id: "sec1", selected: "1", correct_choice_id: "1", correct: true },
        { item_id: "q2", no: 2, part: "listening", mondai: 1, section_id: "sec1", selected: null, correct_choice_id: "2", correct: false },
      ],
    },
  });
});
afterEach(() => cleanup());

const question = (id: string, order: number, start: number) => ({
  id,
  order,
  type: "listening_multiple_choice",
  audio: { start_ms: start, end_ms: start + 1000 },
  prompt: { ja: "質問は？" },
  choice_display_mode: "text" as const,
  choices: [
    { id: "1", text: { ja: "答えA" } },
    { id: "2", text: { ja: "答えB" } },
  ],
  segments: [],
});

const practice: PracticePackage = {
  id: "l",
  title: { ja: "テスト" },
  source: {},
  audio_url: "/api/audio/l",
  speakers: [],
  sections: [{ id: "sec1", order: 7, title: { ja: "問題7" }, questions: [question("q1", 1, 0), question("q2", 2, 2000)] }],
};

function renderRunner(session: ExamSession) {
  const onChange = vi.fn();
  render(
    <MemoryRouter>
      <UiLanguageProvider>
        <ExamListeningRunner lessonId="l" practice={practice} session={session} onChange={onChange} />
      </UiLanguageProvider>
    </MemoryRouter>,
  );
  return onChange;
}

describe("ExamListeningRunner", () => {
  it("plays a question's audio when it opens and counts it as heard once playing", async () => {
    audioState = "playing";
    renderRunner(startExam("l", "listening", 40));
    expect(playSegment).toHaveBeenCalledWith({ startMs: 0, endMs: 1000 });
    await waitFor(() => expect(getExam("l")?.played).toEqual({ q1: true }));
  });

  it("stays silent on a question that was already heard, and offers no replay by default", () => {
    startExam("l", "listening", 40);
    markExamPlayed("l", "q1");
    renderRunner(getExam("l")!);
    expect(playSegment).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Nghe lại/ })).toBeNull();
    expect(screen.getByText(/chỉ nghe một lần/i)).toBeTruthy();
  });

  it("lets the learner replay when the sitting allows it", () => {
    startExam("l", "listening", 40, Date.now(), { allowReplay: true });
    markExamPlayed("l", "q1");
    renderRunner(getExam("l")!);
    fireEvent.click(screen.getByRole("button", { name: /Nghe lại/ }));
    expect(playSegment).toHaveBeenCalledWith({ startMs: 0, endMs: 1000 });
  });

  it("shows no answer while the test runs, and keeps the picks", () => {
    startExam("l", "listening", 40);
    markExamPlayed("l", "q1");
    renderRunner(getExam("l")!);
    fireEvent.click(screen.getByRole("radio", { name: /答えA/ }));
    expect(screen.queryByText(/Chính xác/)).toBeNull();
    expect(submit).not.toHaveBeenCalled();
    expect(getExam("l")?.answers).toEqual({ q1: "1" });
  });

  it("submits the picks and records them as listening progress", async () => {
    startExam("l", "listening", 40);
    markExamPlayed("l", "q1");
    renderRunner(getExam("l")!);
    fireEvent.click(screen.getByRole("radio", { name: /答えA/ }));
    cleanup();

    // Reload: the pick is still there.
    const onChange = renderRunner(getExam("l")!);
    fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));
    expect(screen.getByRole("alertdialog").textContent).toMatch(/Chưa trả lời\s*1\s*câu/);
    fireEvent.click(screen.getAllByRole("button", { name: "Nộp bài" }).at(-1)!);

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0]![0]).toEqual({ lesson_id: "l", answers: [{ question_id: "q1", choice_id: "1" }] });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(getExam("l")?.result).toMatchObject({ scope: "listening", correct: 1, total: 2 });
    expect(getListeningAnswers("l").q1).toMatchObject({ choiceId: "1", correct: true });
    expect(getListeningAnswers("l").q2).toBeUndefined();
    expect(pause).toHaveBeenCalled();
  });

  it("submits by itself when the time is already up", async () => {
    renderRunner(startExam("l", "listening", 20, Date.now() - 21 * 60_000));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  });
});

describe("ExamSetup for the listening test", () => {
  function renderSetup(initialScope?: "listening") {
    return render(
      <MemoryRouter initialEntries={["/start"]}>
        <UiLanguageProvider>
          <Routes>
            <Route
              path="/start"
              element={<ExamSetup lessonId="l" paper={null} listeningCount={35} lessonLabel="JLPT N2 – 7/2025" initialScope={initialScope} />}
            />
            <Route path="/lessons/l/paper/exam" element={<div>exam room</div>} />
          </Routes>
        </UiLanguageProvider>
      </MemoryRouter>,
    );
  }

  it("offers only the listening part when the lesson has no written part", () => {
    renderSetup();
    expect(screen.getByRole("radio", { name: /Nghe hiểu/ })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: /Từ vựng - Ngữ pháp/ })).toBeNull();
    expect(screen.getByRole("radio", { name: /Nghe hiểu/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("starts a listening sitting with replays off, or on when ticked", () => {
    renderSetup("listening");
    fireEvent.click(screen.getByRole("button", { name: /Bắt đầu thi/ }));
    expect(getExam("l")).toMatchObject({ scope: "listening", allowReplay: false });
    cleanup();

    renderSetup("listening");
    fireEvent.click(screen.getByRole("checkbox", { name: /Cho phép nghe lại/ }));
    fireEvent.click(screen.getByRole("button", { name: /Bắt đầu thi/ }));
    expect(getExam("l")).toMatchObject({ scope: "listening", allowReplay: true });
  });
});
