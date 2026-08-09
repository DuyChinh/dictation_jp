import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
    load: vi.fn(async () => undefined),
    playSegment: vi.fn(async () => undefined),
    cycleRate: vi.fn(),
    rate: 1,
  }),
}));

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

describe("ListeningWorkspace", () => {
  it("reveals explanation after submit", async () => {
    render(
      <UiLanguageProvider>
        <LanguageProvider>
          <ListeningWorkspace lessonId="fixture" practice={practice} />
        </LanguageProvider>
      </UiLanguageProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /答えA/ }));
    fireEvent.click(screen.getByRole("button", { name: "Trả lời" }));
    await waitFor(() => {
      expect(screen.getAllByText(/Đúng/).length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Giải thích VI")).toBeTruthy();
  });
});
