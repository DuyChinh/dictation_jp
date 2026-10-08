import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import type { PaperItem, PaperPractice } from "../../shared/api/paper";
import { getExam, startExam, type ExamSession } from "../../shared/storage/paperExamStore";
import { getPaperProgress } from "../../shared/storage/paperProgressStore";
import { ExamRunner } from "./ExamRunner";
import { ExamSetup } from "./ExamSetup";
import { PaperItemCard } from "./PaperItemCard";

const submit = vi.fn();
const evaluate = vi.fn();
vi.mock("../../shared/api/paper", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../shared/api/paper")>();
  return {
    ...real,
    submitPaperExam: (...args: unknown[]) => submit(...args),
    evaluatePaperItem: (...args: unknown[]) => evaluate(...args),
  };
});

beforeEach(() => {
  localStorage.clear();
  window.scrollTo = vi.fn();
  submit.mockReset();
  evaluate.mockReset();
  evaluate.mockImplementation(async (body: { choice_id: string }) => ({
    result: {
      correct: body.choice_id === "1",
      selected_choice_id: body.choice_id,
      correct_choice_id: "1",
      stem_vi: "",
      summary_vi: "Tóm tắt",
      point_tags: [],
      vocab: [],
      choices: ["1", "2", "3", "4"].map((id) => ({ id, text: `c${id}`, correct: id === "1", explanation_vi: `Vì sao ${id}` })),
      evidence_sentence_ids: [],
    },
  }));
  submit.mockImplementation(async (body: { answers: Array<{ item_id: string; choice_id: string }> }) => ({
    result: {
      scope: "all",
      total: 2,
      answered: body.answers.length,
      correct: body.answers.filter((a) => a.choice_id === "1").length,
      items: [1, 2].map((no) => {
        const picked = body.answers.find((a) => a.item_id === `l-v-q${no}`)?.choice_id ?? null;
        return { item_id: `l-v-q${no}`, no, part: "vocab", mondai: 1, selected: picked, correct_choice_id: "1", correct: picked === "1" };
      }),
    },
  }));
});
afterEach(() => cleanup());

const item = (no: number): PaperItem => ({
  id: `l-v-q${no}`,
  no,
  part: "vocab",
  mondai: 1,
  type: "mcq",
  stem: { ja: `問題文${no}` },
  choices: ["1", "2", "3", "4"].map((id) => ({ id, text: `c${id}` })),
});

const paper: PaperPractice = {
  lesson_id: "l",
  status: "verified",
  content_version: 1,
  counts: { vocab: 2, grammar: 0, reading: 0 },
  items: [item(1), item(2)],
  passages: [],
};

describe("ExamSetup", () => {
  function renderCard() {
    return render(
      <MemoryRouter initialEntries={["/start"]}>
        <UiLanguageProvider>
          <Routes>
            <Route path="/start" element={<ExamSetup lessonId="l" paper={paper} lessonLabel="JLPT N2 – 12/2025" />} />
            <Route path="/lessons/l/paper/exam" element={<div>exam room</div>} />
          </Routes>
        </UiLanguageProvider>
      </MemoryRouter>,
    );
  }

  it("offers the 20, 25, 35, 40 and 60 minute presets", () => {
    renderCard();
    for (const m of ["20", "25", "35", "40", "60"]) {
      expect(screen.getByRole("radio", { name: new RegExp(`^${m}`) })).toBeTruthy();
    }
  });

  it("starts a sitting with a chosen preset", () => {
    renderCard();
    fireEvent.click(screen.getByRole("radio", { name: /^25/ }));
    fireEvent.click(screen.getByRole("button", { name: /Bắt đầu thi/ }));
    expect(screen.getByText("exam room")).toBeTruthy();
    expect(getExam("l")).toMatchObject({ minutes: 25, scope: "all" });
  });

  it("accepts a typed number of minutes and blocks an unusable one", () => {
    renderCard();
    const input = screen.getByPlaceholderText("Số phút");
    const start = screen.getByRole("button", { name: /Bắt đầu thi/ }) as HTMLButtonElement;

    fireEvent.change(input, { target: { value: "300" } });
    expect(start.disabled).toBe(true);
    expect(screen.getByText(/từ 1 đến 180/)).toBeTruthy();

    fireEvent.change(input, { target: { value: "45" } });
    expect(start.disabled).toBe(false);
    fireEvent.click(start);
    expect(getExam("l")).toMatchObject({ minutes: 45 });
  });

  it("limits the sitting to the chosen part", () => {
    renderCard();
    fireEvent.click(screen.getByRole("radio", { name: /Từ vựng/ }));
    fireEvent.click(screen.getByRole("button", { name: /Bắt đầu thi/ }));
    expect(getExam("l")?.scope).toBe("vocab");
  });
});

