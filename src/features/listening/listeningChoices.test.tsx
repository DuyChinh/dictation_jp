import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TextChoiceList } from "./TextChoiceList";
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

describe("TextChoiceList", () => {
  it("renders choices and selects on click", () => {
    const onSelect = vi.fn();
    render(
      <TextChoiceList
        choices={textChoices}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByText(/選択肢1/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /選択肢2/ }));
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
