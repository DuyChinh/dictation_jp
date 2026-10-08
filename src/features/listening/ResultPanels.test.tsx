import { cleanup, render, screen } from "@testing-library/react";
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

  it("shows each line's translation when the dialogue translation is a placeholder", () => {
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
});
