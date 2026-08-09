/**
 * Media abstraction so AudioEngine can unit-test without HTMLAudioElement.
 */

export type MediaEventName =
  | "loadedmetadata"
  | "seeked"
  | "timeupdate"
  | "ended"
  | "error"
  | "play"
  | "pause";

export interface MediaAdapter {
  src: string;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  paused: boolean;
  readyState: number;
  play(): Promise<void>;
  pause(): void;
  addEventListener(type: MediaEventName, listener: () => void): void;
  removeEventListener(type: MediaEventName, listener: () => void): void;
  load(): void;
}

type Listener = () => void;

/**
 * Deterministic fake media for unit tests (Spike A harness).
 * Duration and time in seconds.
 */
export class FakeMediaAdapter implements MediaAdapter {
  src = "";
  currentTime = 0;
  duration = 60;
  playbackRate = 1;
  volume = 1;
  paused = true;
  readyState = 0;
  private listeners = new Map<MediaEventName, Set<Listener>>();
  /** Simulate clock advancing on play */
  private playingTimer: ReturnType<typeof setInterval> | null = null;
  /** ms of wall clock per tick */
  tickMs = 20;
  /** how many media seconds advance per tick before rate */
  tickSeconds = 0.05;

  addEventListener(type: MediaEventName, listener: Listener): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: MediaEventName, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  private emit(type: MediaEventName): void {
    for (const l of this.listeners.get(type) ?? []) l();
  }

  load(): void {
    this.readyState = 0;
    this.currentTime = 0;
    // async metadata
    queueMicrotask(() => {
      this.readyState = 4;
      this.emit("loadedmetadata");
    });
  }

  async play(): Promise<void> {
    this.paused = false;
    this.emit("play");
    if (this.playingTimer) clearInterval(this.playingTimer);
    this.playingTimer = setInterval(() => {
      if (this.paused) return;
      this.currentTime += this.tickSeconds * this.playbackRate;
      if (this.currentTime >= this.duration) {
        this.currentTime = this.duration;
        this.pause();
        this.emit("ended");
        return;
      }
      this.emit("timeupdate");
    }, this.tickMs);
  }

  pause(): void {
    this.paused = true;
    if (this.playingTimer) {
      clearInterval(this.playingTimer);
      this.playingTimer = null;
    }
    this.emit("pause");
  }

  /** Test helper: force seek complete */
  forceSeek(seconds: number): void {
    this.currentTime = seconds;
    this.emit("seeked");
  }

  dispose(): void {
    this.pause();
    this.listeners.clear();
  }
}

export function createHtmlAudioAdapter(): MediaAdapter {
  const el = new Audio();
  el.preload = "metadata";

  return {
    get src() {
      return el.src;
    },
    set src(v: string) {
      el.src = v;
    },
    get currentTime() {
      return el.currentTime;
    },
    set currentTime(v: number) {
      el.currentTime = v;
    },
    get duration() {
      return Number.isFinite(el.duration) ? el.duration : 0;
    },
    get playbackRate() {
      return el.playbackRate;
    },
    set playbackRate(v: number) {
      el.playbackRate = v;
    },
    get volume() {
      return el.volume;
    },
    set volume(v: number) {
      el.volume = Math.max(0, Math.min(1, v));
    },
    get paused() {
      return el.paused;
    },
    get readyState() {
      return el.readyState;
    },
    play: () => el.play(),
    pause: () => el.pause(),
    addEventListener: (type, listener) => {
      el.addEventListener(type, listener);
    },
    removeEventListener: (type, listener) => {
      el.removeEventListener(type, listener);
    },
    load: () => el.load(),
  };
}
