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
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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
  it("shows the answer chosen on another device when opening a question directly", async () => {
    localStorage.setItem("token", "account");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ changes: [{
      lessonId: "l", kind: "answer", itemId: "l-v-q1", at: 1000,
      value: { choiceId: "2", correct: false, at: 1000, part: "vocab", mondai: 1 },
    }] })));
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/lessons/l/paper/vocab?mondai=1&q=1");
    await waitFor(() => expect(screen.getByText("Vì sao 1")).toBeTruthy());
    expect((screen.getByRole("radio", { name: /c2/ }) as HTMLInputElement).getAttribute("aria-checked")).toBe("true");
    // Reviewing a saved answer must not rewrite its timestamp or upload it as new work.
    expect(fetchMock.mock.calls.every((call: unknown[]) => call.length < 2 || (call[1] as RequestInit)?.method !== "POST")).toBe(true);
  });

  it("refreshes the displayed pick and a reset when returning from another device", async () => {
    localStorage.setItem("token", "account");
    let value: unknown = { choiceId: "2", correct: false, at: 1000, part: "vocab", mondai: 1 };
    let at = 1000;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ changes: [{
      lessonId: "l", kind: "answer", itemId: "l-v-q1", at, value,
    }] }))));
    renderAt("/lessons/l/paper/vocab?mondai=1&q=1");
    await waitFor(() => expect(screen.getByRole("radio", { name: /c2/ }).getAttribute("aria-checked")).toBe("true"));
    value = { choiceId: "3", correct: false, at: 2000, part: "vocab", mondai: 1 };
    at = 2000;
    fireEvent(window, new Event("focus"));
    await waitFor(() => expect(screen.getByRole("radio", { name: /c3/ }).getAttribute("aria-checked")).toBe("true"));
    value = null;
    at = 3000;
    fireEvent(window, new Event("focus"));
    await waitFor(() => expect(screen.getByRole("radio", { name: /c3/ }).getAttribute("aria-checked")).toBe("false"));
    expect(screen.queryByText("Vì sao 1")).toBeNull();
  });

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
