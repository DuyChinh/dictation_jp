import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playGameSound, startBed, stopBed, tightenBed } from "./gameSound";
import { saveMusic, saveSound } from "./prefs";

/** An audio context that only counts: how many oscillators and noise sources were started, and how many are running. */
let started = 0;
let stopped = 0;
const param = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() });
class FakeNode {
  gain = param();
  frequency = param();
  Q = param();
  type = "";
  buffer: unknown = null;
  loop = false;
  connect() {
    return this;
  }
  start() {
    started++;
  }
  stop() {
    stopped++;
  }
}
class FakeContext {
  state = "running";
  currentTime = 0;
  sampleRate = 100;
  destination = {};
  resume = vi.fn();
  createGain = () => new FakeNode();
  createOscillator = () => new FakeNode();
  createBiquadFilter = () => new FakeNode();
  createBufferSource = () => new FakeNode();
  createBuffer = () => ({ getChannelData: () => new Float32Array(100) });
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  started = 0;
  stopped = 0;
  vi.stubGlobal("AudioContext", FakeContext);
  Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeContext });
});
afterEach(() => {
  stopBed();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("game sounds", () => {
  it("play every sound of the shows without error", () => {
    for (const name of ["question", "lock", "correct", "wrong", "milestone", "win", "walk", "timeup", "tick", "fifty", "audience", "phone", "swap", "launch", "grab", "boom", "levelClear"] as const) {
      const before = started;
      expect(() => playGameSound(name)).not.toThrow();
      expect(started, name).toBeGreaterThan(before);
    }
  });

  it("are silent when sound is switched off", () => {
    saveSound(false);
    playGameSound("milestone");
    startBed(3);
    expect(started).toBe(0);
  });

  it("do nothing, and do not fail, where the browser has no audio", () => {
    Object.defineProperty(window, "AudioContext", { configurable: true, value: undefined });
    expect(() => playGameSound("correct")).not.toThrow();
    expect(() => startBed(1)).not.toThrow();
  });
});

describe("the tense background music", () => {
  it("starts with a question and stops with it", () => {
    startBed(1);
    expect(started).toBeGreaterThan(0);
    const running = started;
    stopBed();
    expect(stopped).toBeGreaterThan(0);
    expect(started).toBe(running);
  });

  it("beats on a timer, faster once the clock is nearly out", () => {
    startBed(4);
    const slow = started;
    vi.advanceTimersByTime(940 * 4);
    const slowBeats = started - slow;
    tightenBed(true);
    const before = started;
    vi.advanceTimersByTime(940 * 4);
    expect(started - before).toBeGreaterThan(slowBeats);
  });

  it("needs music on as well as sound, and follows the switches at once", () => {
    saveMusic(false);
    startBed(2);
    expect(started).toBe(0);
    // music comes back in the middle of the question: the pulse starts then
    saveMusic(true);
    expect(started).toBeGreaterThan(0);
    const stoppedBefore = stopped;
    saveSound(false);
    expect(stopped).toBeGreaterThan(stoppedBefore);
    const running = started;
    vi.advanceTimersByTime(5000);
    expect(started).toBe(running);
  });
});
