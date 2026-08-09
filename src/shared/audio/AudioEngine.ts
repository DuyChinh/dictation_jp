import type { MediaAdapter } from "./MediaAdapter";
import { createHtmlAudioAdapter } from "./MediaAdapter";

export type TransportState =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "ended"
  | "error";

export type SegmentMode = "none" | "playing_segment" | "looping_segment";

export type SegmentRange = { startMs: number; endMs: number };

export type AudioEngineEvent =
  | { type: "statechange"; state: TransportState }
  | { type: "timeupdate"; currentTimeMs: number }
  | { type: "segmentend"; range: SegmentRange }
  | { type: "error"; message: string }
  | { type: "ratechange"; rate: number }
  | { type: "volumechange"; volume: number };

export type AudioEngineOptions = {
  media?: MediaAdapter;
  /** Stop slightly before end to avoid overshoot (ms) */
  endEpsilonMs?: number;
  /** timeupdate throttle */
  timeupdateThrottleMs?: number;
};

type Listener = (e: AudioEngineEvent) => void;

/**
 * Single-responsibility segment audio engine (Spike A / production core).
 */
export class AudioEngine {
  private media: MediaAdapter;
  private state: TransportState = "idle";
  private segmentMode: SegmentMode = "none";
  private activeRange: SegmentRange | null = null;
  private listeners = new Set<Listener>();
  private endEpsilonMs: number;
  private timeupdateThrottleMs: number;
  private lastTimeupdateEmit = 0;
  private playGeneration = 0;
  private disposed = false;
  private onTimeUpdate: () => void;
  private onEnded: () => void;
  private onError: () => void;
  private onSeeked: (() => void) | null = null;

  constructor(opts: AudioEngineOptions = {}) {
    this.media = opts.media ?? createHtmlAudioAdapter();
    this.endEpsilonMs = opts.endEpsilonMs ?? 20;
    this.timeupdateThrottleMs = opts.timeupdateThrottleMs ?? 100;

    this.onTimeUpdate = () => this.handleTimeUpdate();
    this.onEnded = () => this.handleMediaEnded();
    this.onError = () => this.fail("Media error");

    this.media.addEventListener("timeupdate", this.onTimeUpdate);
    this.media.addEventListener("ended", this.onEnded);
    this.media.addEventListener("error", this.onError);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(e: AudioEngineEvent): void {
    for (const l of this.listeners) l(e);
  }

  private setState(state: TransportState): void {
    if (this.state === state) return;
    this.state = state;
    this.emit({ type: "statechange", state });
  }

  getState(): TransportState {
    return this.state;
  }

  getSegmentMode(): SegmentMode {
    return this.segmentMode;
  }

  getPlaybackRate(): number {
    return this.media.playbackRate;
  }

  setPlaybackRate(rate: number): void {
    this.media.playbackRate = rate;
    this.emit({ type: "ratechange", rate });
  }

  getVolume(): number {
    return this.media.volume;
  }

  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.media.volume = clamped;
    this.emit({ type: "volumechange", volume: clamped });
  }

  getCurrentTimeMs(): number {
    return this.media.currentTime * 1000;
  }

  getDurationMs(): number | null {
    const d = this.media.duration;
    if (!d || !Number.isFinite(d)) return null;
    return d * 1000;
  }

  async load(src: string): Promise<void> {
    this.ensureNotDisposed();
    this.cancelSegmentMonitor();
    this.setState("loading");
    this.media.src = src;
    this.media.load();

    await new Promise<void>((resolve, reject) => {
      const onMeta = () => {
        cleanup();
        this.setState("ready");
        resolve();
      };
      const onErr = () => {
        cleanup();
        this.fail("Failed to load audio");
        reject(new Error("Failed to load audio"));
      };
      const cleanup = () => {
        this.media.removeEventListener("loadedmetadata", onMeta);
        this.media.removeEventListener("error", onErr);
      };
      this.media.addEventListener("loadedmetadata", onMeta);
      this.media.addEventListener("error", onErr);
      // Already ready
      if (this.media.readyState >= 1 && this.media.duration > 0) {
        cleanup();
        this.setState("ready");
        resolve();
      }
    });
  }

  async play(): Promise<void> {
    this.ensureNotDisposed();
    const gen = ++this.playGeneration;
    await this.media.play();
    if (gen !== this.playGeneration) return;
    this.setState("playing");
  }

  pause(): void {
    this.ensureNotDisposed();
    this.media.pause();
    if (this.state === "playing") this.setState("paused");
  }

  stop(): void {
    this.ensureNotDisposed();
    this.media.pause();
    if (this.activeRange) {
      this.media.currentTime = this.activeRange.startMs / 1000;
    }
    this.segmentMode = "none";
    this.setState("paused");
  }

