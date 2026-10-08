import { useEffect, useRef, useState } from "react";
import {
  AudioEngine,
  type AudioEngineEvent,
  type SegmentRange,
  type TransportState,
} from "./AudioEngine";
import { apiUrl } from "../env";

/**
 * Resolve audio_url from API (may be relative /api/audio/...) with env base.
 */
export function resolveAudioSrc(audioUrl: string): string {
  if (audioUrl.startsWith("http://") || audioUrl.startsWith("https://")) {
    return audioUrl;
  }
  return apiUrl(audioUrl);
}

export function useAudioEngine() {
  const engineRef = useRef<AudioEngine | null>(null);
  /** Bumped by every direct play/pause/seek, so a running playlist knows it was overtaken. */
  const sequenceRef = useRef(0);
  const [state, setState] = useState<TransportState>("idle");
  const [rate, setRateState] = useState(1);
  const [volume, setVolumeState] = useState(1);

  useEffect(() => {
    const engine = new AudioEngine();
    engineRef.current = engine;

    const unsub = engine.subscribe((e: AudioEngineEvent) => {
      if (e.type === "statechange") setState(e.state);
      if (e.type === "ratechange") setRateState(e.rate);
      if (e.type === "volumechange") setVolumeState(e.volume);
    });

    return () => {
      unsub();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const getEngine = () => engineRef.current;

  return {
    get engine() {
      return getEngine();
    },
    state,
    rate,
    volume,
    setVolume: (v: number) => {
      getEngine()?.setVolume(v);
      setVolumeState(v);
    },
    setRate: (r: number) => {
      getEngine()?.setPlaybackRate(r);
      setRateState(r);
    },
    load: (src: string) => getEngine()?.load(resolveAudioSrc(src)) ?? Promise.resolve(),
    playSegment: (range: SegmentRange, opts?: { rate?: number }) => {
      sequenceRef.current++;
      return getEngine()?.playSegment(range, opts) ?? Promise.resolve();
    },
    /** Plays the ranges one after another; any other play, pause or seek cancels the rest. */
    playSequence: async (ranges: SegmentRange[]) => {
      const eng = getEngine();
      if (!eng || ranges.length === 0) return;
      const token = ++sequenceRef.current;
      for (const [i, range] of ranges.entries()) {
        if (token !== sequenceRef.current) return;
        const finished = new Promise<boolean>((resolve) => {
          const unsub = eng.subscribe((e) => {
            if (e.type === "segmentend") {
              unsub();
              resolve(true);
            } else if (e.type === "statechange" && (e.state === "paused" || e.state === "error")) {
              // Paused by hand (the end of a segment emits segmentend right after paused).
              setTimeout(() => {
                unsub();
                resolve(false);
              }, 0);
            }
          });
        });
        await eng.playSegment(range);
        if (token !== sequenceRef.current) return;
        if (!(await finished) || i === ranges.length - 1) return;
        await new Promise((r) => setTimeout(r, 350));
      }
    },
    replay: () => getEngine()?.replaySegment() ?? Promise.resolve(),
    /** Continues `range` from where it was paused, or plays it from the start. */
    resume: (range: SegmentRange) => {
      sequenceRef.current++;
      return getEngine()?.resumeSegment(range) ?? Promise.resolve();
    },
    /** Jumps to an absolute position inside `range`. */
    seek: (range: SegmentRange, ms: number) => {
      sequenceRef.current++;
      getEngine()?.seekInSegment(range, ms);
    },
    /** Moves by `deltaMs` inside `range` from the current position. */
    seekBy: (range: SegmentRange, deltaMs: number) => {
      const eng = getEngine();
      if (!eng) return;
      sequenceRef.current++;
      const now = eng.getCurrentTimeMs();
      // Not yet inside this range (e.g. before the first play): count from its start.
      const from = now >= range.startMs && now <= range.endMs ? now : range.startMs;
      eng.seekInSegment(range, from + deltaMs);
    },
    pause: () => {
      sequenceRef.current++;
      getEngine()?.pause();
    },
    cycleRate: () => {
      const eng = getEngine();
      if (!eng) return;
      const steps = [0.5, 0.75, 1, 1.25];
      const cur = eng.getPlaybackRate();
      const idx = steps.findIndex((s) => Math.abs(s - cur) < 0.01);
      const next = steps[(idx + 1) % steps.length]!;
      eng.setPlaybackRate(next);
      setRateState(next);
    },
  };
}