describe("ExamRunner", () => {
  function renderRunner(session: ExamSession) {
    const onChange = vi.fn();
    render(
      <MemoryRouter>
        <UiLanguageProvider>
          <ExamRunner lessonId="l" paper={paper} session={session} onChange={onChange} />
        </UiLanguageProvider>
      </MemoryRouter>,
    );
    return onChange;
  }

  it("shows no answer or explanation while the exam is running", () => {
    const session = startExam("l", "all", 40);
    renderRunner(session);
    fireEvent.click(screen.getByRole("radio", { name: /c1/ }));
    expect(screen.queryByText(/Chính xác/)).toBeNull();
    expect(screen.queryByText(/Đáp án$/)).toBeNull();
    expect(submit).not.toHaveBeenCalled();
    expect(getExam("l")?.answers).toEqual({ "l-v-q1": "1" });
  });

  it("submits the picked answers and records them as progress", async () => {
    startExam("l", "all", 40);
    const first = renderRunner(getExam("l")!);
    fireEvent.click(screen.getByRole("radio", { name: /c1/ }));
    expect(first).toHaveBeenCalled();
    cleanup();

    // Reload: the answer is still there.
    const onChange = renderRunner(getExam("l")!);
    fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));
    expect(screen.getByRole("alertdialog").textContent).toMatch(/Chưa trả lời\s*1\s*câu/);
    fireEvent.click(screen.getAllByRole("button", { name: "Nộp bài" }).at(-1)!);

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0]![0]).toMatchObject({ scope: "all", answers: [{ item_id: "l-v-q1", choice_id: "1" }] });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(getExam("l")?.result).toMatchObject({ correct: 1, total: 2 });
    expect(getPaperProgress("l").answers["l-v-q1"]).toMatchObject({ correct: true, part: "vocab" });
    expect(getPaperProgress("l").answers["l-v-q2"]).toBeUndefined();
  });

  it("submits by itself when the time is already up", async () => {
    const session = startExam("l", "all", 20, Date.now() - 21 * 60_000);
    renderRunner(session);
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  });

  it("does not hammer the server after a failed submit", async () => {
    submit.mockRejectedValue(new Error("offline"));
    const session = startExam("l", "all", 20, Date.now() - 21 * 60_000);
    renderRunner(session);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    await new Promise((r) => setTimeout(r, 1300));
    expect(submit).toHaveBeenCalledTimes(1);

    submit.mockResolvedValueOnce({ result: { scope: "all", total: 2, answered: 0, correct: 0, items: [] } });
    fireEvent.click(screen.getByRole("button", { name: /Thử nộp lại/ }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
  });
});


describe("PaperItemCard in review mode", () => {
  function renderReview(selected: string | null) {
    render(
      <MemoryRouter>
        <UiLanguageProvider>
          <PaperItemCard
            lessonId="l"
            item={item(1)}
            review={{ selected, correctId: "1" }}
            onAnswered={() => undefined}
            onRetry={() => undefined}
          />
        </UiLanguageProvider>
      </MemoryRouter>,
    );
  }

  it("shows the explanations of a wrong pick and marks both the pick and the answer", async () => {
    renderReview("3");
    await waitFor(() => expect(screen.getByText("Vì sao 3")).toBeTruthy());
    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ choice_id: "3" }));
    expect(screen.getByText(/Bạn chọn 3, đáp án là 1/)).toBeTruthy();
    expect(screen.getByText("Bạn chọn")).toBeTruthy();
    expect(screen.getByText("Đáp án")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Kiểm tra/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Làm lại câu này/ })).toBeNull();
  });

  it("shows the answer of a blank question without calling it the learner's pick", async () => {
    renderReview(null);
    await waitFor(() => expect(screen.getByText("Vì sao 1")).toBeTruthy());
    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ choice_id: "1" }));
    expect(screen.getAllByText(/Bỏ trống/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Bạn chọn")).toBeNull();
    expect(screen.queryByText(/Chính xác/)).toBeNull();
  });
});
