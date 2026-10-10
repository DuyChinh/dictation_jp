import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import { PaperExamResultPage } from "../../pages/PaperExamResultPage";
import { finishExam, startExam, type ExamHistoryEntry } from "../../shared/storage/paperExamStore";
import { ExamHistoryTable } from "./ExamHistoryTable";

vi.mock("../../shared/content/hooks", () => ({
  useLesson: () => ({ lesson: null }),
  usePractice: () => ({ practice: null }),
}));

// The page chrome (sidebar, theme, sign-in) is not what is tested here.
vi.mock("../../shared/ui/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

const entry = (startedAt: number): ExamHistoryEntry => ({
  lessonId: "l",
  scope: "vocab",
  minutes: 25,
  startedAt,
  submittedAt: startedAt + 60_000,
  total: 30,
  answered: 30,
  correct: 8,
});

describe("ExamHistoryTable", () => {
  it("links a sitting to its result only while its detail is stored", () => {
    render(
      <MemoryRouter>
        <UiLanguageProvider>
          <ExamHistoryTable rows={[entry(2_000), entry(1_000)]} label={() => "JLPT N2 · 7/2025"} reviewable={new Set(["l:2000"])} />
        </UiLanguageProvider>
      </MemoryRouter>,
    );
    const links = screen.getAllByRole("link", { name: "Xem lại" });
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute("href")).toBe("/lessons/l/paper/exam/result?at=2000");
    expect(screen.getByTitle(/không còn lưu chi tiết/)).toBeTruthy();
  });
});

describe("PaperExamResultPage", () => {
  const item = (no: number, selected: string | null) => ({
    item_id: `q${no}`,
    no,
    part: "vocab" as const,
    mondai: 1,
    selected,
    correct_choice_id: "1",
    correct: selected === "1",
  });

  function open(at: number) {
    render(
      <MemoryRouter initialEntries={[`/lessons/l/paper/exam/result?at=${at}`]}>
        <UiLanguageProvider>
          <Routes>
            <Route path="/lessons/:lessonId/paper/exam/result" element={<PaperExamResultPage />} />
          </Routes>
        </UiLanguageProvider>
      </MemoryRouter>,
    );
  }

  it("shows an earlier sitting after a retake has replaced it, and links its questions to that sitting", () => {
    startExam("l", "vocab", 25, 1_000);
    finishExam("l", { scope: "vocab", total: 2, answered: 2, correct: 1, items: [item(1, "1"), item(2, "3")] }, 2_000);
    startExam("l", "vocab", 25, 3_000);
    finishExam("l", { scope: "vocab", total: 2, answered: 2, correct: 2, items: [item(1, "1"), item(2, "1")] }, 4_000);

    open(1_000);
    const miss = screen.getAllByRole("link", { name: /Câu 2/ })[0]!;
    expect(miss.getAttribute("href")).toBe("/lessons/l/paper/exam/review?at=1000&q=2");
  });

  it("says so when the sitting's detail is no longer stored", () => {
    open(999);
    expect(screen.getByText(/Không tìm thấy chi tiết lần thi này/)).toBeTruthy();
  });
});
