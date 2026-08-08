import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ExplanationPanel } from "./ResultPanels";

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