  async playSegment(
    range: SegmentRange,
    opts?: { rate?: number },
  ): Promise<void> {
    this.ensureNotDisposed();
    const gen = ++this.playGeneration;

    // Cancel previous
    this.media.pause();
    this.segmentMode = "none";

    if (opts?.rate != null) this.setPlaybackRate(opts.rate);

    // Ensure metadata for duration clamp
    if (this.media.readyState < 1) {
      await this.waitForMetadata();
      if (gen !== this.playGeneration) return;
    }

    const durationMs = this.getDurationMs() ?? Number.POSITIVE_INFINITY;
    const startMs = Math.max(0, range.startMs);
    let endMs = Math.max(startMs + 1, range.endMs);
    if (Number.isFinite(durationMs)) {
      endMs = Math.min(endMs, durationMs);
    }

    this.activeRange = { startMs, endMs };
    this.segmentMode = "playing_segment";

    await this.seekMs(startMs);
    if (gen !== this.playGeneration) return;

    await this.media.play();
    if (gen !== this.playGeneration) return;
    this.setState("playing");
  }

  async replaySegment(): Promise<void> {
    if (!this.activeRange) {
      throw new Error("No active segment to replay");
    }
    await this.playSegment(this.activeRange);
  }

  dispose(): void {
    this.disposed = true;
    this.playGeneration++;
    this.media.pause();
    this.media.removeEventListener("timeupdate", this.onTimeUpdate);
    this.media.removeEventListener("ended", this.onEnded);
    this.media.removeEventListener("error", this.onError);
    if (this.onSeeked) {
      this.media.removeEventListener("seeked", this.onSeeked);
      this.onSeeked = null;
    }
    this.listeners.clear();
    this.segmentMode = "none";
    this.setState("idle");
  }

  private ensureNotDisposed(): void {
    if (this.disposed) throw new Error("AudioEngine disposed");
  }

  private fail(message: string): void {
    this.setState("error");
    this.emit({ type: "error", message });
  }

  private cancelSegmentMonitor(): void {
    this.segmentMode = "none";
    // generation bump happens in playSegment callers
  }

  private async waitForMetadata(): Promise<void> {
    if (this.media.readyState >= 1 && this.media.duration > 0) return;
    await new Promise<void>((resolve, reject) => {
      const onMeta = () => {
        cleanup();
        resolve();
      };
      const onErr = () => {
        cleanup();
        reject(new Error("metadata error"));
      };
      const cleanup = () => {
        this.media.removeEventListener("loadedmetadata", onMeta);
        this.media.removeEventListener("error", onErr);
      };
      this.media.addEventListener("loadedmetadata", onMeta);
      this.media.addEventListener("error", onErr);
    });
  }

  private seekMs(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const target = ms / 1000;
      if (Math.abs(this.media.currentTime - target) < 0.001) {
        resolve();
        return;
      }
      const onSeeked = () => {
        if (this.onSeeked) {
          this.media.removeEventListener("seeked", this.onSeeked);
          this.onSeeked = null;
        }
        resolve();
      };
      this.onSeeked = onSeeked;
      this.media.addEventListener("seeked", onSeeked);
      this.media.currentTime = target;
      // FakeMedia may need explicit forceSeek in tests when setter alone doesn't emit
      // HTMLAudio typically fires seeked. For FakeMediaAdapter, intercept:
      // We patch: if FakeMediaAdapter, emit via property — FakeMediaAdapter.currentTime setter doesn't emit.
      // Call forceSeek if available
      const fake = this.media as MediaAdapter & {
        forceSeek?: (s: number) => void;
      };
      if (typeof fake.forceSeek === "function") {
        fake.forceSeek(target);
      }
    });
  }

  private handleTimeUpdate(): void {
    const now = Date.now();
    if (now - this.lastTimeupdateEmit >= this.timeupdateThrottleMs) {
      this.lastTimeupdateEmit = now;
      this.emit({
        type: "timeupdate",
        currentTimeMs: this.getCurrentTimeMs(),
      });
    }

    if (this.segmentMode !== "playing_segment" || !this.activeRange) return;

    const endThreshold = this.activeRange.endMs - this.endEpsilonMs;
    if (this.getCurrentTimeMs() >= endThreshold) {
      this.media.pause();
      this.segmentMode = "none";
      const range = this.activeRange;
      this.setState("paused");
      this.emit({ type: "segmentend", range });
    }
  }

  private handleMediaEnded(): void {
    this.segmentMode = "none";
    this.setState("ended");
    if (this.activeRange) {
      this.emit({ type: "segmentend", range: this.activeRange });
    }
  }
}
