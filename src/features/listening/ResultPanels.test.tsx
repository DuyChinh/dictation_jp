import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import { DialoguePanel, ExplanationPanel } from "./ResultPanels";

afterEach(() => cleanup());

describe("ExplanationPanel", () => {
  it("shows localized explanation after reveal", () => {
    render(
      <ExplanationPanel
        text={{ vi: "Giải thích đúng", en: "Correct reason" }}
        lang="vi"
      />,
    );
    expect(screen.getByText("Giải thích đúng")).toBeTruthy();
  });
});

describe("DialoguePanel", () => {
  const speakers = [{ id: "m", label: { ja: "男" } }];

  it("toggles each line's translation on click", () => {
    render(
      <UiLanguageProvider>
        <DialoguePanel
          segments={[{ speaker_id: "m", text: { ja: "はい。", vi: "Vâng." } }]}
          speakers={speakers}
          dialogue={{ ja: "—" }}
          lang="vi"
        />
      </UiLanguageProvider>,
    );
    expect(screen.queryByText("Vâng.")).toBeNull();
    const trBtn = screen.getByLabelText("Xem tiếng Việt");
    fireEvent.click(trBtn);
    expect(screen.getByText("Vâng.")).toBeTruthy();
    expect(screen.queryByText("—")).toBeNull();
  });

  it("shows the translation and the VI/EN mark in the web's language, whatever the saved choice", () => {
    localStorage.setItem("jd_ui_language", "en");
    render(
      <UiLanguageProvider>
        <DialoguePanel
          segments={[{ speaker_id: "m", text: { ja: "はい。", vi: "Vâng.", en: "Yes." } }]}
          speakers={speakers}
          dialogue={{ ja: "—" }}
          lang="vi"
          defaultShowTranslations
        />
      </UiLanguageProvider>,
    );
    expect(screen.getByText("Yes.")).toBeTruthy();
    expect(screen.queryByText("Vâng.")).toBeNull();
    expect(screen.getAllByText("EN").length).toBeGreaterThan(0);
    expect(screen.queryByText("VI")).toBeNull();
    localStorage.removeItem("jd_ui_language");
  });

  it("shows each line's translation when defaultShowTranslations is true", () => {
    render(
      <UiLanguageProvider>
        <DialoguePanel
          segments={[{ speaker_id: "m", text: { ja: "はい。", vi: "Vâng." } }]}
          speakers={speakers}
          dialogue={{ ja: "—" }}
          lang="vi"
          defaultShowTranslations
        />
      </UiLanguageProvider>,
    );
    expect(screen.getByText("Vâng.")).toBeTruthy();
    expect(screen.queryByText("—")).toBeNull();
  });

  it("falls back to the whole-dialogue translation when lines have none", () => {
    render(
      <UiLanguageProvider>
        <DialoguePanel
        segments={[{ speaker_id: "m", text: { ja: "はい。" } }]}
        speakers={speakers}
        dialogue={{ vi: "Người đàn ông: Vâng." }}
        lang="vi"
        />
      </UiLanguageProvider>,
    );
    expect(screen.getByText("Người đàn ông: Vâng.")).toBeTruthy();
  });

  it("highlights the answer lines and tints each speaker", () => {
    const { container } = render(
      <UiLanguageProvider>
        <DialoguePanel
          segments={[
            { id: "a", speaker_id: "female_1", text: { ja: "はい。" } },
            { id: "b", speaker_id: "male_1", start_ms: 0, end_ms: 1000, text: { ja: "いいえ。" } },
          ]}
          speakers={[
            { id: "female_1", label: { ja: "女" } },
            { id: "male_1", label: { ja: "男" } },
          ]}
          lang="vi"
          evidenceIds={["b"]}
          onPlayLine={() => undefined}
        />
      </UiLanguageProvider>,
    );
    const lines = container.querySelectorAll(".dialogue__line");
    expect(lines[0]?.getAttribute("data-tone")).toBe("female");
    expect(lines[1]?.getAttribute("data-tone")).toBe("male");
    expect(lines[0]?.classList.contains("is-answer")).toBe(false);
    expect(lines[1]?.classList.contains("is-answer")).toBe(true);
    expect(container.querySelectorAll(".dialogue__play").length).toBe(1);
  });

  it("plays from a sentence when clicking anywhere on that sentence", () => {
    let playedFrom: number | null = null;
    const fakeAudio = {
      engine: {
        getCurrentTimeMs: () => 500,
        getState: () => "playing" as const,
      },
      state: "playing" as const,
      playFrom: (_range: { startMs: number; endMs: number }, fromMs: number) => {
        playedFrom = fromMs;
        return Promise.resolve();
      },
    } as any;

    const { container } = render(
      <UiLanguageProvider>
        <DialoguePanel
          segments={[
            { id: "s1", speaker_id: "female_1", start_ms: 0, end_ms: 2000, text: { ja: "文1" } },
            { id: "s2", speaker_id: "male_1", start_ms: 2500, end_ms: 5000, text: { ja: "文2" } },
          ]}
          speakers={[
            { id: "female_1", label: { ja: "女" } },
            { id: "male_1", label: { ja: "男" } },
          ]}
          lang="vi"
          audio={fakeAudio}
          audioRange={{ startMs: 0, endMs: 5000 }}
        />
      </UiLanguageProvider>,
    );

    const lines = container.querySelectorAll(".dialogue__line");
    expect(lines.length).toBe(2);

    // Line 1 is active (at time 500ms)
    expect(lines[0]?.classList.contains("is-active")).toBe(true);
    expect(lines[1]?.classList.contains("is-active")).toBe(false);

    // Click line 2
    (lines[1] as HTMLElement).click();
    expect(playedFrom).toBe(2500);
  });
});
