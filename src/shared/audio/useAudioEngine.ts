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
      setRateState(next);
    },
  };
}
