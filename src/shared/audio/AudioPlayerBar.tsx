import { useState, useEffect, useRef } from "react";
import type { useAudioEngine } from "./useAudioEngine";
import { useUiLanguage } from "../i18n/UiLanguageContext";

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

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2.0];

export function AudioPlayerBar({ audio }: AudioPlayerBarProps) {
  const { t } = useUiLanguage();
  const isPlaying = audio.state === "playing";
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);

  const [volume, setVolume] = useState(1);
  const [prevVolume, setPrevVolume] = useState(1);
  const [showSpeedDropdown, setShowSpeedDropdown] = useState(false);
  const speedDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (audio.engine) {
        const ms = audio.engine.getCurrentTimeMs();
        setCurrentTimeSec(ms / 1000);
        const d = audio.engine.getDurationMs();
        if (d) setDurationSec(d / 1000);
      }
    }, 150);
    return () => clearInterval(interval);
  }, [audio.engine]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        speedDropdownRef.current &&
        !speedDropdownRef.current.contains(e.target as Node)
      ) {
        setShowSpeedDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    setCurrentTimeSec(newTime);
    if (audio.engine) {
      void audio.playSegment({ startMs: newTime * 1000, endMs: (durationSec || 3600) * 1000 });
    }
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    audio.setVolume(v);
  };

  const toggleMute = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      handleVolumeChange(0);
    } else {
      handleVolumeChange(prevVolume || 1);
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
  const volumePercent = Math.round(volume * 100);

  return (
    <div className="card-glass audio-bar">
      <button
        type="button"
        className="audio-bar__play"
        onClick={togglePlay}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>

      <div className="audio-bar__timeline">
        <input
          type="range"
          className="audio-bar__seek"
          min={0}
          max={durationSec || 100}
          step={0.1}
          value={currentTimeSec}
          onChange={handleSeek}
          aria-label="Seek"
        />
        <span className="audio-bar__time">-{formatTime(remainingSec)}</span>
      </div>

      <div className="audio-bar__extras">
        <div ref={speedDropdownRef} style={{ position: "relative" }}>
          <button
            type="button"
            className="audio-bar__speed-btn"
            onClick={() => setShowSpeedDropdown((v) => !v)}
            title="Tốc độ phát"
          >
            <span>{audio.rate}×</span>
            <span style={{ fontSize: "0.65rem", opacity: 0.8 }}>▼</span>
          </button>

          {showSpeedDropdown && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 8px)",
                right: 0,
                background: "var(--card-bg)",
                border: "1px solid var(--border-color)",
                borderRadius: "10px",
                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.25)",
                padding: "6px 0",
                minWidth: "175px",
                zIndex: 100,
                backdropFilter: "blur(12px)",
                whiteSpace: "nowrap",
              }}
            >
              <div
                style={{
                  padding: "4px 12px",
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  borderBottom: "1px solid var(--border-color)",
                  marginBottom: 4,
                }}
              >
                {t("audio.speedTitle")}
              </div>
              {SPEED_OPTIONS.map((rateOption) => {
                const isActive = Math.abs(audio.rate - rateOption) < 0.01;
                return (
                  <button
                    key={rateOption}
                    type="button"
                    onClick={() => {
                      audio.setRate(rateOption);
                      setShowSpeedDropdown(false);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 14px",
                      minHeight: "var(--touch-min)",
                      background: isActive ? "var(--primary-light)" : "transparent",
                      color: isActive ? "var(--primary-color)" : "var(--text-main)",
                      border: "none",
                      fontSize: "0.85rem",
                      fontWeight: isActive ? 700 : 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <span>
                      {rateOption}× {rateOption === 1 ? `(${t("audio.normalSpeed")})` : ""}
                    </span>
                    {isActive && <span>✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="audio-bar__volume">
          <button
            type="button"
            className="audio-bar__mute"
            onClick={toggleMute}
            title={volume === 0 ? "Bật âm thanh" : "Tắt âm thanh"}
          >
            {volume === 0 ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            )}
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="volume-slider audio-bar__volume-slider"
            style={{
              ["--volume-percent" as string]: `${volumePercent}%`,
            }}
            title={`Âm lượng: ${volumePercent}%`}
          />
        </div>
      </div>
    </div>
  );
}
