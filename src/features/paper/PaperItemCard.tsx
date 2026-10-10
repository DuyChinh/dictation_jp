import { useEffect, useRef, useState } from "react";
import {
  evaluatePaperItem,
  type PaperItem,
  type PaperItemResult,
} from "../../shared/api/paper";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import type { TranslationKey } from "../../shared/i18n/translations";
import type { PaperAnswer } from "../../shared/storage/paperProgressStore";
import { Icon } from "../../shared/ui/Icon";
import { splitTarget } from "./paperLabels";

type Props = {
  lessonId: string;
  item: PaperItem;
  /** The saved answer from an earlier visit; the explanations are fetched again for it. */
  saved?: PaperAnswer;
  onAnswered: (item: PaperItem, result: PaperItemResult) => void;
  /** Forget this answer so the question can be tried again. */
  onRetry: (item: PaperItem) => void;
  /** Move on; label tells whether that is the next question or the next type of question. */
  onNext?: { label: TranslationKey; run: () => void };
  /**
   * Reviewing a finished exam: show the explanations straight away for what was picked (or for the
   * right answer when the question was left blank), with no checking or retrying.
   */
  review?: { selected: string | null; correctId: string | null };
};

/** One multiple-choice question: pick, check, then see why for all four choices. */
export function PaperItemCard({ lessonId, item, saved, onAnswered, onRetry, onNext, review }: Props) {
  const { t } = useUiLanguage();
  const reviewChoice = review ? (review.selected ?? review.correctId) : null;
  const [selected, setSelected] = useState<string | null>(reviewChoice ?? saved?.choiceId ?? null);
  const [result, setResult] = useState<PaperItemResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restored = useRef(false);
  const notify = useRef(onAnswered);
  notify.current = onAnswered;

  async function check(choiceId: string) {
    setBusy(true);
    setError(null);
    try {
      const { result: r } = await evaluatePaperItem({ lesson_id: lessonId, item_id: item.id, choice_id: choiceId });
      setResult(r);
      notify.current(item, r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  // Reopening an answered question shows its explanations again.
  useEffect(() => {
    const first = reviewChoice ?? saved?.choiceId;
    if (!first || restored.current) return;
    restored.current = true;
    void check(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function retry() {
    setResult(null);
    setSelected(null);
    setError(null);
    onRetry(item);
  }

  const stem = splitTarget(item.stem.ja, item.stem.target);
  const answered = result !== null;
  const reveal = (id: string) => result?.choices.find((c) => c.id === id);
  const summary = result?.summary_vi.trim();

  return (
    <article className={`paper-card${answered ? (result.correct ? " is-right" : " is-wrong") : ""}`} id={`q-${item.no}`}>
      <header className="paper-qhead">
        <span className="paper-qno">{item.no}</span>
        {!answered && !review && <span className="paper-qhint">{t("paper.hint")}</span>}
        {review && (
          <span className={`exam-pill is-${review.selected === null ? "blank" : review.selected === review.correctId ? "right" : "wrong"}`}>
            {review.selected === null
              ? t("exam.blankLabel")
              : review.selected === review.correctId
                ? t("paper.correct")
                : `${t("exam.pill.picked")} ${review.selected}, ${t("exam.pill.answerIs")} ${review.correctId ?? ""}`}
          </span>
        )}
      </header>
      <p className="paper-stem jp" lang="ja">
        {stem.map((p, i) => (p.mark ? <u key={i}>{p.text}</u> : <span key={i}>{p.text}</span>))}
      </p>

      <div className="paper-choices" role="radiogroup" aria-label={`${t("paper.question")} ${item.no}`}>
        {item.choices.map((c) => {
          const r = reveal(c.id);
          const isCorrect = !!r?.correct;
          const isWrongPick = answered && c.id === result.selected_choice_id && !isCorrect;
          const state = isCorrect
            ? " is-correct"
            : isWrongPick
              ? " is-wrong"
              : !answered && selected === c.id
                ? " is-selected"
                : "";
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={answered ? c.id === result.selected_choice_id : selected === c.id}
              aria-disabled={answered || busy ? true : undefined}
              className={`paper-tile${state}`}
              onClick={() => {
                if (!answered && !busy && !review) setSelected(c.id);
              }}
            >
              <span className="paper-tile__no">{c.id}</span>
              <span className="paper-tile__body">
                {isCorrect && <span className="paper-tag paper-tag--ok">{t("paper.tagAnswer")}</span>}
                {isWrongPick && <span className="paper-tag paper-tag--bad">{t("paper.tagYours")}</span>}
                <span className="paper-tile__text jp" lang="ja">
                  {c.text}
                </span>
                {r?.sino_vi && (
                  <span className="paper-sino">
                    {t("paper.sino")}: <b>{r.sino_vi}</b>
                  </span>
                )}
                {r?.meaning_vi && <span className="paper-tile__meaning">{r.meaning_vi}</span>}
                {r && <span className="paper-tile__why">{r.explanation_vi}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="notice notice--error" role="alert">
          <Icon name="alert" />
          {error}
        </div>
      )}

      {answered && (
        <div className="paper-result">
          {review && review.selected === null ? (
            <p className="paper-verdict is-blank">
              <span className="paper-verdict__icon">
                <Icon name="alert" size={16} strokeWidth={2.4} />
              </span>
              {t("exam.blankLabel")} · {t("exam.pill.answerIs")} {result.correct_choice_id ?? ""}
            </p>
          ) : (
            <p className={`paper-verdict${result.correct ? " is-ok" : " is-bad"}`}>
              <span className="paper-verdict__icon">
                <Icon name={result.correct ? "check" : "close"} size={16} strokeWidth={3} />
              </span>
              {result.correct ? t("paper.correct") : `${t("paper.wrongIs")} ${result.correct_choice_id ?? ""}`}
            </p>
          )}
          {summary && (
            <p className="paper-remember">
              <strong>{t("paper.remember")} · </strong>
              {summary}
            </p>
          )}
          {result.stem_vi && (
            <p className="paper-translation">
              <strong>{t("paper.translation")}:</strong> {result.stem_vi}
            </p>
          )}
          {result.sort && (
            <div className="paper-sort">
              <strong>{t("paper.order")}:</strong>
              <ol className="paper-sort__slots jp" lang="ja">
                {result.sort.slots.map((s, i) => (
                  <li key={i} className={i === result.sort!.star_index ? "is-star" : ""}>
                    {i === result.sort!.star_index && <span aria-hidden="true">★ </span>}
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {result.vocab.length > 0 && (
            <ul className="paper-words" aria-label={t("paper.vocab")}>
              {result.vocab.map((v) => (
                <li key={v.word}>
                  <strong className="jp">{v.word}</strong>
                  {v.reading && <span className="paper-words__read jp">{v.reading}</span>}
                  <span>{v.meaning_vi}</span>
                  {v.sino_vi && (
                    <span className="paper-sino">
                      {t("paper.sino")}: <b>{v.sino_vi}</b>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <footer className={`paper-actions${review ? " is-review" : ""}`}>
        {!review && (
          <button type="button" className="paper-ghost" onClick={retry} disabled={!answered && !selected}>
            {t("paper.redoQuestion")}
          </button>
        )}
        {answered ? (
          onNext && (
            <button type="button" className="paper-primary" onClick={onNext.run}>
              {t(onNext.label)}
              <span aria-hidden="true">→</span>
            </button>
          )
        ) : (
          !review && (
            <button type="button" className="paper-primary" disabled={!selected || busy} onClick={() => selected && void check(selected)}>
              {busy ? t("paper.checking") : t("paper.check")}
            </button>
          )
        )}
      </footer>
    </article>
  );
}
