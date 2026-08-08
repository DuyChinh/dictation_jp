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
import {
  ExplanationPanel,
  TranscriptPanel,
  TranslationPanel,
} from "./ResultPanels";

type FlatQ = {
  question: PracticeQuestion;
  sectionTitle: { ja?: string; vi?: string; en?: string };
};

function flatten(practice: PracticePackage, sectionId?: string): FlatQ[] {
  const out: FlatQ[] = [];
  for (const s of practice.sections) {
    if (sectionId && s.id !== sectionId) continue;
    for (const q of s.questions) {
      if (q.type === "listening_multiple_choice" && q.choices?.length) {
        out.push({ question: q, sectionTitle: s.title });
      }
    }
  }
  return out;
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
  const items = useMemo(
    () => flatten(practice, sectionId),
    [practice, sectionId],
  );
  const startIdx = Math.max(
    0,
    items.findIndex((x) => x.question.id === initialQuestionId),
  );
  const [index, setIndex] = useState(startIdx === -1 ? 0 : startIdx);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<ListeningEvalResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replayCount, setReplayCount] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const audio = useAudioEngine();
  const { explanationLang, translationLang, setExplanationLang, setTranslationLang } =
    useContentLanguage();

  const current = items[index];

  useEffect(() => {
    void audio.load(practice.audio_url).catch(() => {
      /* ignore */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practice.audio_url]);

  useEffect(() => {
    setSelected(null);
    setResult(null);
    setError(null);
    setReplayCount(0);
    setShowTranscript(false);
    if (!current) return;
    void audio
      .playSegment({
        startMs: current.question.audio.start_ms,
        endMs: current.question.audio.end_ms,
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, current?.question.id]);

  const onSubmit = useCallback(async () => {
    if (!current || !selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const { result: r } = await evaluateListening({
        lesson_id: lessonId,
        question_id: current.question.id,
        answer: { choice_id: selected },
        behavior: { replay_count: replayCount },
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }, [current, lessonId, replayCount, selected]);

  const playEvidence = async () => {
    const evidence = result?.evidence_segments?.[0];
    if (!evidence || evidence.start_ms == null || evidence.end_ms == null)
      return;
    await audio.playSegment({
      startMs: evidence.start_ms,
      endMs: evidence.end_ms,
    });
  };

  if (!items.length) {
    return (
      <p style={{ color: "var(--text-muted)", textAlign: "center" }}>
        Không có câu listening multiple-choice trong phạm vi này.
      </p>
    );
  }
  if (!current) return null;

  const mode = current.question.choice_display_mode ?? "text";
  const choices = current.question.choices ?? [];
  const submitted = Boolean(result);
  const correctChoice = result?.choices.find((c) => c.correct);

  return (
    <div style={{ maxWidth: 840, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: "1.25rem",
          fontSize: "0.9rem",
          color: "var(--text-muted)",
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--primary-color)" }}>
          {getLocalizedText(current.sectionTitle, "vi")} · Q{index + 1}/
          {items.length}
        </span>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span>
            Explain:{" "}
            <select
              value={explanationLang}
              onChange={(e) => setExplanationLang(e.target.value as "vi" | "en")}
              style={{ background: "var(--card-bg)", color: "var(--text-main)", border: "1px solid var(--border-color)", borderRadius: 6, padding: "2px 6px" }}
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
              style={{ background: "var(--card-bg)", color: "var(--text-main)", border: "1px solid var(--border-color)", borderRadius: 6, padding: "2px 6px" }}
            >
              <option value="vi">VI</option>
              <option value="en">EN</option>
            </select>
          </span>
        </div>
      </header>

      {/* Audio Player Bar */}
      <AudioPlayerBar audio={audio} />

      <h2
        style={{
          fontSize: "1.25rem",
          fontWeight: 700,
          margin: "0 0 1.25rem",
          lineHeight: 1.6,
          color: "var(--text-main)",
        }}
      >
        {getLocalizedText(current.question.prompt, "ja")}
      </h2>

      {mode === "image" ? (
        <ImageChoiceGrid
          choices={choices}
          selectedId={selected}
          onSelect={setSelected}
          disabled={submitted}
          reveal={
            result
              ? {
                  correctId: result.correct_choice_id,
                  selectedId: result.selected_choice_id,
                }
              : undefined
          }
        />
      ) : (
        <TextChoiceList
          choices={choices}
          selectedId={selected}
          onSelect={setSelected}
          disabled={submitted}
          reveal={
            result
              ? {
                  correctId: result.correct_choice_id,
                  selectedId: result.selected_choice_id,
                }
              : undefined
          }
        />
      )}

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: "1.5rem",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {!submitted && (
          <button
            type="button"
            className="btn-base btn-primary"
            style={{ padding: "0.7rem 1.5rem", fontSize: "1rem" }}
            disabled={!selected || submitting}
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
          disabled={index >= items.length - 1}
          onClick={() => setIndex((i) => i + 1)}
        >
          {t("dictation.next")} →
        </button>
      </div>

      {error && (
        <div className="card-glass" style={{ color: "#ef4444", borderColor: "#f87171", padding: "1rem", textAlign: "center", marginTop: "1rem" }}>
          {error}
        </div>
      )}

      {/* Result Panel */}
      {result && (
        <div
          className="card-glass"
          style={{
            marginTop: "1.75rem",
            padding: "1.5rem",
            borderLeft: result.correct ? "4px solid #22c55e" : "4px solid #ef4444",
          }}
        >
          <p style={{ fontWeight: 700, fontSize: "1.1rem", margin: "0 0 0.5rem", color: result.correct ? "#22c55e" : "#ef4444" }}>
            {result.correct ? "✓ " + t("dictation.correct") : "× " + t("dictation.incorrect")}
          </p>
          {correctChoice && (
            <p style={{ margin: "0.5rem 0", fontSize: "1.05rem" }}>
              <strong>{t("dictation.expectedAnswer")}:</strong>{" "}
              {getLocalizedText(correctChoice.text, "ja")}
            </p>
          )}

          {result.evidence_segments.length > 0 && (
            <div style={{ margin: "1rem 0", padding: "1rem", borderRadius: "10px", background: "var(--primary-light)" }}>
              <button type="button" className="btn-base btn-primary" style={{ fontSize: "0.85rem", marginBottom: 8 }} onClick={() => void playEvidence()}>
                ▶ {t("listening.evidence")}
              </button>
              <p style={{ fontSize: "1rem", color: "var(--text-main)", margin: 0 }}>
                「{getLocalizedText(result.evidence_segments[0]!.text, "ja")}」
              </p>
            </div>
          )}

          <ExplanationPanel
            text={correctChoice?.explanation}
            lang={explanationLang}
          />

          <button
            type="button"
            className="btn-base"
            style={{ marginTop: 12 }}
            onClick={() => setShowTranscript((v) => !v)}
          >
            {showTranscript ? "Ẩn" : "Hiện"} Transcript / Translation
          </button>

          {showTranscript && (
            <>
              <TranscriptPanel
                segments={result.segments}
                speakers={practice.speakers}
              />
              <TranslationPanel
                dialogue={current.question.dialogue_translation}
                segments={result.segments}
                lang={translationLang}
              />
            </>
          )}
        </div>
      )}

      {/* Pagination Pills */}
      <div style={{ marginTop: "2rem", display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
        {items.map((it, i) => (
          <button
            key={it.question.id}
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
