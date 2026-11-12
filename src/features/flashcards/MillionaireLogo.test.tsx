import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import { Icon } from "../../shared/ui/Icon";
import { MillionaireMode } from "./MillionaireMode";
import { MODES } from "./modes";
import { addCard, createDeck, readState } from "./store";

vi.mock("../../shared/utils/confetti", () => ({ triggerConfetti: () => undefined, triggerFireworks: () => undefined }));

const wrap = (ui: React.ReactNode) => (
  <MemoryRouter>
    <UiLanguageProvider>{ui}</UiLanguageProvider>
  </MemoryRouter>
);

function deck() {
  const d = createDeck("Bộ thử", "deck1");
  for (const [term, definition] of [["犬", "chó"], ["猫", "mèo"], ["水", "nước"], ["火", "lửa"], ["木", "cây"], ["山", "núi"]]) {
    addCard({ deckId: d.id, term, termLang: "ja", definition, definitionLang: "vi" });
  }
  return readState().cards;
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the show's emblem", () => {
  it("is a picture icon, not a stroke one, and stays out of the way of screen readers", () => {
    const { container } = render(<Icon name="millionaire" size={40} />);
    const img = container.querySelector("img.icon-logo")!;
    expect(img.getAttribute("src")).toBe("/millionaire/logo.webp");
    expect(img.getAttribute("width")).toBe("40");
    expect(img.getAttribute("alt")).toBe("");
    expect(img.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("stands for the game in the list of ways to study", () => {
    expect(MODES.find((m) => m.id === "millionaire")!.icon).toBe("millionaire");
  });

  it("is on the start screen and in the brand row of the game", () => {
    render(wrap(<MillionaireMode deckId="deck1" cards={deck()} direction="term" />));
    expect(document.querySelector(".fc-mil-start img.icon-logo")!.getAttribute("src")).toBe("/millionaire/logo.webp");
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    expect(document.querySelector(".fc-mil__brand-mark img.icon-logo")!.getAttribute("src")).toBe("/millionaire/logo.webp");
    expect(document.querySelector(".fc-mil__brand-mark svg")).toBeNull();
  });
});

describe("the verdict does not make the game taller", () => {
  const answers = () => [...document.querySelectorAll<HTMLButtonElement>(".fc-mil__ans")];
  const frames = (ms: number) => act(async () => void vi.advanceTimersByTime(ms));

  it("shows in the bottom row in place of the keyboard hint, while an answer is locked and when it is revealed", async () => {
    render(wrap(<MillionaireMode deckId="deck1" cards={deck()} direction="term" />));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    const foot = document.querySelector<HTMLElement>(".fc-mil__foot")!;
    expect(foot.querySelector(".fc-mil__keyboard")).toBeTruthy();
    expect(within(foot).queryByRole("status")).toBeNull();

    fireEvent.click(answers()[0]!);
    expect(within(foot).getByRole("status").textContent).toContain("Khóa đáp án");
    expect(foot.querySelector(".fc-mil__keyboard")).toBeNull();

    await frames(1400);
    expect(within(foot).getByRole("status").className).toContain("fc-mil__verdict");
    expect(foot.querySelector(".fc-mil__keyboard")).toBeNull();
    // and it is the only status on the screen, outside the main column too
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});
