import { useEffect, useState } from "react";
import type { useAudioEngine } from "./useAudioEngine";
import { saveSettings } from "../storage/settingsStore";
import { useUiLanguage } from "../i18n/UiLanguageContext";
import { Icon } from "../ui/Icon";

const SPEEDS = [0.75, 1, 1.25];

/** mm:ss.s — for short sentences where tenths matter. */
function formatClock(ms: number): string {
  const total = Math.max(0, ms) / 1000;
  const m = Math.floor(total / 60);
  const sec = total - m * 60;
  return `${String(m).padStart(2, "0")}:${sec.toFixed(1).padStart(4, "0")}`;
}

/** mm:ss — for whole questions. */
function formatDuration(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Player scoped to one audio range: play / pause, replay, progress within the range, speed.
 * `clock="absolute"` shows position in the file (dictation sentences);
 * `clock="relative"` shows elapsed / length of the range (listening questions).
 */
export function SegmentPlayer({
  audio,
  range,
  onReplay,
  clock = "absolute",
  replayLabel,
}: {
  audio: ReturnType<typeof useAudioEngine>;
  range: { startMs: number; endMs: number } | null;
  onReplay: () => void;
  clock?: "absolute" | "relative";
  replayLabel?: string;
}) {
  const { t } = useUiLanguage();
  const [nowMs, setNowMs] = useState(range?.startMs ?? 0);
  const playing = audio.state === "playing";

  useEffect(() => {
    const id = setInterval(() => {
      const eng = audio.engine;
      if (eng) setNowMs(eng.getCurrentTimeMs());
    }, 100);
    return () => clearInterval(id);
  }, [audio.engine]);

  const span = range ? Math.max(1, range.endMs - range.startMs) : 1;
  const inRange = range ? Math.min(Math.max(nowMs - range.startMs, 0), span) : 0;
  const pct = Math.round((inRange / span) * 100);

  const onToggle = () => {
    if (playing) {
      audio.pause();
      return;
    }
    if (range) void audio.playSegment(range).catch(() => {});
  };

  const onRate = (r: number) => {
    audio.setRate(r);
    saveSettings({ playbackRate: r });
  };

  const replay = replayLabel ?? `${t("dictation.replay")} (Alt+R)`;

  return (
    <section className="panel player" aria-label={t("dictation.play")}>
      <button
        type="button"
        className="player__play"
        onClick={onToggle}
        aria-label={playing ? t("dictation.pause") : t("dictation.play")}
        disabled={!range}
      >
        <Icon name={playing ? "pause" : "play"} size={22} />
      </button>
      <button
        type="button"
        className="icon-btn icon-btn--round"
        onClick={onReplay}
        aria-label={replay}
        title={replay}
        disabled={!range}
      >
        <Icon name="replay" size={18} strokeWidth={1.9} />
      </button>
      <div className="player__track">
        <div className="progress" aria-hidden="true">
          <span style={{ width: `${pct}%`, transition: "none" }} />
        </div>
        <div className="player__times">
          {clock === "relative" ? (
            <>
              <span>{formatDuration(inRange)}</span>
              {range && <span>{formatDuration(span)}</span>}
            </>
          ) : (
            <>
              <span>{formatClock(range ? range.startMs + inRange : nowMs)}</span>
              {range && (
                <span>
                  {formatClock(range.startMs)} – {formatClock(range.endMs)}
                </span>
              )}
            </>
          )}
        </div>
      </div>
      <div className="segmented player__speed" role="group" aria-label={t("audio.speedTitle")}>
        {SPEEDS.map((r) => (
          <button key={r} type="button" aria-pressed={Math.abs(audio.rate - r) < 0.01} onClick={() => onRate(r)}>
            {r}×
          </button>
        ))}
      </div>
    </section>
  );
}
