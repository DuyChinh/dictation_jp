import { afterEach, describe, expect, it, vi } from "vitest";
import { triggerConfetti } from "./confetti";

describe("triggerConfetti", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.getElementById("confetti-canvas")?.remove();
  });

  it("draws overlapping bursts on one canvas with a single animation loop", () => {
    const ctx = {
      clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(),
      fillRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
      closePath: vi.fn(), globalAlpha: 1, fillStyle: "",
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    const raf = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);

    triggerConfetti({ particleCount: 10 });
    triggerConfetti({ particleCount: 10 });

    expect(document.querySelectorAll("#confetti-canvas")).toHaveLength(1);
    expect(raf).toHaveBeenCalledTimes(1);
  });
});
