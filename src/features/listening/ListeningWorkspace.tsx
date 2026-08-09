import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  PracticePackage,
  PracticeQuestion,
} from "../../shared/api/content";
import {
  evaluateListening,
  type ListeningEvalResult,
} from "../../shared/api/evaluate";
import { useAudioEngine } from "../../shared/audio/useAudioEngine";
import { AudioPlayerBar } from "../../shared/audio/AudioPlayerBar";
import { getLocalizedText } from "../../shared/content/getLocalizedText";
import { useContentLanguage } from "../../shared/content/LanguageProvider";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { TextChoiceList } from "./TextChoiceList";
import { ImageChoiceGrid } from "./ImageChoiceGrid";
import { NumberChoiceList } from "./NumberChoiceList";
import { ChoiceRevealList } from "./ChoiceRevealList";
import {
  ExplanationPanel,
  TranscriptPanel,
  TranslationPanel,
} from "./ResultPanels";

type FlatQ = {
  question: PracticeQuestion;
  sectionTitle: { ja?: string; vi?: string; en?: string };
};

/** One exam "page": single MC or multi sub-questions (問題5 Q2) sharing audio. */
type ListeningUnit = {
  unitId: string;
  sectionTitle: FlatQ["sectionTitle"];
  parts: FlatQ[];
};

function unitKey(q: PracticeQuestion): string {
  return q.listening_unit_id || q.id;
}

/** Parse 問題 number from question/section id (e.g. jlpt-n2-2025-12-m3-q1 → 3). */
function mondaiNumberFromId(id?: string): number | null {
  if (!id) return null;
  const m = id.match(/-m(\d+)(?:-|$)/i) || id.match(/mondai[_-]?(\d+)/i);
  return m ? Number(m[1]) : null;
}

/**
 * N2 listening display: prefer package flags, fall back to 問題 number.
 * See docs/jlpt-n2-listening-ui-rules.md
 */
function resolveListeningUi(
  q: PracticeQuestion,
  sectionId?: string,
): {
  mode: "text" | "image" | "numbers";
  hidePromptUntilSubmit: boolean;
} {
  const mNum =
    mondaiNumberFromId(q.id) ??
    mondaiNumberFromId(q.listening_unit_id) ??
    mondaiNumberFromId(sectionId);

  let mode: "text" | "image" | "numbers" =
    q.choice_display_mode === "image" ||
    q.choice_display_mode === "numbers" ||
    q.choice_display_mode === "text"
      ? q.choice_display_mode
      : "text";

  let hidePromptUntilSubmit = q.prompt_visibility === "after_submit";

  // JLPT N2 問題1–5: always hide stem until answer submit
  if (mNum != null && mNum >= 1 && mNum <= 5) {
    hidePromptUntilSubmit = true;
    // 問題3–5: number-only chips (do not override true image mode e.g. 問題1図)
    if (mNum >= 3 && mode !== "image") {
      mode = "numbers";
    }
  }

  return { mode, hidePromptUntilSubmit };
}

function flattenUnits(
  practice: PracticePackage,
  sectionId?: string,
): ListeningUnit[] {
  const flat: FlatQ[] = [];
  for (const s of practice.sections) {
    if (sectionId && s.id !== sectionId) continue;
    for (const q of s.questions) {
      if (q.type === "listening_multiple_choice" && q.choices?.length) {
        flat.push({ question: q, sectionTitle: s.title });
      }
    }
  }

  const order: string[] = [];
  const map = new Map<string, ListeningUnit>();
  for (const item of flat) {
    const id = unitKey(item.question);
    if (!map.has(id)) {
      order.push(id);
      map.set(id, {
        unitId: id,
        sectionTitle: item.sectionTitle,
        parts: [],
      });
    }
    map.get(id)!.parts.push(item);
  }
  return order.map((id) => map.get(id)!);
}

type Props = {
  lessonId: string;
  practice: PracticePackage;
  sectionId?: string;
  initialQuestionId?: string;
};

