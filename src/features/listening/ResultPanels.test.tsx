import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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
      <DialoguePanel
        segments={[{ speaker_id: "m", text: { ja: "はい。", vi: "Vâng." } }]}
        speakers={speakers}
        dialogue={{ ja: "—" }}
        lang="vi"
      />,
    );
    expect(screen.getByText("Vâng.")).toBeTruthy();
    expect(screen.queryByText("—")).toBeNull();
  });

  it("falls back to the whole-dialogue translation when lines have none", () => {
    render(
      <DialoguePanel
        segments={[{ speaker_id: "m", text: { ja: "はい。" } }]}
        speakers={speakers}
        dialogue={{ vi: "Người đàn ông: Vâng." }}
        lang="vi"
      />,
    );
    expect(screen.getByText("Người đàn ông: Vâng.")).toBeTruthy();
  });
});
