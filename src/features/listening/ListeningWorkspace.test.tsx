import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { getListeningAnswers } from "../../shared/storage/listeningScoreStore";
import { LanguageProvider } from "../../shared/content/LanguageProvider";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import { ListeningWorkspace } from "./ListeningWorkspace";
import type { PracticePackage } from "../../shared/api/content";

vi.mock("../../shared/api/evaluate", () => ({
  evaluateListening: vi.fn(async () => ({
    result: {
      correct: true,
      selected_choice_id: "1",
      correct_choice_id: "1",
      choices: [
        {
          id: "1",
          correct: true,
          text: { ja: "答えA" },
          explanation: { vi: "Giải thích VI", en: "Explain EN" },
        },
        { id: "2", correct: false, text: { ja: "答えB" } },
      ],
      evidence_segments: [],
      segments: [
        {
          id: "s1",
          order: 1,
          speaker_id: "narrator",
          text: { ja: "本文", vi: "Nội dung", en: "Body" },
        },
      ],
    },
  })),
}));

vi.mock("../../shared/audio/useAudioEngine", () => ({
  useAudioEngine: () => ({
    engine: null,
    state: "idle",
    load: vi.fn(async () => undefined),
    playSegment: vi.fn(async () => undefined),
    pause: vi.fn(),
    setRate: vi.fn(),
    cycleRate: vi.fn(),
    rate: 1,
  }),
}));

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

const practice: PracticePackage = {
  id: "fixture",
  title: { ja: "テスト", vi: "Test" },
  source: {},
  audio_url: "/api/audio/fixture",
  speakers: [{ id: "narrator", label: { ja: "ナレ" } }],
  sections: [
    {
      id: "sec1",
      order: 1,
      title: { ja: "問題1", vi: "Mondai 1" },
      questions: [
        {
          id: "q1",
          order: 1,
          type: "listening_multiple_choice",
          audio: { start_ms: 0, end_ms: 1000 },
          prompt: { ja: "質問は？" },
          choice_display_mode: "text",
          choices: [
            { id: "1", text: { ja: "答えA" } },
            { id: "2", text: { ja: "答えB" } },
          ],
          segments: [
            {
              id: "s1",
              order: 1,
              speaker_id: "narrator",
              text: { ja: "本文" },
              timing_status: "verified",
            },
          ],
        },
      ],
    },
  ],
};

function renderWorkspace() {
  return render(
    <MemoryRouter>
      <UiLanguageProvider>
        <LanguageProvider>
          <ListeningWorkspace
            lessonId="fixture"
            practice={practice}
            basePath="/lessons/fixture/listening"
            lessonHref="/lessons/fixture"
          />
        </LanguageProvider>
      </UiLanguageProvider>
    </MemoryRouter>,
  );
}

describe("ListeningWorkspace", () => {
  it("scores the answer and reveals the explanation", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("radio", { name: /答えA/ }));
    fireEvent.click(screen.getByRole("button", { name: /Trả lời/ }));
    await waitFor(() => {
      expect(screen.getByText("Chính xác!")).toBeTruthy();
    });
    expect(screen.getByText("Giải thích VI")).toBeTruthy();
    expect(screen.getByText("+1 điểm")).toBeTruthy();
    expect(screen.getByText(/1 \/ 1 câu đúng/)).toBeTruthy();
    expect(getListeningAnswers("fixture").q1).toMatchObject({ choiceId: "1", correct: true });
  });

  it("keeps the first answer when the question is opened again", async () => {
    localStorage.setItem(
      "jd.listening.v1",
      JSON.stringify({ fixture: { q1: { choiceId: "1", correct: true, correctChoiceId: "1", answeredAt: 1 } } }),
    );
    renderWorkspace();
    await waitFor(() => {
      expect(screen.getByText("Chính xác!")).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /Trả lời/ })).toBeNull();
  });
});
