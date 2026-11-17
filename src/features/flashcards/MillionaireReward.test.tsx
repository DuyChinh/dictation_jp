import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import { MillionaireReward } from "./MillionaireReward";

const refreshMyScore = vi.fn();
vi.mock("../../shared/storage/myScoreStore", () => ({ refreshMyScore: (...a: unknown[]) => refreshMyScore(...a) }));

const wrap = (n: number) => (
  <UiLanguageProvider>
    <MillionaireReward points={n} />
  </UiLanguageProvider>
);

beforeEach(() => {
  refreshMyScore.mockReset();
  localStorage.clear();
  vi.useFakeTimers();
  // no account in the header and no Web Animations: the reward lands where it is
  window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the points a game earned", () => {
  it("shows them with the ranking points label, and updates the header only after the show", () => {
    render(wrap(250));
    expect(screen.getByRole("status").textContent).toContain("+250");
    expect(screen.getByRole("status").textContent).toContain("điểm xếp hạng");
    expect(refreshMyScore).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1000));
    expect(refreshMyScore).toHaveBeenCalledTimes(1);
    expect(refreshMyScore).toHaveBeenCalledWith(true);
  });

  it("still brings the header up to date when the learner leaves before the end, once", () => {
    const { unmount } = render(wrap(40));
    unmount();
    expect(refreshMyScore).toHaveBeenCalledTimes(1);
  });
});
