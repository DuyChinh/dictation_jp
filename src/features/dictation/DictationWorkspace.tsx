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
import { DialoguePanel } from "../listening/ResultPanels";
import { getSegmentTranslation } from "./getSegmentTranslation";
import { DictationMascot, type MascotMood } from "./DictationMascot";
import { triggerConfetti, triggerFireworks } from "../../shared/utils/confetti";
import { sfx } from "../../shared/utils/sfx";
import { Link } from "react-router-dom";
import { Icon } from "../../shared/ui/Icon";
import { SegmentPlayer } from "../../shared/audio/SegmentPlayer";

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

export type PartLink = { id?: string; label: string; href: string; active: boolean };

type Props = {
  lessonId: string;
  practice: PracticePackage;
  sectionId?: string;
  initialIndex?: number;
  /** Start on the first sentence of this question (overrides initialIndex). */
  initialQuestionId?: string;
  /** Part (問題) switcher entries; each is a link to that part's dictation. */
  parts?: PartLink[];
  /** Lesson detail page, linked from the progress card. */
  lessonHref?: string;
  /** Name of the current part's type (e.g. "Hiểu vấn đề"), shown under the title. */
  sectionTypeLabel?: string;
};

export function DictationWorkspace({
  lessonId,
  practice,
  sectionId,
  initialIndex = 0,
  initialQuestionId,
  parts,
  lessonHref,
  sectionTypeLabel,
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

  const [index, setIndex] = useState(() => {
    const fromQuestion = initialQuestionId
      ? items.findIndex((it) => it.question.id === initialQuestionId)
      : -1;
    const start = fromQuestion >= 0 ? fromQuestion : initialIndex;
    return Math.min(Math.max(start, 0), Math.max(items.length - 1, 0));
  });

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
      const target = e.target as HTMLElement | null;
      const onControl = !!target?.closest("button, a, select, textarea");
      // Plain Enter submits too, but never while an IME is composing (Japanese input confirms with Enter).
      const plainEnter =
        e.key === "Enter" && !e.isComposing && e.keyCode !== 229 && !e.shiftKey && !e.altKey && !onControl;
      if ((meta && e.key === "Enter") || plainEnter) {
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

  const onAnswerChange = (val: string) => {
    setAnswer(val);
    if (phase === "checked") setPhase("editing");
  };

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
    return <div className="notice">{t("dictation.empty")}</div>;
  }

  if (!current) return null;

  const questionItems = items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => it.question.id === activeQuestionId);
  const questionCorrect = questionItems.filter(
    ({ it }) => progressMap[it.segment.id]?.status === "correct",
  ).length;
  const examPct = Math.round((progressStats.correctCount / items.length) * 100);
  const questionLabel = `${t("dictation.questionLabel")} ${current.question.order}`;

  return (
    <div className="dict">
      <div className="dict__main">
        <div className="dict-head">
          <div className="dict-head__title">
            <span className="jp">{getLocalizedText(current.sectionTitle, "ja")}{sectionTypeLabel ? ` · ${sectionTypeLabel}` : ""}</span>
            <h1>
              {questionLabel}{" "}
              <small>
                · {t("dictation.sentence")} {segmentIndexInQuestion} / {activeQuestionGroup?.count ?? 1}
              </small>
            </h1>
          </div>
          <div className="dict-head__tools">
            {activeTab === "dictation" && (
              <div className="segmented" role="radiogroup" aria-label={t("dictation.level")}>
                {(["full", "medium", "hard"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={dictationMode === m}
                    onClick={() => setDictationMode(m)}
                  >
                    {t(m === "full" ? "dictation.modeFull" : m === "medium" ? "dictation.modeMedium" : "dictation.modeHard")}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              className="btn btn--outline btn--sm"
              aria-pressed={activeTab === "transcript"}
              onClick={() => setActiveTab((v) => (v === "transcript" ? "dictation" : "transcript"))}
            >
              <Icon name={activeTab === "transcript" ? "pencil" : "file"} size={16} />
              {activeTab === "transcript" ? t("dictation.hideTranscript") : t("dictation.transcript")}
            </button>
          </div>
        </div>

        <SegmentPlayer
          audio={audio}
          range={
            current.segment.start_ms != null && current.segment.end_ms != null
              ? { startMs: current.segment.start_ms, endMs: current.segment.end_ms }
              : null
          }
          onReplay={() => void onReplay()}
        />

        {activeTab === "transcript" ? (
          <section className="panel" style={{ padding: 24 }}>
            <DialoguePanel
              segments={current.question.segments}
              speakers={practice.speakers}
              dialogue={current.question.dialogue_translation}
              lang="vi"
            />
          </section>
        ) : (
          <>
            <section className="panel answer" aria-label={t("dictation.typeHere")}>
              <span className="answer__label" id="dict-answer-label">
                {t("dictation.typeHere")}
              </span>
              <div role="group" aria-labelledby="dict-answer-label">
                <TokenizedInput
                  expectedText={current.segment.text.ja ?? ""}
                  mode={dictationMode}
                  phase={phase}
                  onAnswerChange={onAnswerChange}
                  result={result}
                  resetKey={resetKey}
                />
              </div>
              <div className="answer__bar">
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={checking || !answer.trim()}
                  onClick={() => void onCheck()}
                >
                  {checking ? t("dictation.checking") : t("dictation.check")}
                  <kbd className="kbd">Enter</kbd>
                </button>
                <button type="button" className="btn btn--outline" onClick={() => void onCheck(true)}>
                  <Icon name="eye" size={18} />
                  {t("dictation.showAnswer")}
                </button>
                <button type="button" className="btn btn--ghost" onClick={handleClear}>
                  {t("dictation.clearAnswer")}
                </button>
                <div className="answer__toggles">
                  <label className="check">
                    <input type="checkbox" checked={showTranslation} onChange={handleToggleShowTranslation} />
                    {t("dictation.showTranslation")}
                  </label>
                  <label className="check">
                    <input type="checkbox" checked={autoReplay} onChange={() => setAutoReplay((v) => !v)} />
                    {t("dictation.autoReplay")}
                  </label>
                </div>
              </div>
            </section>

            {uiError && (
              <div className="notice notice--error" role="alert">
                <Icon name="alert" />
                {uiError}
              </div>
            )}

            {result && (
              <section className="panel result" aria-live="polite">
                <div className="result__head">
                  <div
                    className="score-ring"
                    style={{
                      ["--pct" as string]: result.score,
                      ["--ring-color" as string]: result.correct
                        ? "var(--ok)"
                        : result.score >= 60
                          ? "var(--acc)"
                          : "var(--bad)",
                    }}
                  >
                    <span>{result.score}%</span>
                  </div>
                  <div className="result__verdict">
                    <strong>{result.correct ? t("dictation.correct") : t("dictation.incorrect")}</strong>
                    <span>{result.correct ? t("dictation.perfectSub") : t("dictation.nearly")}</span>
                  </div>
                </div>

                <DiffView ops={result.ops} />

                {(result.revealed || (showTranslation && segmentTranslation)) && (
                  <div className="result__pair">
                    {result.revealed && (
                      <div>
                        <span className="eyebrow">{t("dictation.expectedAnswer")}</span>
                        <span className="result__answer">{result.revealed.expected_text.ja}</span>
                      </div>
                    )}
                    {showTranslation && segmentTranslation && (
                      <div>
                        <span className="eyebrow">{t("dictation.translation")}</span>
                        <span className="result__translation">{segmentTranslation}</span>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            <div className="dict-foot">
              <button type="button" className="btn btn--outline" onClick={goPrev} disabled={index === 0}>
                <Icon name="chevronLeft" size={18} strokeWidth={2} />
                {t("dictation.prev")}
              </button>
              <span className="dict-foot__keys">
                {t("dictation.shortcuts")}: <kbd className="kbd">Enter</kbd> {t("dictation.kbSubmit")} ·{" "}
                <kbd className="kbd">Alt</kbd>+<kbd className="kbd">R</kbd> {t("dictation.kbReplay")} ·{" "}
                <kbd className="kbd">Shift</kbd>+<kbd className="kbd">← / →</kbd> {t("dictation.kbNav")}
              </span>
              <button
                type="button"
                className="btn btn--dark dict-foot__next"
                onClick={goNext}
                disabled={index >= items.length - 1}
              >
                {t("dictation.next")}
                <Icon name="chevronRight" size={18} strokeWidth={2} />
              </button>
            </div>
          </>
        )}
      </div>

      <aside className="dict__aside" aria-label={t("dictation.questionNav")}>
        <section className="panel dict-nav">
          {parts && parts.length > 1 && (
            <div className="dict-nav__block">
              <span className="eyebrow">{t("dictation.part")}</span>
              <div className="pill-grid">
                {parts.map((p) => (
                  <Link
                    key={p.id ?? "all"}
                    to={p.href}
                    className={`pill${p.active ? " is-active" : ""}`}
                    aria-current={p.active ? "page" : undefined}
                  >
                    {p.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {questionGroups.length > 1 && (
            <div className="dict-nav__block">
              <span className="eyebrow">{t("dictation.questions")}</span>
              <div className="pill-grid">
                {questionGroups.map((g) => {
                  const active = g.questionId === activeQuestionId;
                  return (
                    <button
                      key={g.questionId}
                      type="button"
                      className={`pill${active ? " is-active" : ""}`}
                      aria-pressed={active}
                      onClick={() => jumpToQuestion(g.questionId)}
                    >
                      {t("dictation.questionLabel")} {g.order}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <hr />
          <div className="dict-nav__block">
            <div className="dict-nav__row">
              <span className="eyebrow">
                {t("dictation.sentencesIn")} {questionLabel}
              </span>
              <span>
                {questionCorrect} / {questionItems.length} {t("dictation.correctCount")}
              </span>
            </div>
            <div className="pill-grid">
              {questionItems.map(({ it, i }, n) => {
                const status = progressMap[it.segment.id]?.status;
                const isCurrent = i === index;
                const cls = isCurrent
                  ? "is-current"
                  : status === "correct"
                    ? "is-correct"
                    : status === "incorrect"
                      ? "is-incorrect"
                      : "";
                const word = isCurrent
                  ? t("dictation.legendCurrent")
                  : status === "correct"
                    ? t("dictation.legendCorrect")
                    : status === "incorrect"
                      ? t("dictation.legendFix")
                      : t("dictation.legendTodo");
                return (
                  <button
                    key={it.key}
                    type="button"
                    className={`seg-pill ${cls}`}
                    aria-current={isCurrent ? "step" : undefined}
                    aria-label={`${t("dictation.sentence")} ${n + 1}, ${word}`}
                    onClick={() => setIndex(i)}
                  >
                    {n + 1}
                  </button>
                );
              })}
            </div>
            <div className="seg-legend">
              <span><i className="i-ok" />{t("dictation.legendCorrect")}</span>
              <span><i className="i-bad" />{t("dictation.legendFix")}</span>
              <span><i className="i-todo" />{t("dictation.legendTodo")}</span>
              <span><i className="i-cur" />{t("dictation.legendCurrent")}</span>
            </div>
          </div>
        </section>

        <section className="panel dict-progress">
          <span className="eyebrow">{t("dictation.examProgress")}</span>
          <div className="dict-progress__num">
            <strong>{progressStats.correctCount}</strong>
            <span>
              / {items.length} {t("dictation.sentencesDone")}
            </span>
          </div>
          <div className="progress" role="progressbar" aria-valuenow={examPct} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${examPct}%` }} />
          </div>
          {lessonHref && <Link to={lessonHref}>{t("dictation.allParts")}</Link>}
        </section>

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
      </aside>
    </div>
  );
}
