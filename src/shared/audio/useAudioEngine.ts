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
  const [state, setState] = useState<TransportState>("idle");
  const [rate, setRate] = useState(1);

  useEffect(() => {
    const engine = new AudioEngine();
    engineRef.current = engine;

    const unsub = engine.subscribe((e: AudioEngineEvent) => {
      if (e.type === "statechange") setState(e.state);
      if (e.type === "ratechange") setRate(e.rate);
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
    load: (src: string) => getEngine()?.load(resolveAudioSrc(src)) ?? Promise.resolve(),
    playSegment: (range: SegmentRange, opts?: { rate?: number }) =>
      getEngine()?.playSegment(range, opts) ?? Promise.resolve(),
    replay: () => getEngine()?.replaySegment() ?? Promise.resolve(),
    pause: () => getEngine()?.pause(),
    cycleRate: () => {
      const eng = getEngine();
      if (!eng) return;
      const steps = [0.5, 0.75, 1, 1.25];
      const cur = eng.getPlaybackRate();
      const idx = steps.findIndex((s) => Math.abs(s - cur) < 0.01);
      const next = steps[(idx + 1) % steps.length]!;
      eng.setPlaybackRate(next);
      setRate(next);
    },
  };
}
