import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { UiLanguageProvider } from "../shared/i18n/UiLanguageContext";
import { saveAnswer } from "../shared/storage/paperProgressStore";
import { setLastMondai } from "../shared/storage/lastMondaiStore";
import { LessonPage } from "./LessonPage";

const LESSON = "jlpt-n2-2025-12";

const lesson = {
  id: LESSON,
  title: { ja: "N2", vi: "N2" },
  source: { level: "N2" },
  status: "published",
  content_version: 1,
  audio_url: "",
  sections: [],
  counts: { questions: 0, sections: 0, dictation_segments: 0 },
  paper: { status: "published", content_version: 1, counts: { vocab: 4, grammar: 0, reading: 0 } },
};

const item = (no: number, mondai: number) => ({
  id: `${LESSON}-v-q${no}`,
  no,
  part: "vocab",
  mondai,
  type: "mcq",
  stem: { ja: "問" },
  choices: [],
});

vi.mock("../shared/ui/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../shared/content/hooks", () => ({
  useLesson: () => ({ lesson, error: null, loading: false }),
  usePractice: () => ({ practice: null, error: null, loading: false }),
}));
vi.mock("../features/paper/usePaperPractice", () => ({
  usePaperPractice: () => ({
    paper: { passages: [], items: [item(1, 1), item(2, 1), item(3, 2), item(4, 2)] },
    error: null,
    loading: false,
  }),
}));
vi.mock("../features/listening/useSyncedListeningAnswers", () => ({
  useSyncedListeningAnswers: () => ({ answers: {}, ready: true, reload: vi.fn() }),
}));
vi.mock("../shared/storage/dictationProgressStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../shared/storage/dictationProgressStore")>()),
  syncLessonProgressFromServer: vi.fn(async () => ({})),
}));

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/lessons/${LESSON}`]}>
      <UiLanguageProvider>
        <Routes>
          <Route path="/lessons/:lessonId" element={<LessonPage />} />
        </Routes>
      </UiLanguageProvider>
    </MemoryRouter>,
  );
}

describe("LessonPage 問題 chips", () => {
  it("lists the 問題 of a written part, each opening that 問題", () => {
    renderPage();
    const chips = screen.getAllByRole("link", { name: /^問[12]$/ });
    expect(chips.map((c) => c.getAttribute("href"))).toEqual([
      `/lessons/${LESSON}/paper/vocab?mondai=1`,
      `/lessons/${LESSON}/paper/vocab?mondai=2`,
    ]);
  });

  it("fills a chip by how much of its 問題 is done and marks the one opened last", () => {
    saveAnswer(LESSON, `${LESSON}-v-q1`, { choiceId: "1", correct: true, at: 1, part: "vocab", mondai: 1 });
    setLastMondai(LESSON, "vocab", "2");
    renderPage();
    const [one, two] = screen.getAllByRole("link", { name: /^問[12]$/ });
    expect(one!.style.getPropertyValue("--pct")).toBe("50%");
    expect(two!.style.getPropertyValue("--pct")).toBe("0%");
    expect(one!.getAttribute("aria-current")).toBeNull();
    expect(two!.getAttribute("aria-current")).toBe("true");
  });
});
