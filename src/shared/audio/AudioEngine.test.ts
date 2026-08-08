import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioEngine } from "./AudioEngine";
import { FakeMediaAdapter } from "./MediaAdapter";

describe("Spike A — AudioEngine segment playback", () => {
  let fake: FakeMediaAdapter;
  let engine: AudioEngine;

  afterEach(() => {
    engine?.dispose();
    fake?.dispose();
  });

  function setup(durationSec = 3600) {
    fake = new FakeMediaAdapter();
    fake.duration = durationSec; // 1 hour long-file simulation
    fake.tickSeconds = 0.1;
    fake.tickMs = 10;
    engine = new AudioEngine({
      media: fake,
      endEpsilonMs: 30,
      timeupdateThrottleMs: 0,
    });
    return { fake, engine };
  }

  it("loads and becomes ready", async () => {
    setup();
    await engine.load("https://example.com/long.mp3");
    expect(engine.getState()).toBe("ready");
    expect(engine.getDurationMs()).toBe(3_600_000);
  });

  it("plays a mid-file segment and stops near end_ms (long file seek)", async () => {
    setup();
    await engine.load("fake://long");
    const ends: number[] = [];
    engine.subscribe((e) => {
      if (e.type === "segmentend") ends.push(e.range.endMs);
    });

    // mid file: 30:00 – 30:02
    const startMs = 30 * 60 * 1000;
    const endMs = startMs + 2000;
    await engine.playSegment({ startMs, endMs });
    expect(engine.getState()).toBe("playing");
    expect(Math.round(fake.currentTime * 1000)).toBe(startMs);

    await vi.waitFor(() => {
      expect(ends.length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    expect(engine.getState()).toBe("paused");
    expect(engine.getSegmentMode()).toBe("none");
    expect(fake.currentTime * 1000).toBeGreaterThanOrEqual(endMs - 50);
  });

  it("cancels previous segment on rapid next", async () => {
    setup();
    await engine.load("fake://long");
    const ends: Array<{ startMs: number; endMs: number }> = [];
    engine.subscribe((e) => {
      if (e.type === "segmentend") ends.push(e.range);
    });

    await engine.playSegment({ startMs: 1000, endMs: 5000 });
    await engine.playSegment({ startMs: 10_000, endMs: 10_300 });

    await vi.waitFor(() => {
      expect(ends.some((r) => r.startMs === 10_000)).toBe(true);
    }, { timeout: 2000 });

    // First long segment should not complete after cancel (or only second recorded as last)
    expect(ends[ends.length - 1]?.startMs).toBe(10_000);
  });

  it("replaySegment seeks to start", async () => {
    setup();
    await engine.load("fake://");
    await engine.playSegment({ startMs: 5000, endMs: 8000 });
    fake.currentTime = 6.5;
    await engine.replaySegment();
    expect(Math.round(fake.currentTime * 1000)).toBe(5000);
  });

  it("applies playback rate (0.75 / 1.25)", async () => {
    setup();
    await engine.load("fake://");
    await engine.playSegment({ startMs: 0, endMs: 2000 }, { rate: 0.75 });
    expect(engine.getPlaybackRate()).toBe(0.75);
    engine.setPlaybackRate(1.25);
    expect(fake.playbackRate).toBe(1.25);
  });

  it("handles start_ms = 0", async () => {
    setup(10);
    await engine.load("fake://");
    await engine.playSegment({ startMs: 0, endMs: 500 });
    expect(fake.currentTime).toBe(0);
  });

  it("dispose is safe and stops playback", async () => {
    setup();
    await engine.load("fake://");
    await engine.playSegment({ startMs: 0, endMs: 5000 });
    engine.dispose();
    expect(engine.getState()).toBe("idle");
    expect(fake.paused).toBe(true);
    await expect(engine.play()).rejects.toThrow(/disposed/);
  });

  it("pause and resume within segment", async () => {
    setup();
    await engine.load("fake://");
    await engine.playSegment({ startMs: 1000, endMs: 10_000 });
    engine.pause();
    expect(engine.getState()).toBe("paused");
    await engine.play();
    expect(engine.getState()).toBe("playing");
  });
});
