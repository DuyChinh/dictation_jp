import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import { MillionaireMode } from "./MillionaireMode";
import { playGameSound, prepareAnswerSounds, startResultMusic, stopAnswerSound, stopBed, stopResultMusic } from "./gameSound";
import type { Card } from "./types";

vi.mock("./gameSound", () => ({
  playGameSound: vi.fn(), prepareAnswerSounds: vi.fn(), stopAnswerSound: vi.fn(),
  startBed: vi.fn(), stopBed: vi.fn(), tightenBed: vi.fn(),
  startResultMusic: vi.fn(), stopResultMusic: vi.fn(),
}));
vi.mock("../../shared/utils/confetti", () => ({ triggerConfetti: vi.fn() }));

const meanings: Record<string, string> = { 犬: "chó", 猫: "mèo", 水: "nước", 火: "lửa" };
const cards: Card[] = Object.entries(meanings).map(([term, definition], i) => ({
  id: String(i), deckId: "audio-deck", term, definition, termLang: "ja", definitionLang: "vi",
  box: 0, due: 0, right: 0, wrong: 0, createdAt: 0, updatedAt: 0,
}));
const mount = () => render(
  <MemoryRouter><UiLanguageProvider><MillionaireMode deckId="audio-deck" cards={cards} direction="term" /></UiLanguageProvider></MemoryRouter>,
);
const advance = (ms: number) => act(async () => { vi.advanceTimersByTime(ms); });
async function answer(right: boolean) {
  const prompt = document.querySelector(".fc-mil__question .fc-side__text")!.textContent!;
  const option = [...document.querySelectorAll<HTMLButtonElement>(".fc-mil__ans")]
    .find((button) => (button.querySelector(".fc-side__text")!.textContent === meanings[prompt]) === right)!;
  fireEvent.click(option);
  await advance(1400);
  await advance(right ? 1800 : 2500);
  const milestone = screen.queryByRole("dialog", { name: "Mốc an toàn" });
  if (milestone) fireEvent.click(within(milestone).getByRole("button", { name: "Chơi tiếp" }));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("millionaire audio", () => {
  it("offers music off by default before playing and remembers enabling it", () => {
    const view = mount();
    expect(screen.getByRole("button", { name: "Bật nhạc nền" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Bật nhạc nền" }));
    view.unmount();
    mount();
    expect(screen.getByRole("button", { name: "Tắt nhạc nền" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("prepares audio on Start and uses the correct clip for all 15 answers, including milestones and the win", async () => {
    mount();
    expect(prepareAnswerSounds).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    expect(prepareAnswerSounds).toHaveBeenCalledOnce();
    for (let i = 0; i < 15; i++) await answer(true);
    expect(screen.getByText("Chúc mừng! Bạn là triệu phú!")).toBeTruthy();
    const effects = vi.mocked(playGameSound).mock.calls.map(([name]) => name);
    expect(effects.filter((name) => name === "correct")).toHaveLength(15);
    expect(effects).not.toContain("milestone");
    expect(effects).not.toContain("win");
    expect(startResultMusic).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Tắt âm thanh" })).toBeTruthy();
  });

  it("uses the wrong clip after a safe level without layering another result sound over it", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    for (let i = 0; i < 5; i++) await answer(true);
    vi.mocked(playGameSound).mockClear();
    await answer(false);
    expect(screen.getByText("Rất tiếc, bạn đã trả lời sai")).toBeTruthy();
    expect(vi.mocked(playGameSound).mock.calls.map(([name]) => name)).toEqual(["lock", "wrong"]);
    expect(startResultMusic).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Chơi lại" }));
    expect(stopResultMusic).toHaveBeenCalledTimes(2);
  });

  it("stops the recording on the next choice and stops both recording and music when leaving", async () => {
    const view = mount();
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    await answer(true);
    vi.mocked(stopAnswerSound).mockClear();
    fireEvent.click(document.querySelector<HTMLButtonElement>(".fc-mil__ans")!);
    expect(stopAnswerSound).toHaveBeenCalledOnce();
    vi.mocked(stopAnswerSound).mockClear();
    vi.mocked(stopBed).mockClear();
    vi.mocked(stopResultMusic).mockClear();
    view.unmount();
    expect(stopAnswerSound).toHaveBeenCalledOnce();
    expect(stopBed).toHaveBeenCalledOnce();
    expect(stopResultMusic).toHaveBeenCalledOnce();
  });

  it("plays the result track after time runs out or the player walks away", async () => {
    const view = mount();
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    await advance(31000);
    await advance(2500);
    expect(startResultMusic).toHaveBeenCalledOnce();
    view.unmount();
    vi.mocked(startResultMusic).mockClear();
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    await answer(true);
    fireEvent.click(screen.getByRole("button", { name: /Dừng cuộc chơi, nhận/ }));
    fireEvent.click(screen.getByRole("button", { name: "Dừng và nhận thưởng" }));
    expect(startResultMusic).toHaveBeenCalledOnce();
  });
});
