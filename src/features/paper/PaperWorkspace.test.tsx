import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import type { PaperItem, PaperPractice } from "../../shared/api/paper";
import { PaperWorkspace } from "./PaperWorkspace";

vi.mock("../../shared/api/paper", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../shared/api/paper")>();
  return {
    ...real,
    evaluatePaperItem: vi.fn(async (body: { item_id: string; choice_id: string }) => ({
      result: {
        correct: body.choice_id === "1",
        selected_choice_id: body.choice_id,
        correct_choice_id: "1",
        stem_vi: "",
        summary_vi: "Tóm tắt",
        point_tags: [],
        vocab: [],
        choices: ["1", "2", "3", "4"].map((id) => ({
          id,
          text: `c${id}`,
          correct: id === "1",
          explanation_vi: `Vì sao ${id}`,
        })),
        evidence_sentence_ids: [],
      },
    })),
  };
});

beforeEach(() => {
  localStorage.clear();
  window.scrollTo = vi.fn();
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
  counts: { vocab: 3, grammar: 0, reading: 0 },
  items: [item(1), item(2), item(3)],
  passages: [],
};

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <UiLanguageProvider>
        <PaperWorkspace lessonId="l" paper={paper} part="vocab" />
      </UiLanguageProvider>
    </MemoryRouter>,
  );
}

describe("PaperWorkspace", () => {
  it("stays on the question just answered instead of jumping to the next unanswered one", async () => {
    // No ?q= in the URL: the page picks the first unanswered question itself.
    renderAt("/lessons/l/paper/vocab");
    expect(screen.getByText("問題文1")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: /c2/ }));
    fireEvent.click(screen.getByRole("button", { name: /Kiểm tra|Check/ }));

    await waitFor(() => expect(screen.getByText("Vì sao 1")).toBeTruthy());
    // Still question 1, with its explanations on screen.
    expect(screen.getByText("問題文1")).toBeTruthy();
    expect(screen.queryByText("問題文2")).toBeNull();
  });

  it("moves on only when asked", async () => {
    renderAt("/lessons/l/paper/vocab?mondai=1&q=1");
    fireEvent.click(screen.getByRole("radio", { name: /c1/ }));
    fireEvent.click(screen.getByRole("button", { name: /Kiểm tra|Check/ }));
    await waitFor(() => expect(screen.getByText("Vì sao 1")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /Câu tiếp theo|Next question/ }));
    await waitFor(() => expect(screen.getByText("問題文2")).toBeTruthy());
  });
});
