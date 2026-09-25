import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChoiceCards } from "./ChoiceCards";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import { ImageChoiceGrid } from "./ImageChoiceGrid";

afterEach(() => cleanup());

const textChoices = [
  { id: "1", text: { ja: "選択肢1" } },
  { id: "2", text: { ja: "選択肢2" } },
];

const imageChoices = [
  {
    id: "1",
    text: { ja: "図1" },
    image: { url: "https://example.com/1.png", alt: { ja: "図1" } },
  },
  {
    id: "2",
    text: { ja: "図2" },
    image: { url: "https://example.com/bad.png", alt: { ja: "図2" } },
  },
];

describe("ChoiceCards", () => {
  it("renders choices and selects on click", () => {
    const onSelect = vi.fn();
    render(
      <UiLanguageProvider>
        <ChoiceCards
          choices={textChoices}
          mode="text"
          selectedId={null}
          onSelect={onSelect}
          translationLang="vi"
          label="Q"
        />
      </UiLanguageProvider>,
    );
    expect(screen.getByText(/選択肢1/)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /選択肢2/ }));
    expect(onSelect).toHaveBeenCalledWith("2");
  });

  it("marks the right answer and the wrong pick after reveal", () => {
    render(
      <UiLanguageProvider>
        <ChoiceCards
          choices={textChoices}
          mode="text"
          selectedId="1"
          onSelect={() => undefined}
          reveal={{
            correctId: "2",
            selectedId: "1",
            choices: [
              { id: "1", text: { ja: "選択肢1", vi: "Lựa chọn một" } },
              { id: "2", text: { ja: "選択肢2", vi: "Lựa chọn hai" } },
            ],
          }}
          translationLang="vi"
          label="Q"
        />
      </UiLanguageProvider>,
    );
    expect(screen.getByRole("radio", { name: /Đáp án.*選択肢2/ })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Bạn chọn.*選択肢1/ })).toBeTruthy();
    expect(screen.getByText("Lựa chọn hai")).toBeTruthy();
  });

  it("shows number buttons before reveal in numbers mode", () => {
    const onSelect = vi.fn();
    render(
      <UiLanguageProvider>
        <ChoiceCards
          choices={textChoices}
          mode="numbers"
          selectedId={null}
          onSelect={onSelect}
          translationLang="vi"
          label="Q"
        />
      </UiLanguageProvider>,
    );
    expect(screen.queryByText(/選択肢1/)).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "2" }));
    expect(onSelect).toHaveBeenCalledWith("2");
  });
});

describe("ImageChoiceGrid", () => {
  it("selects image choice", () => {
    const onSelect = vi.fn();
    render(
      <ImageChoiceGrid
        choices={imageChoices}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /1\. 図1/ }));
    expect(onSelect).toHaveBeenCalledWith("1");
  });

  it("falls back to text caption when image errors", () => {
    const onSelect = vi.fn();
    render(
      <ImageChoiceGrid
        choices={[imageChoices[1]!]}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    const img = screen.getByRole("img", { name: "図2" });
    fireEvent.error(img);
    // after error, caption text remains in button
    expect(screen.getAllByText(/図2/).length).toBeGreaterThan(0);
  });
});
