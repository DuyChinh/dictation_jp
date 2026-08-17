import { useCallback, useEffect, useMemo, useState } from "react";
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
import { loadSettings, saveSettings, type MascotType } from "../../shared/storage/settingsStore";
import { saveResume } from "../../shared/storage/resumeStore";
import {
  getLessonProgress,
  saveSegmentProgress,
  syncLessonProgressFromServer,
  type SegmentProgressData,
} from "../../shared/storage/dictationProgressStore";
import { recordAnswerAttempt, addPracticeSession } from "../../shared/storage/practiceHistoryStore";
import { DiffView } from "./DiffView";
import { TokenizedInput } from "./TokenizedInput";
import { getLocalizedText } from "../../shared/content/getLocalizedText";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import {
  TranscriptPanel,
  TranslationPanel,
} from "../listening/ResultPanels";
import { getSegmentTranslation } from "./getSegmentTranslation";
import { DictationMascot, type MascotMood } from "./DictationMascot";
import { triggerConfetti, triggerFireworks } from "../../shared/utils/confetti";
import { sfx } from "../../shared/utils/sfx";

export type DictationItem = {
  key: string;
  question: PracticeQuestion;
  segment: PracticeSegment;
  sectionTitle: { ja?: string; vi?: string; en?: string };
};

/**
 * Build sentence-dictation pool.
 * Prefer verified ranges; if a segment lacks start/end, fall back to proportional
 * slices of the question audio range so Mondai without verified timing still work.
 */
