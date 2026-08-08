import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PracticePackage,
  PracticeQuestion,
  PracticeSegment,
} from "../../shared/api/content";
import {
  evaluateDictation,
  type DictationEvalResult,
} from "../../shared/api/evaluate";
import { useAudioEngine } from "../../shared/audio/useAudioEngine";
import { AudioPlayerBar } from "../../shared/audio/AudioPlayerBar";
import { loadSettings } from "../../shared/storage/settingsStore";
import { saveResume } from "../../shared/storage/resumeStore";
import { DiffView } from "./DiffView";
import { TokenizedInput } from "./TokenizedInput";
import { getLocalizedText } from "../../shared/content/getLocalizedText";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import {
  TranscriptPanel,
  TranslationPanel,
} from "../listening/ResultPanels";

export type DictationItem = {
  key: string;
  question: PracticeQuestion;
  segment: PracticeSegment;
  sectionTitle: { ja?: string; vi?: string; en?: string };
};

function buildItems(practice: PracticePackage, sectionId?: string): DictationItem[] {
  const items: DictationItem[] = [];
  for (const section of practice.sections) {
    if (sectionId && section.id !== sectionId) continue;
    for (const q of section.questions) {
      const mode = q.dictation?.modes?.sentence_dictation;
      if (mode && mode.enabled === false) continue;
      const pool = mode?.segment_ids
        ? q.segments.filter((s) => mode.segment_ids!.includes(s.id))
        : q.segments.filter(
            (s) =>
              s.dictation_eligible !== false &&
              s.start_ms != null &&
              s.end_ms != null &&
              s.end_ms > s.start_ms,
          );
      for (const segment of pool) {
        items.push({
          key: `${q.id}::${segment.id}`,
          question: q,
          segment,
          sectionTitle: section.title,
        });
      }
    }
  }
  return items;
}

type Props = {
  lessonId: string;
  practice: PracticePackage;
  sectionId?: string;
  initialIndex?: number;
};

