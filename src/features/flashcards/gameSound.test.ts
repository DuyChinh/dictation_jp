import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let game: typeof import("./gameSound");
let prefs: typeof import("./prefs");
let started = 0;
const sources: FakeNode[] = [];
const gains: FakeNode[] = [];
const fetchAudio = vi.fn();
const decodeAudio = vi.fn();
const param = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() });
class FakeNode {
  gain = param();
  frequency = param();
  Q = param();
  type = "";
  buffer: { clip?: number } | null = null;
  loop = false;
  onended: (() => void) | null = null;
  connect = vi.fn(() => this);
  disconnect = vi.fn();
  start = vi.fn(() => { started++; });
  stop = vi.fn();
}
class FakeContext {
  state = "running";
  currentTime = 0;
  sampleRate = 100;
  destination = {};
  resume = vi.fn().mockResolvedValue(undefined);
  createGain = () => { const node = new FakeNode(); gains.push(node); return node; };
  createOscillator = () => new FakeNode();
  createBiquadFilter = () => new FakeNode();
  createBufferSource = () => { const node = new FakeNode(); sources.push(node); return node; };
  createBuffer = () => ({ getChannelData: () => new Float32Array(100) });
  decodeAudioData = decodeAudio;
}
const flush = () => vi.advanceTimersByTimeAsync(0);
const recordings = () => sources.filter((s) => s.buffer?.clip);

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  localStorage.clear();
  started = 0;
  sources.length = 0;
  gains.length = 0;
  decodeAudio.mockReset().mockImplementation(async (data: ArrayBuffer) => ({ clip: new Uint8Array(data)[0] }));
  fetchAudio.mockReset().mockImplementation(async (url: string) => ({
    ok: true,
    arrayBuffer: async () => new Uint8Array([url.includes("Nhac-nen-") ? 3 : url.includes("-dung-") ? 1 : 2]).buffer,
  }));
  vi.stubGlobal("fetch", fetchAudio);
  vi.stubGlobal("AudioContext", FakeContext);
  game = await import("./gameSound");
  prefs = await import("./prefs");
});
afterEach(() => {
  game.stopBed();
  game.stopAnswerSound();
  game.stopResultMusic();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("game sounds", () => {
  it("plays every show and miner effect", async () => {
    for (const name of ["question", "lock", "correct", "wrong", "milestone", "win", "walk", "timeup", "tick", "fifty", "audience", "phone", "swap", "launch", "grab", "boom", "levelClear"] as const) {
      const before = started;
      game.playGameSound(name);
      await flush();
      expect(started, name).toBeGreaterThan(before);
    }
  });

  it("keeps effects, downloads and music silent when sound is switched off", () => {
    prefs.saveSound(false);
    prefs.saveMusic(true);
    game.prepareAnswerSounds();
    game.playGameSound("correct");
    game.playGameSound("milestone");
    game.startBed(3);
    expect(started).toBe(0);
    expect(fetchAudio).not.toHaveBeenCalled();
  });

  it("does nothing where the browser has no Web Audio", () => {
    vi.stubGlobal("AudioContext", undefined);
    prefs.saveMusic(true);
    expect(() => game.prepareAnswerSounds()).not.toThrow();
    expect(() => game.playGameSound("correct")).not.toThrow();
    expect(() => game.startBed(1)).not.toThrow();
    expect(started).toBe(0);
    expect(fetchAudio).not.toHaveBeenCalled();
  });
});

describe("recorded answer sounds", () => {
  it("preloads the supplied MP3s once and plays the recording for the corresponding verdict", async () => {
    game.prepareAnswerSounds();
    game.prepareAnswerSounds();
    await flush();
    expect(fetchAudio.mock.calls.map(([url]) => url)).toEqual([
      expect.stringContaining("Am-thanh-tra-loi-dung-ai-la-trieu-phu-www_tiengdong_com.mp3"),
      expect.stringContaining("Am-thanh-tra-loi-sai-ai-la-trieu-phu-www_tiengdong_com.mp3"),
      expect.stringContaining("Nhac-nen-game-show-ai-la-trieu-phu-www_tiengdong_com.mp3"),
    ]);
    expect(recordings()).toHaveLength(0);
    game.playGameSound("correct");
    await flush();
    expect(recordings().at(-1)?.buffer?.clip).toBe(1);
    game.playGameSound("wrong");
    await flush();
    expect(recordings().at(-1)?.buffer?.clip).toBe(2);
    game.playGameSound("correct");
    await flush();
    expect(fetchAudio).toHaveBeenCalledTimes(3);
    expect(recordings().at(-1)?.buffer?.clip).toBe(1);
  });

  it("stops the previous recording before another answer and releases finished sources", async () => {
    game.playGameSound("correct");
    await flush();
    const first = recordings()[0]!;
    game.playGameSound("wrong");
    expect(first.stop).toHaveBeenCalledOnce();
    expect(first.disconnect).toHaveBeenCalled();
    await flush();
    const second = recordings()[1]!;
    second.onended?.();
    game.stopAnswerSound();
    expect(second.stop).not.toHaveBeenCalled();
    expect(second.disconnect).toHaveBeenCalled();
  });

  it("honors music and effect switches independently, and muting stops a recording immediately", async () => {
    game.playGameSound("correct");
    await flush();
    const clip = recordings()[0]!;
    prefs.saveMusic(false);
    expect(clip.stop).not.toHaveBeenCalled();
    prefs.saveSound(false);
    expect(clip.stop).toHaveBeenCalledOnce();
    prefs.saveSound(true);
    await flush();
    expect(recordings()).toHaveLength(1);
  });

  it("does not play a late download after leaving the game", async () => {
    let resolve!: (response: unknown) => void;
    fetchAudio.mockReturnValue(new Promise((r) => { resolve = r; }));
    game.playGameSound("wrong");
    game.stopAnswerSound();
    resolve({ ok: true, arrayBuffer: async () => new Uint8Array([2]).buffer });
    await flush();
    expect(recordings()).toHaveLength(0);
    expect(started).toBe(0);
  });

  it.each(["network", "http", "decode"])("falls back to a generated effect on a %s failure and retries later", async (failure) => {
    if (failure === "network") fetchAudio.mockRejectedValueOnce(new Error("offline"));
    else if (failure === "http") fetchAudio.mockResolvedValueOnce({ ok: false });
    else decodeAudio.mockRejectedValueOnce(new Error("bad audio"));
    game.playGameSound("wrong");
    await flush();
    expect(started).toBeGreaterThan(0);
    expect(recordings()).toHaveLength(0);
    game.playGameSound("wrong");
    await flush();
    expect(recordings().at(-1)?.buffer?.clip).toBe(2);
    expect(fetchAudio).toHaveBeenCalledTimes(2);
  });
});

describe("result soundtrack", () => {
  it("automatically loops the supplied track with in-game background music off", async () => {
    expect(prefs.musicOn()).toBe(false);
    game.playGameSound("correct");
    await flush();
    const answer = recordings()[0]!;
    game.startResultMusic();
    await flush();
    expect(answer.stop).toHaveBeenCalledOnce();
    expect(recordings().at(-1)?.buffer?.clip).toBe(3);
    expect(recordings().at(-1)?.loop).toBe(true);
  });

  it("follows the sound switch and cancels the soundtrack on leaving or replaying", async () => {
    game.startResultMusic();
    await flush();
    const track = recordings()[0]!;
    prefs.saveSound(false);
    expect(track.stop).toHaveBeenCalledOnce();
    prefs.saveSound(true);
    await flush();
    const resumed = recordings().at(-1)!;
    expect(resumed).not.toBe(track);
    expect(resumed.buffer?.clip).toBe(3);
    game.stopResultMusic();
    expect(resumed.stop).toHaveBeenCalledOnce();
    prefs.saveSound(false);
    prefs.saveSound(true);
    await flush();
    expect(recordings()).toHaveLength(2);
  });

  it("does not play while muted or start a late download after the result is closed", async () => {
    prefs.saveSound(false);
    game.startResultMusic();
    expect(fetchAudio).not.toHaveBeenCalled();
    let resolve!: (response: unknown) => void;
    fetchAudio.mockReturnValue(new Promise((r) => { resolve = r; }));
    prefs.saveSound(true);
    game.stopResultMusic();
    resolve({ ok: true, arrayBuffer: async () => new Uint8Array([3]).buffer });
    await flush();
    expect(recordings()).toHaveLength(0);
  });
});

describe("upbeat background music", () => {
  it("is off by default and remembers an explicit choice", () => {
    expect(prefs.musicOn()).toBe(false);
    game.startBed(1);
    expect(started).toBe(0);
    prefs.saveMusic(true);
    expect(prefs.musicOn()).toBe(true);
    expect(localStorage.getItem("jd.flash_music.v1")).toBe("on");
    expect(started).toBeGreaterThan(0);
    prefs.saveMusic(false);
    expect(prefs.musicOn()).toBe(false);
    expect(localStorage.getItem("jd.flash_music.v1")).toBe("off");
  });

  it("stops all scheduled beats and fades the music bus when the question ends", () => {
    prefs.saveMusic(true);
    game.startBed(1);
    const musicGain = gains.find((g) => g.gain.exponentialRampToValueAtTime.mock.calls.some(([value]) => value === 0.3))!;
    expect(started).toBeGreaterThan(0);
    game.stopBed();
    expect(musicGain.gain.exponentialRampToValueAtTime).toHaveBeenLastCalledWith(0.0001, 0.08);
    const before = started;
    vi.advanceTimersByTime(5000);
    expect(started).toBe(before);
  });

  it("gently raises the tempo once the clock is nearly out", () => {
    prefs.saveMusic(true);
    game.startBed(4);
    const beforeSlow = started;
    vi.advanceTimersByTime(20000);
    const slowNotes = started - beforeSlow;
    game.tightenBed(true);
    const beforeFast = started;
    vi.advanceTimersByTime(20000);
    expect(started - beforeFast).toBeGreaterThan(slowNotes);
  });

  it("follows the sound switch, resuming only while music was explicitly enabled", () => {
    prefs.saveMusic(true);
    game.startBed(2);
    expect(started).toBeGreaterThan(0);
    prefs.saveSound(false);
    const before = started;
    vi.advanceTimersByTime(5000);
    expect(started).toBe(before);
    prefs.saveSound(true);
    expect(started).toBeGreaterThan(before);
    prefs.saveMusic(false);
    const stopped = started;
    prefs.saveSound(false);
    prefs.saveSound(true);
    vi.advanceTimersByTime(5000);
    expect(started).toBe(stopped);
  });
});