function buildItems(practice: PracticePackage, sectionId?: string): DictationItem[] {
  const items: DictationItem[] = [];
  for (const section of practice.sections) {
    if (sectionId && section.id !== sectionId) continue;
    for (const q of section.questions) {
      const mode = q.dictation?.modes?.sentence_dictation;
      if (mode && mode.enabled === false) continue;

      const candidates = mode?.segment_ids
        ? q.segments.filter((s) => mode.segment_ids!.includes(s.id))
        : q.segments.filter((s) => s.dictation_eligible !== false);

      const withText = candidates.filter(
        (s) => (s.text.ja ?? "").trim().length > 0,
      );
      if (!withText.length) continue;

      const qStart = q.audio?.start_ms ?? 0;
      const qEnd = q.audio?.end_ms ?? 0;
      const qDur = Math.max(0, qEnd - qStart);
      /** Skip 「N番」; keep full sentence duration if start is shifted. */
      const numberCueSkipMs = 4000;
      // ~ms/char floor so slices are not shorter than spoken Japanese
      const MS_PER_CHAR = 310;
      const MIN_SEG_MS = 1400;

      const weightedDur = (text: string) => {
        const len = Math.max(1, text.length);
        let d = Math.max(MIN_SEG_MS, Math.round(len * MS_PER_CHAR));
        if (/[。．.?!？！]$/.test(text.trim())) d += 450;
        return d;
      };

      // Preferred raw durations, then scale into remaining window after cue pad
      const cuePad =
        q.order > 1
          ? Math.min(numberCueSkipMs, Math.max(0, qDur - 8000))
          : 0;
      let cursor = qStart + cuePad;
      const avail = Math.max(1000, qEnd - cursor);
      const raws = withText.map((s) => weightedDur(s.text.ja ?? ""));
      let rawSum = raws.reduce((a, b) => a + b, 0) || 1;
      const scale = avail / rawSum;
      const durs = raws.map((d) => Math.max(900, Math.floor(d * scale)));
      const drift = avail - durs.reduce((a, b) => a + b, 0);
      durs[durs.length - 1] = Math.max(900, (durs[durs.length - 1] ?? 900) + drift);

      for (let si = 0; si < withText.length; si++) {
        const segment = withText[si]!;
        let startMs = segment.start_ms;
        let endMs = segment.end_ms;
        const hasRealRange =
          startMs != null &&
          endMs != null &&
          Number.isFinite(startMs) &&
          Number.isFinite(endMs) &&
          endMs > startMs;

        const jaCompact = (segment.text.ja ?? "").replace(/\s/g, "");
        const looksLikeBanner =
          /^[1-9１-９]番/.test(jaCompact) ||
          /^(いち|に|さん|よん|ご)?ばん/i.test(jaCompact);

        if (hasRealRange && segment.timing_status === "verified") {
          // keep verified
        } else if (hasRealRange && segment.timing_status !== "verified") {
          // Keep package estimates but: (1) skip number cue (2) enforce min duration by text length
          const minStart =
            si === 0 && q.order > 1 && !looksLikeBanner
              ? qStart + cuePad
              : startMs!;
          if (startMs! < minStart) {
            const delta = minStart - startMs!;
            startMs = minStart;
            endMs = (endMs as number) + delta; // preserve length when shifting
          }
          const minDur = weightedDur(segment.text.ja ?? "");
          if ((endMs as number) - (startMs as number) < minDur) {
            endMs = Math.min(qEnd, (startMs as number) + minDur);
          }
          // avoid overlapping next by stopping at next segment start if available
          const next = withText[si + 1];
          if (
            next?.start_ms != null &&
            next.timing_status === "verified" &&
            (endMs as number) > next.start_ms
          ) {
            endMs = next.start_ms;
          }
        } else {
          // synthesize contiguous non-overlapping ranges
          if (qDur <= 0) continue;
          if (si === 0 && q.order > 1 && !looksLikeBanner) {
            cursor = Math.max(cursor, qStart + cuePad);
          }
          startMs = cursor;
          endMs = Math.min(qEnd, cursor + (durs[si] ?? 1200));
          if (si === withText.length - 1) endMs = qEnd;
          if ((endMs as number) <= (startMs as number)) {
            endMs = Math.min(qEnd, (startMs as number) + 900);
          }
          cursor = endMs as number;
        }

        items.push({
          key: `${q.id}::${segment.id}`,
          question: q,
          segment: {
            ...segment,
            start_ms: startMs as number,
            end_ms: endMs as number,
          },
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
  const { t, uiLang } = useUiLanguage();
  const items = useMemo(
    () => buildItems(practice, sectionId),
    [practice, sectionId],
  );

  /** Question groups in display order for [Câu 1][Câu 2]… navigation */
  const questionGroups = useMemo(() => {
    const groups: Array<{
      questionId: string;
      order: number;
      firstIndex: number;
      count: number;
    }> = [];
    const seen = new Map<string, number>();
    items.forEach((it, i) => {
      const id = it.question.id;
      if (!seen.has(id)) {
        seen.set(id, groups.length);
        groups.push({
          questionId: id,
          order: it.question.order,
          firstIndex: i,
          count: 1,
        });
      } else {
        groups[seen.get(id)!]!.count += 1;
      }
    });
    return groups;
  }, [items]);

  const [index, setIndex] = useState(
    Math.min(Math.max(initialIndex, 0), Math.max(items.length - 1, 0)),
  );

  const activeQuestionId = items[index]?.question.id;
  const activeQuestionGroup = questionGroups.find(
    (g) => g.questionId === activeQuestionId,
  );
  const segmentIndexInQuestion =
    activeQuestionGroup != null
      ? index - activeQuestionGroup.firstIndex + 1
      : 0;

  const jumpToQuestion = useCallback(
    (questionId: string) => {
      const g = questionGroups.find((x) => x.questionId === questionId);
      if (g) setIndex(g.firstIndex);
    },
    [questionGroups],
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
  const [resetKey, setResetKey] = useState(0);
  const [autoReplay, setAutoReplay] = useState(false);
  const [streak, setStreak] = useState(0);
  const [mascot, setMascot] = useState<MascotType>(() => loadSettings().mascot ?? "shiba");
  const [showTranslation, setShowTranslation] = useState<boolean>(() => {
    const s = loadSettings();
    return s.showTranslation ?? true;
  });
  const [progressMap, setProgressMap] = useState<Record<string, SegmentProgressData>>(() =>
    getLessonProgress(lessonId)
  );

  useEffect(() => {
    let cancelled = false;
    syncLessonProgressFromServer(lessonId).then((map) => {
      if (!cancelled) setProgressMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  const handleToggleShowTranslation = useCallback(() => {
    setShowTranslation((prev) => {
      const next = !prev;
      saveSettings({ showTranslation: next });
      return next;
    });
  }, []);

  const settings = loadSettings();
  const audio = useAudioEngine();
  const current = items[index];

  const mascotMood: MascotMood = useMemo(() => {
    if (phase === "checked") {
      if (result?.correct) {
        return streak >= 3 ? "streak" : "correct";
      }
      if (result && !result.correct) {
        return "incorrect";
      }
    }
    if (audio.state === "playing") {
      return "listening";
    }
    if (streak >= 3) {
      return "streak";
    }
    return "idle";
  }, [phase, result, streak, audio.state]);

  const segmentTranslation = useMemo(() => {
    if (!current) return "";
    return getSegmentTranslation(current.segment, current.question, uiLang);
  }, [current, uiLang]);

  // Load audio when practice ready
  useEffect(() => {
    void audio.load(practice.audio_url).catch((e) => {
      setUiError(e instanceof Error ? e.message : "Không tải được audio");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practice.audio_url]);

  // Play segment on index change with a 2-second delay
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

    if (current.segment.start_ms != null && current.segment.end_ms != null) {
      const timer = setTimeout(() => {
        void audio
          .playSegment({
            startMs: current.segment.start_ms as number,
            endMs: current.segment.end_ms as number,
          })
          .then(() => {
            audio.engine?.setPlaybackRate(settings.playbackRate);
          })
          .catch(() => {});
      }, 1000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, current?.key]);

  // Continuous auto-looping of current sentence when autoReplay toggle is ON
  useEffect(() => {
    const eng = audio.engine;
    if (!eng) return;

    const unsub = eng.subscribe((e) => {
      if (e.type === "segmentend" && autoReplay) {
        setTimeout(() => {
          if (eng.getState() !== "playing") {
            void eng.replaySegment().catch(() => {});
          }
        }, 300);
      }
    });

    return () => unsub();
  }, [audio.engine, autoReplay]);

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

      // Save segment progress and update map
      const nextStatus = r.correct ? "correct" : "incorrect";
      saveSegmentProgress(lessonId, current.question.id, current.segment.id, {
        status: nextStatus,
        score: r.score,
        lastAnswer: answer,
      });
      setProgressMap((prev) => ({
        ...prev,
        [current.segment.id]: {
          status: nextStatus,
          score: Math.max(r.score, prev[current.segment.id]?.score || 0),
          attempts: (prev[current.segment.id]?.attempts || 0) + 1,
          lastAnswer: answer,
          updatedAt: Date.now(),
        },
      }));

      const nextStreak = r.correct ? (forceReveal ? 0 : streak + 1) : 0;
      recordAnswerAttempt({
        lessonId,
        correct: r.correct,
        score: r.score,
        streak: nextStreak,
        mascot,
      });

      if (r.correct) {
        if (!forceReveal) {
          setStreak(nextStreak);
          if (nextStreak >= 3) {
            sfx.playStreak(nextStreak);
          } else {
            sfx.playVictory();
          }
          triggerFireworks();
        } else {
          setStreak(0);
        }
      } else {
        sfx.playEncourage();
        setStreak(0);
        setAttemptIndex((n) => n + 1);
      }

      // Record session history entry if at least 1 correct or last segment
      if (r.correct) {
        const totalCorrectSoFar =
          Object.values(progressMap).filter((p) => p.status === "correct").length + 1;
        addPracticeSession({
          lessonId,
          lessonTitle: getLocalizedText(practice.title, "vi") || lessonId,
          level: "JLPT",
          score: Math.round((totalCorrectSoFar / items.length) * 100),
          maxStreak: Math.max(streak, nextStreak),
          correctCount: totalCorrectSoFar,
          totalCount: items.length,
          mascot,
        });
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

  const handleClear = useCallback(() => {
    setAnswer("");
    setResult(null);
    setPhase("editing");
    setResetKey((k) => k + 1);
  }, []);

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

  const progressStats = useMemo(() => {
    let correctCount = 0;
    let incorrectCount = 0;
    items.forEach((it) => {
      const p = progressMap[it.segment.id];
      if (p?.status === "correct") correctCount++;
      else if (p?.status === "incorrect") incorrectCount++;
    });
    const unattemptedCount = Math.max(0, items.length - correctCount - incorrectCount);
    return { correctCount, incorrectCount, unattemptedCount };
  }, [items, progressMap]);

  if (items.length === 0) {
    return <p style={{ color: "var(--text-muted)", textAlign: "center" }}>Không có câu dictation trong phạm vi này.</p>;
  }

  if (!current) return null;

  const progress = ((index + 1) / items.length) * 100;

  return (
    <div className="practice-workspace">
      <div style={{ marginBottom: "1.25rem" }}>
        <h2 className="practice-title">
          {getLocalizedText(practice.title, "vi")} | {getLocalizedText(current.sectionTitle, "vi")}
        </h2>

        <div className="practice-mode-tabs">
          <button
            type="button"
            className={`btn-base ${activeTab === "dictation" ? "btn-primary" : ""}`}
            onClick={() => setActiveTab("dictation")}
            style={{ fontSize: "0.9rem", borderRadius: "8px" }}
          >
            ✍️ {t("dictation.modeSentence")}
          </button>
          <button
            type="button"
            className={`btn-base ${activeTab === "transcript" ? "btn-primary" : ""}`}
            onClick={() => setActiveTab("transcript")}
            style={{ fontSize: "0.9rem", borderRadius: "8px" }}
          >
            📄 {t("dictation.modeTranscript")}
          </button>
        </div>
      </div>

      <AudioPlayerBar audio={audio} />

      {activeTab === "transcript" ? (
        <div className="card-glass" style={{ padding: "1.25rem" }}>
          <TranscriptPanel segments={current.question.segments} speakers={practice.speakers} />
          <TranslationPanel dialogue={current.question.dialogue_translation} segments={current.question.segments} lang="vi" />
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: "0.75rem" }}>
            <div className="practice-mode-select" style={{ margin: 0 }}>
              <label>
                {t("dictation.selectMode")}
                <select
                  value={dictationMode}
                  onChange={(e) => setDictationMode(e.target.value as "full" | "medium" | "hard")}
                >
                  <option value="full">{t("dictation.modeFull")}</option>
                  <option value="medium">{t("dictation.modeMedium")}</option>
                  <option value="hard">{t("dictation.modeHard")}</option>
                </select>
              </label>
            </div>

            <DictationMascot
              mascot={mascot}
              mood={mascotMood}
              streakCount={streak}
              score={result ? result.score : undefined}
              onSelectMascot={(m) => setMascot(m)}
              onPet={() => {
                sfx.playVictory();
                triggerConfetti({ particleCount: 35 });
              }}
            />
          </div>

          <div className="practice-action-bar">
            <div className="segmented-group practice-controls">
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
              resetKey={resetKey}
            />
          </div>

          <div className="practice-secondary-bar">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-base"
                style={{ fontSize: "0.85rem", padding: "0.4rem 0.85rem" }}
                onClick={handleClear}
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

            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div
                className="toggle-switch-container"
                onClick={handleToggleShowTranslation}
                title={t("dictation.showTranslation")}
              >
                <div className={`toggle-switch ${showTranslation ? "checked" : ""}`}>
                  <div className="toggle-switch-handle" />
                </div>
                <span>🌐 {t("dictation.showTranslation")}</span>
              </div>

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
                <div style={{ marginTop: "1.25rem", padding: "1.1rem", borderRadius: "10px", background: "var(--primary-light)", color: "var(--text-main)" }}>
                  <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                    {t("dictation.expectedAnswer")}: <span style={{ color: "var(--primary-color)" }}>{result.revealed.expected_text.ja}</span>
                  </div>
                  {showTranslation && segmentTranslation ? (
                    <div style={{ color: "var(--text-muted)", marginTop: 6, fontSize: "0.95rem", lineHeight: 1.5 }}>
                      <strong>{uiLang === "vi" ? "Dịch nghĩa (VI):" : "Translation (EN):"}</strong> {segmentTranslation}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          <p className="practice-shortcuts">{t("dictation.shortcutsText")}</p>

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

            {questionGroups.length > 1 && (
              <div style={{ marginBottom: "0.85rem" }}>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
                    marginBottom: 6,
                    textAlign: "center",
                  }}
                >
                  {t("dictation.questionNav")}
                  {activeQuestionGroup
                    ? ` · ${t("dictation.questionLabel")} ${activeQuestionGroup.order} · ${segmentIndexInQuestion}/${activeQuestionGroup.count}`
                    : null}
                </div>
                <div className="nav-scroll-row">
                  {questionGroups.map((g) => {
                    const active = g.questionId === activeQuestionId;
                    return (
                      <button
                        key={g.questionId}
                        type="button"
                        className={`question-nav-btn${active ? " is-active" : ""}`}
                        onClick={() => jumpToQuestion(g.questionId)}
                        aria-current={active ? "true" : undefined}
                        title={`${t("dictation.questionLabel")} ${g.order} (${g.count})`}
                      >
                        {t("dictation.questionLabel")} {g.order}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                marginBottom: 6,
                textAlign: "center",
              }}
            >
              {t("dictation.segmentNav")}
            </div>
            <div className="segment-pill-grid">
              {items.map((it, i) => {
                const sameQuestion = it.question.id === activeQuestionId;
                const p = progressMap[it.segment.id];
                const statusClass =
                  p?.status === "correct"
                    ? "segment-pill--correct"
                    : p?.status === "incorrect"
                    ? "segment-pill--incorrect"
                    : "segment-pill--unattempted";

                return (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => setIndex(i)}
                    className={`pagination-pill ${i === index ? "active" : ""} ${statusClass} ${
                      sameQuestion ? "segment-pill--current-q" : "segment-pill--other-q"
                    }`}
                    title={`${t("dictation.questionLabel")} ${it.question.order} - Câu ${i + 1} (${
                      p?.status === "correct"
                        ? "Đã chép đúng"
                        : p?.status === "incorrect"
                        ? "Chưa chuẩn / Cần luyện lại"
                        : "Chưa làm"
                    })`}
                    style={
                      sameQuestion && i !== index && !p
                        ? { borderColor: "var(--primary-color)", opacity: 0.9 }
                        : undefined
                    }
                  >
                    {p?.status === "correct" ? "✓ " : p?.status === "incorrect" ? "✗ " : ""}
                    {i + 1}
                  </button>
                );
              })}
            </div>

            {/* Progress Legend & Summary */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 16,
                marginTop: "0.85rem",
                fontSize: "0.82rem",
                color: "var(--text-muted)",
              }}
            >
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: "#22c55e" }} />
                <span>Đúng: <strong style={{ color: "#22c55e" }}>{progressStats.correctCount}</strong></span>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: "#ef4444" }} />
                <span>Cần sửa: <strong style={{ color: "#ef4444" }}>{progressStats.incorrectCount}</strong></span>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: "var(--border-color)" }} />
                <span>Chưa làm: <strong>{progressStats.unattemptedCount}</strong></span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