export function DictationWorkspace({
  lessonId,
  practice,
  sectionId,
  initialIndex = 0,
}: Props) {
  const { t } = useUiLanguage();
  const items = useMemo(
    () => buildItems(practice, sectionId),
    [practice, sectionId],
  );
  const [index, setIndex] = useState(
    Math.min(Math.max(initialIndex, 0), Math.max(items.length - 1, 0)),
  );

  const [activeTab, setActiveTab] = useState<"dictation" | "transcript">("dictation");
  const [dictationMode, setDictationMode] = useState<"full" | "medium" | "hard">("full");
  const [answer, setAnswer] = useState("");
  const [attemptIndex, setAttemptIndex] = useState(1);
  const [replayCount, setReplayCount] = useState(0);
  const [result, setResult] = useState<DictationEvalResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"editing" | "checked">("editing");
  const [autoReplay, setAutoReplay] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const settings = loadSettings();
  const audio = useAudioEngine();
  const current = items[index];

  // Load audio when practice ready
  useEffect(() => {
    void audio.load(practice.audio_url).catch((e) => {
      setUiError(e instanceof Error ? e.message : "Không tải được audio");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practice.audio_url]);

  // Play segment on index change / autoplay
  useEffect(() => {
    if (!current) return;
    setAnswer("");
    setResult(null);
    setAttemptIndex(1);
    setReplayCount(0);
    setPhase("editing");
    setUiError(null);
    saveResume({
      lesson_id: lessonId,
      mode: "sentence_dictation",
      section_id: sectionId,
      question_id: current.question.id,
      segment_id: current.segment.id,
    });

    const play = async () => {
      if (!autoReplay) return;
      try {
        await audio.playSegment({
          startMs: current.segment.start_ms as number,
          endMs: current.segment.end_ms as number,
        });
        audio.engine?.setPlaybackRate(settings.playbackRate);
      } catch {
        /* user gesture needed */
      }
      textareaRef.current?.focus();
    };
    void play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, current?.key]);

  const onCheck = useCallback(async (overrideForceReveal?: boolean) => {
    if (!current || checking) return;
    setChecking(true);
    setUiError(null);
    try {
      const forceReveal = overrideForceReveal ?? (attemptIndex > settings.retryBeforeReveal);
      const { result: r } = await evaluateDictation({
        lesson_id: lessonId,
        question_id: current.question.id,
        segment_id: current.segment.id,
        mode: "sentence_dictation",
        answer: { raw: answer },
        force_reveal: forceReveal || undefined,
        behavior: {
          attempt_index: attemptIndex,
          replay_count: replayCount,
          hint_count: 0,
        },
      });
      setResult(r);
      setPhase("checked");
      if (!r.correct) {
        setAttemptIndex((n) => n + 1);
      }
    } catch (e) {
      setUiError(e instanceof Error ? e.message : "Không chấm được bài");
    } finally {
      setChecking(false);
    }
  }, [
    answer,
    attemptIndex,
    checking,
    current,
    lessonId,
    replayCount,
    settings.retryBeforeReveal,
  ]);

  const onReplay = useCallback(async () => {
    if (!current) return;
    setReplayCount((n) => n + 1);
    try {
      await audio.playSegment({
        startMs: current.segment.start_ms as number,
        endMs: current.segment.end_ms as number,
      });
    } catch (e) {
      setUiError(e instanceof Error ? e.message : "Replay lỗi");
    }
  }, [audio, current]);

  const goNext = useCallback(() => {
    if (index < items.length - 1) setIndex((i) => i + 1);
  }, [index, items.length]);

  const goPrev = useCallback(() => {
    if (index > 0) setIndex((i) => i - 1);
  }, [index]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "Enter") {
        e.preventDefault();
        if (phase === "editing" || (result && !result.correct)) {
          void onCheck();
        } else if (phase === "checked" && result?.correct) {
          goNext();
        }
        return;
      }
      if (e.altKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        void onReplay();
        return;
      }
      if (e.shiftKey && e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
        return;
      }
      if (e.shiftKey && e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onCheck, onReplay, phase, result]);

  if (items.length === 0) {
    return <p style={{ color: "var(--text-muted)", textAlign: "center" }}>Không có câu dictation trong phạm vi này.</p>;
  }

  if (!current) return null;

  const progress = ((index + 1) / items.length) * 100;

  return (
    <div style={{ maxWidth: 840, margin: "0 auto" }}>
      {/* Title Header */}
      <div style={{ marginBottom: "1.25rem" }}>
        <h2 style={{ fontSize: "1.35rem", fontWeight: 800, margin: "0 0 0.5rem" }}>
          {getLocalizedText(practice.title, "vi")} | {getLocalizedText(current.sectionTitle, "vi")}
        </h2>

        {/* Mode Switcher Tabs */}
        <div style={{ display: "flex", gap: 10, marginTop: "0.85rem" }}>
          <button
            type="button"
            className={`btn-base ${activeTab === "dictation" ? "btn-primary" : ""}`}
            onClick={() => setActiveTab("dictation")}
            style={{ fontSize: "0.9rem", padding: "0.45rem 1rem", borderRadius: "8px" }}
          >
            ✍️ {t("dictation.modeSentence")}
          </button>
          <button
            type="button"
            className={`btn-base ${activeTab === "transcript" ? "btn-primary" : ""}`}
            onClick={() => setActiveTab("transcript")}
            style={{ fontSize: "0.9rem", padding: "0.45rem 1rem", borderRadius: "8px" }}
          >
            📄 {t("dictation.modeTranscript")}
          </button>
        </div>
      </div>

      {/* Audio Player Bar */}
      <AudioPlayerBar audio={audio} />

      {activeTab === "transcript" ? (
        <div className="card-glass" style={{ padding: "1.5rem" }}>
          <TranscriptPanel segments={current.question.segments} speakers={practice.speakers} />
          <TranslationPanel dialogue={current.question.dialogue_translation} segments={current.question.segments} lang="vi" />
        </div>
      ) : (
        <>
          {/* Mode Selector */}
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <label style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-main)" }}>
              {t("dictation.selectMode")}{" "}
              <select
                value={dictationMode}
                onChange={(e) => setDictationMode(e.target.value as any)}
                style={{
                  marginLeft: 8,
                  padding: "0.4rem 0.8rem",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--card-bg)",
                  color: "var(--text-main)",
                  fontSize: "0.95rem",
                  cursor: "pointer",
                }}
              >
                <option value="full">{t("dictation.modeFull")}</option>
                <option value="medium">{t("dictation.modeMedium")}</option>
                <option value="hard">{t("dictation.modeHard")}</option>
              </select>
            </label>
          </div>

          {/* Main Action Bar */}
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            {/* Segmented Button Controls */}
            <div className="segmented-group">
              <button type="button" onClick={goPrev} disabled={index === 0}>
                ‹ {t("dictation.prev")}
              </button>
              <button type="button" onClick={() => void onReplay()}>
                ⟳ {t("dictation.replay")}
              </button>
              <button
                type="button"
                className="btn-check-active"
                disabled={checking || !answer.trim()}
                onClick={() => void onCheck()}
              >
                ✔ {checking ? t("dictation.checking") : t("dictation.check")}
              </button>
              <button type="button" onClick={goNext} disabled={index >= items.length - 1}>
                {t("dictation.next")} ›
              </button>
            </div>
          </div>

          {/* Tokenized Input Box */}
          <div style={{ marginBottom: "1rem" }}>
            <TokenizedInput
              expectedText={current.segment.text.ja ?? ""}
              mode={dictationMode}
              phase={phase}
              onAnswerChange={(val) => {
                setAnswer(val);
                if (phase === "checked") setPhase("editing");
              }}
              result={result}
            />
          </div>

          {/* Secondary Action Controls & Auto Replay Toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 16,
              marginBottom: "1.5rem",
            }}
          >
            {/* Left: Clear & Reveal Buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn-base"
                style={{ fontSize: "0.85rem", padding: "0.4rem 0.85rem" }}
                onClick={() => setAnswer("")}
              >
                ⊗ {t("dictation.clear")}
              </button>
              <button
                type="button"
                className="btn-base"
                style={{ fontSize: "0.85rem", padding: "0.4rem 0.85rem" }}
                onClick={() => void onCheck(true)}
              >
                ⚑ {t("dictation.showAnswer")}
              </button>
            </div>

            {/* Right: Auto Replay Switch */}
            <div
              className="toggle-switch-container"
              onClick={() => setAutoReplay((v) => !v)}
            >
              <div className={`toggle-switch ${autoReplay ? "checked" : ""}`}>
                <div className="toggle-switch-handle" />
              </div>
              <span>⚡ {t("dictation.autoReplay")}</span>
            </div>
          </div>

          {/* Error display */}
          {uiError && (
            <div className="card-glass" style={{ color: "#ef4444", borderColor: "#f87171", textAlign: "center", padding: "0.85rem", marginBottom: "1rem" }}>
              {uiError}
            </div>
          )}

          {/* Result Panel */}
          {result && (
            <div
              className="card-glass"
              style={{
                marginBottom: "1.75rem",
                padding: "1.5rem",
                borderLeft: result.correct ? "4px solid #22c55e" : "4px solid #ef4444",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
                  {t("dictation.score")}: <span style={{ color: result.correct ? "#22c55e" : "#ef4444" }}>{result.score}%</span>
                </h3>
                <span style={{ fontWeight: 700, color: result.correct ? "#22c55e" : "#ef4444" }}>
                  {result.correct ? t("dictation.correct") : t("dictation.incorrect")}
                </span>
              </div>

              <DiffView ops={result.ops} />

              {result.revealed && (
                <div style={{ marginTop: "1.25rem", padding: "1rem", borderRadius: "10px", background: "var(--primary-light)", color: "var(--text-main)" }}>
                  <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                    {t("dictation.expectedAnswer")}: {result.revealed.expected_text.ja}
                  </div>
                  <div style={{ color: "var(--text-muted)", marginTop: 4, fontSize: "0.95rem" }}>
                    {result.revealed.expected_text.vi}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Shortcuts Legend */}
          <p style={{ textAlign: "center", fontSize: "0.82rem", color: "var(--text-subtle)", fontStyle: "italic", margin: "1.5rem 0" }}>
            {t("dictation.shortcutsText")}
          </p>

          {/* Timeline Bar & Pagination Pills (Dark Mode Fix) */}
          <div style={{ marginTop: "2rem" }}>
            <div
              style={{
                height: 6,
                background: "var(--border-color)",
                borderRadius: 99,
                overflow: "hidden",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  background: "var(--primary-color)",
                  transition: "width 0.3s ease",
                }}
              />
            </div>

            {/* Pagination Pills */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                justifyContent: "center",
              }}
            >
              {items.map((it, i) => (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`pagination-pill ${i === index ? "active" : ""}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
