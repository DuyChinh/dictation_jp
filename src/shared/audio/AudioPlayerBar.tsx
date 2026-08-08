import { useState, useEffect } from "react";
import type { useAudioEngine } from "./useAudioEngine";

type AudioPlayerBarProps = {
  audio: ReturnType<typeof useAudioEngine>;
  title?: string;
};

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function AudioPlayerBar({ audio }: AudioPlayerBarProps) {
  const isPlaying = audio.state === "playing";
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (audio.engine) {
        const ms = audio.engine.getCurrentTimeMs();
        setCurrentTimeSec(ms / 1000);
        const d = audio.engine.getDurationMs();
        if (d) setDurationSec(d / 1000);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [audio.engine]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    setCurrentTimeSec(newTime);
    if (audio.engine) {
      void audio.playSegment({ startMs: newTime * 1000, endMs: (durationSec || 3600) * 1000 });
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      audio.pause();
    } else if (audio.engine) {
      void audio.engine.play();
    }
  };

  const remainingSec = Math.max(0, durationSec - currentTimeSec);

  return (
    <div
      className="card-glass"
      style={{
        padding: "0.85rem 1.5rem",
        marginBottom: "1.5rem",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        title={isPlaying ? "Pause" : "Play"}
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontSize: "1.2rem",
          color: "var(--primary-color)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>

      {/* Progress Bar (Timeline) */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
        <input
          type="range"
          min={0}
          max={durationSec || 100}
          step={0.1}
          value={currentTimeSec}
          onChange={handleSeek}
          style={{
            width: "100%",
            accentColor: "var(--primary-color)",
            cursor: "pointer",
            height: 6,
            borderRadius: 99,
          }}
        />
        <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontFamily: "monospace", minWidth: 55 }}>
          -{formatTime(remainingSec)}
        </span>
      </div>

      {/* Speed & Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={() => audio.cycleRate()}
          title="Playback Speed"
          style={{
            background: "var(--primary-light)",
            color: "var(--primary-color)",
            border: "none",
            borderRadius: "6px",
            padding: "0.25rem 0.6rem",
            fontSize: "0.82rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {audio.rate}×
        </button>

        {/* Volume Icon */}
        <button
          type="button"
          onClick={() => setIsMuted((v) => !v)}
          style={{
            background: "transparent",
            border: "none",
            fontSize: "1.1rem",
            cursor: "pointer",
            color: "var(--text-muted)",
          }}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? "🔇" : "🔊"}
        </button>
      </div>
    </div>
  );
}
