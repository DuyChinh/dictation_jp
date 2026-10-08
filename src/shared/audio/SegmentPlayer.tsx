import { useEffect, useRef, useState } from "react";
import type { useAudioEngine } from "./useAudioEngine";
import { saveSettings } from "../storage/settingsStore";
import { useUiLanguage } from "../i18n/UiLanguageContext";
import { Icon } from "../ui/Icon";

const SPEEDS = [0.75, 1, 1.25];
/** How far one ←/→ press moves. */
const SEEK_STEP_MS = 5000;

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : null;
  return !!el?.closest("input, textarea, select, [contenteditable='true'], [role='slider']");
}

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
  seekKeys = false,
}: {
  audio: ReturnType<typeof useAudioEngine>;
  range: { startMs: number; endMs: number } | null;
  onReplay: () => void;
  clock?: "absolute" | "relative";
  replayLabel?: string;
  /** ←/→ anywhere on the page (outside text boxes) seek by 5 seconds. */
  seekKeys?: boolean;
}) {
  const { t } = useUiLanguage();
  const [nowMs, setNowMs] = useState(range?.startMs ?? 0);
  const [dragging, setDragging] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
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
    if (range) void audio.resume(range).catch(() => {});
  };

  const seekTo = (ms: number) => {
    if (!range) return;
    audio.seek(range, ms);
    setNowMs(audio.engine?.getCurrentTimeMs() ?? ms);
  };

  const seekBy = (deltaMs: number) => {
    if (!range) return;
    audio.seekBy(range, deltaMs);
    const now = audio.engine?.getCurrentTimeMs();
    if (now != null) setNowMs(now);
  };

  const seekToPointer = (clientX: number) => {
    const bar = barRef.current;
    if (!bar || !range) return;
    const rect = bar.getBoundingClientRect();
    const share = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
    seekTo(range.startMs + share * span);
  };

  useEffect(() => {
    if (!seekKeys || !range) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey || isTypingTarget(e.target)) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      seekBy(e.key === "ArrowRight" ? SEEK_STEP_MS : -SEEK_STEP_MS);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekKeys, range?.startMs, range?.endMs, audio.engine]);

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
      <button
        type="button"
        className="icon-btn icon-btn--round player__skip player__skip--back"
        onClick={() => seekBy(-SEEK_STEP_MS)}
        aria-label={t("audio.back")}
        title={t("audio.back")}
        disabled={!range}
      >
        <Icon name="replay" size={20} strokeWidth={1.7} />
        <span aria-hidden="true">5</span>
      </button>
      <button
        type="button"
        className="icon-btn icon-btn--round player__skip player__skip--fwd"
        onClick={() => seekBy(SEEK_STEP_MS)}
        aria-label={t("audio.forward")}
        title={t("audio.forward")}
        disabled={!range}
      >
        <Icon name="replay" size={20} strokeWidth={1.7} />
        <span aria-hidden="true">5</span>
      </button>
      <div className="player__track">
        <div
          ref={barRef}
          className={`player__seek${dragging ? " is-dragging" : ""}`}
          role="slider"
          tabIndex={range ? 0 : -1}
          aria-label={t("audio.seek")}
          aria-valuemin={0}
          aria-valuemax={Math.round(span / 1000)}
          aria-valuenow={Math.round(inRange / 1000)}
          aria-valuetext={`${formatDuration(inRange)} / ${formatDuration(span)}`}
          aria-disabled={!range}
          onPointerDown={(e) => {
            if (!range || e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
            seekToPointer(e.clientX);
          }}
          onPointerMove={(e) => {
            if (dragging) seekToPointer(e.clientX);
          }}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          onKeyDown={(e) => {
            if (!range) return;
            const moves: Record<string, () => void> = {
              ArrowRight: () => seekBy(SEEK_STEP_MS),
              ArrowUp: () => seekBy(SEEK_STEP_MS),
              ArrowLeft: () => seekBy(-SEEK_STEP_MS),
              ArrowDown: () => seekBy(-SEEK_STEP_MS),
              Home: () => seekTo(range.startMs),
              End: () => seekTo(range.endMs),
            };
            const move = moves[e.key];
            if (!move) return;
            e.preventDefault();
            e.stopPropagation();
            move();
          }}
        >
          <div className="progress">
            <span style={{ width: `${pct}%`, transition: "none" }} />
          </div>
          <span className="player__thumb" style={{ left: `${pct}%` }} aria-hidden="true" />
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