export function ListeningWorkspace({
  lessonId,
  practice,
  sectionId,
  initialQuestionId,
}: Props) {
  const { t } = useUiLanguage();
  const units = useMemo(
    () => flattenUnits(practice, sectionId),
    [practice, sectionId],
  );
  const startIdx = Math.max(
    0,
    units.findIndex((u) =>
      u.parts.some(
        (p) =>
          p.question.id === initialQuestionId ||
          unitKey(p.question) === initialQuestionId,
      ),
    ),
  );
  const [index, setIndex] = useState(startIdx === -1 ? 0 : startIdx);
  /** part question id → choice id */
  const [selectedByPart, setSelectedByPart] = useState<Record<string, string>>(
    {},
  );
  const [resultsByPart, setResultsByPart] = useState<
    Record<string, ListeningEvalResult>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replayCount, setReplayCount] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const audio = useAudioEngine();
  const { explanationLang, translationLang, setExplanationLang, setTranslationLang } =
    useContentLanguage();

  const current = units[index];
  const primary = current?.parts[0]?.question;

  useEffect(() => {
    void audio.load(practice.audio_url).catch(() => {
      /* ignore */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practice.audio_url]);

  useEffect(() => {
    setSelectedByPart({});
    setResultsByPart({});
    setError(null);
    setReplayCount(0);
    setShowTranscript(false);
    if (!primary) return;
    void audio
      .playSegment({
        startMs: primary.audio.start_ms,
        endMs: primary.audio.end_ms,
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, current?.unitId]);

  const allSelected =
    !!current &&
    current.parts.every((p) => selectedByPart[p.question.id]);

  const submitted = Boolean(
    current &&
      current.parts.length > 0 &&
      current.parts.every((p) => resultsByPart[p.question.id]),
  );

  const onSubmit = useCallback(async () => {
    if (!current || !allSelected) return;
    setSubmitting(true);
    setError(null);
    try {
      const next: Record<string, ListeningEvalResult> = {};
      for (const part of current.parts) {
        const choiceId = selectedByPart[part.question.id];
        if (!choiceId) continue;
        const { result: r } = await evaluateListening({
          lesson_id: lessonId,
          question_id: part.question.id,
          answer: { choice_id: choiceId },
          behavior: { replay_count: replayCount },
        });
        next[part.question.id] = r;
      }
      setResultsByPart(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }, [allSelected, current, lessonId, replayCount, selectedByPart]);

  const playEvidence = async (r: ListeningEvalResult) => {
    const evidence = r.evidence_segments?.[0];
    if (!evidence || evidence.start_ms == null || evidence.end_ms == null)
      return;
    await audio.playSegment({
      startMs: evidence.start_ms,
      endMs: evidence.end_ms,
    });
  };

  if (!units.length) {
    return (
      <p style={{ color: "var(--text-muted)", textAlign: "center" }}>
        Không có câu listening multiple-choice trong phạm vi này.
      </p>
    );
  }
  if (!current || !primary) return null;

  const allCorrect =
    submitted &&
    current.parts.every((p) => resultsByPart[p.question.id]?.correct);

  return (
    <div className="practice-workspace">
      <header className="listening-header">
        <span className="listening-header__meta">
          {getLocalizedText(current.sectionTitle, "vi")} · Q{index + 1}/
          {units.length}
          {current.parts.length > 1
            ? ` · ${current.parts.length} phần`
            : ""}
        </span>
        <div className="listening-header__langs">
          <span>
            Explain:{" "}
            <select
              value={explanationLang}
              onChange={(e) => setExplanationLang(e.target.value as "vi" | "en")}
            >
              <option value="vi">VI</option>
              <option value="en">EN</option>
            </select>
          </span>
          <span>
            Translate:{" "}
            <select
              value={translationLang}
              onChange={(e) => setTranslationLang(e.target.value as "vi" | "en")}
            >
              <option value="vi">VI</option>
              <option value="en">EN</option>
            </select>
          </span>
        </div>
      </header>

      <AudioPlayerBar audio={audio} />

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {current.parts.map((part, pi) => {
          const q = part.question;
          const { mode, hidePromptUntilSubmit } = resolveListeningUi(
            q,
            sectionId,
          );
          const choices = q.choices ?? [];
          const hidePrompt = hidePromptUntilSubmit && !submitted;
          const selected = selectedByPart[q.id] ?? null;
          const result = resultsByPart[q.id];
          const reveal = result
            ? {
                correctId: result.correct_choice_id,
                selectedId: result.selected_choice_id,
              }
            : undefined;

          return (
            <section key={q.id}>
              {current.parts.length > 1 && (
                <div
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    marginBottom: 8,
                  }}
                >
                  ({pi + 1}/{current.parts.length})
                </div>
              )}

              {(submitted || !hidePrompt) && q.prompt && getLocalizedText(q.prompt, "ja") !== "—" ? (
                <h2
                  className="practice-title"
                  style={{ marginBottom: "0.85rem", lineHeight: 1.6 }}
                >
                  {getLocalizedText(q.prompt, "ja")}
                </h2>
              ) : null}

              {/* After submit: full list JA + translation. Before: exam UI. */}
              {submitted && mode !== "image" && result ? (
                <ChoiceRevealList
                  choices={result.choices}
                  selectedId={result.selected_choice_id}
                  correctId={result.correct_choice_id}
                  translationLang={translationLang}
                />
              ) : mode === "image" ? (
                <ImageChoiceGrid
                  choices={choices}
                  selectedId={selected}
                  onSelect={(id) =>
                    setSelectedByPart((s) => ({ ...s, [q.id]: id }))
                  }
                  disabled={submitted}
                  reveal={reveal}
                />
              ) : mode === "numbers" ? (
                <NumberChoiceList
                  choices={choices}
                  selectedId={selected}
                  onSelect={(id) =>
                    setSelectedByPart((s) => ({ ...s, [q.id]: id }))
                  }
                  disabled={submitted}
                  reveal={reveal}
                />
              ) : (
                <TextChoiceList
                  choices={choices}
                  selectedId={selected}
                  onSelect={(id) =>
                    setSelectedByPart((s) => ({ ...s, [q.id]: id }))
                  }
                  disabled={submitted}
                  reveal={reveal}
                />
              )}
            </section>
          );
        })}
      </div>

      <div className="listening-actions">
        {!submitted && (
          <button
            type="button"
            className="btn-base btn-primary"
            style={{ padding: "0.7rem 1.5rem", fontSize: "1rem" }}
            disabled={!allSelected || submitting}
            onClick={() => void onSubmit()}
          >
            {submitting ? "…" : t("listening.submit")}
          </button>
        )}
        <button
          type="button"
          className="btn-base"
          disabled={index === 0}
          onClick={() => setIndex((i) => i - 1)}
        >
          ← {t("dictation.prev")}
        </button>
        <button
          type="button"
          className="btn-base"
          disabled={index >= units.length - 1}
          onClick={() => setIndex((i) => i + 1)}
        >
          {t("dictation.next")} →
        </button>
      </div>

      {error && (
        <div
          className="card-glass"
          style={{
            color: "#ef4444",
            borderColor: "#f87171",
            padding: "1rem",
            textAlign: "center",
            marginTop: "1rem",
          }}
        >
          {error}
        </div>
      )}

      {submitted && (
        <div
          className="card-glass"
          style={{
            marginTop: "1.75rem",
            padding: "1.5rem",
            borderLeft: allCorrect
              ? "4px solid #22c55e"
              : "4px solid #ef4444",
          }}
        >
          <p
            style={{
              fontWeight: 700,
              fontSize: "1.1rem",
              margin: "0 0 0.75rem",
              color: allCorrect ? "#22c55e" : "#ef4444",
            }}
          >
            {allCorrect
              ? "✓ " + t("dictation.correct")
              : "× " + t("dictation.incorrect")}
          </p>

          {current.parts.map((part) => {
            const r = resultsByPart[part.question.id];
            if (!r) return null;
            const correctChoice = r.choices.find((c) => c.correct);
            const correctJa = correctChoice
              ? getLocalizedText(correctChoice.text, "ja")
              : "";
            const correctTr = correctChoice
              ? getLocalizedText(correctChoice.text, translationLang)
              : "";
            return (
              <div
                key={part.question.id}
                style={{
                  marginBottom: "1rem",
                  paddingBottom: "1rem",
                  borderBottom: "1px solid var(--border-color)",
                }}
              >
                {part.question.prompt &&
                getLocalizedText(part.question.prompt, "ja") !== "—" ? (
                  <p style={{ fontWeight: 600, margin: "0 0 0.35rem" }}>
                    {getLocalizedText(part.question.prompt, "ja")}
                  </p>
                ) : null}
                <p
                  style={{
                    margin: "0 0 0.5rem",
                    color: r.correct ? "#22c55e" : "#ef4444",
                    fontWeight: 600,
                  }}
                >
                  {r.correct
                    ? "✓ " + t("dictation.correct")
                    : "× " + t("dictation.incorrect")}{" "}
                  (chọn {r.selected_choice_id}
                  {r.correct_choice_id
                    ? ` · đúng ${r.correct_choice_id}`
                    : ""}
                  )
                </p>
                {correctChoice && (
                  <div style={{ margin: "0.35rem 0 0.75rem", fontSize: "1.05rem" }}>
                    <strong>{t("dictation.expectedAnswer")}:</strong>{" "}
                    <span>
                      {r.correct_choice_id}
                      {correctJa && !/^\d+$/.test(correctJa.trim())
                        ? ` · ${correctJa}`
                        : ""}
                    </span>
                    {correctTr &&
                    correctTr !== correctJa &&
                    correctTr !== "—" ? (
                      <div
                        style={{
                          marginTop: 4,
                          color: "var(--text-muted)",
                          fontSize: "0.95rem",
                        }}
                      >
                        {correctTr}
                      </div>
                    ) : null}
                  </div>
                )}
                {r.evidence_segments.length > 0 && (
                  <div
                    style={{
                      margin: "0.75rem 0",
                      padding: "0.85rem",
                      borderRadius: "10px",
                      background: "var(--primary-light)",
                    }}
                  >
                    <button
                      type="button"
                      className="btn-base btn-primary"
                      style={{ fontSize: "0.85rem", marginBottom: 8 }}
                      onClick={() => void playEvidence(r)}
                    >
                      ▶ {t("listening.evidence")}
                    </button>
                    <p style={{ fontSize: "1rem", margin: 0 }}>
                      「{getLocalizedText(r.evidence_segments[0]!.text, "ja")}」
                    </p>
                  </div>
                )}
                <ExplanationPanel
                  text={correctChoice?.explanation}
                  lang={explanationLang}
                />
              </div>
            );
          })}

          <button
            type="button"
            className="btn-base"
            style={{ marginTop: 4 }}
            onClick={() => setShowTranscript((v) => !v)}
          >
            {showTranscript ? "Ẩn" : "Hiện"} Transcript / Translation
          </button>

          {showTranscript && (
            <>
              <TranscriptPanel
                segments={
                  resultsByPart[primary.id]?.segments ?? primary.segments
                }
                speakers={practice.speakers}
              />
              <TranslationPanel
                dialogue={primary.dialogue_translation}
                segments={
                  resultsByPart[primary.id]?.segments ?? primary.segments
                }
                lang={translationLang}
              />
            </>
          )}
        </div>
      )}

      <div className="segment-pill-grid" style={{ marginTop: "2rem" }}>
        {units.map((u, i) => (
          <button
            key={u.unitId}
            type="button"
            onClick={() => setIndex(i)}
            className={`pagination-pill ${i === index ? "active" : ""}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
