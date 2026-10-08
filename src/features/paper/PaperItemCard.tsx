import { useEffect, useRef, useState } from "react";
import {
  evaluatePaperItem,
  type PaperItem,
  type PaperItemResult,
} from "../../shared/api/paper";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import type { PaperAnswer } from "../../shared/storage/paperProgressStore";
import { Icon } from "../../shared/ui/Icon";
import { splitTarget } from "./paperLabels";

type Props = {
  lessonId: string;
  item: PaperItem;
  /** The saved answer from an earlier visit; the explanations are fetched again for it. */
  saved?: PaperAnswer;
  onAnswered: (item: PaperItem, result: PaperItemResult) => void;
};

/** One multiple-choice question of the written part: pick, check, then read why for all four. */
export function PaperItemCard({ lessonId, item, saved, onAnswered }: Props) {
  const { t } = useUiLanguage();
  const [selected, setSelected] = useState<string | null>(saved?.choiceId ?? null);
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

  // Reopening an answered question shows its explanations again without counting it twice.
  useEffect(() => {
    if (!saved || restored.current) return;
    restored.current = true;
    void check(saved.choiceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stem = splitTarget(item.stem.ja, item.stem.target);
  const answered = result !== null;
  const reveal = (id: string) => result?.choices.find((c) => c.id === id);

  return (
    <article className={`paper-item${answered ? (result.correct ? " is-right" : " is-wrong") : ""}`} id={`q-${item.no}`}>
      <header className="paper-item__head">
        <span className="paper-item__no">{item.no}</span>
        <p className="paper-item__stem jp" lang="ja">
          {stem.map((p, i) => (p.mark ? <u key={i}>{p.text}</u> : <span key={i}>{p.text}</span>))}
        </p>
      </header>

      <div className="choice-grid paper-choices" role="radiogroup" aria-label={`${t("paper.question")} ${item.no}`}>
        {item.choices.map((c) => {
          const r = reveal(c.id);
          const isCorrect = !!r?.correct;
          const isWrongPick = answered && c.id === result.selected_choice_id && !isCorrect;
          const state = isCorrect
            ? " is-correct"
            : isWrongPick
              ? " is-wrong"
              : answered
                ? " is-dim"
                : selected === c.id
                  ? " is-selected"
                  : "";
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={answered ? c.id === result.selected_choice_id : selected === c.id}
              aria-disabled={answered || busy ? true : undefined}
              className={`choice-card paper-choice${state}`}
              onClick={() => {
                if (!answered && !busy) setSelected(c.id);
              }}
            >
              <span className="choice-card__no">{c.id}</span>
              <span className="choice-card__body">
                {isCorrect && (
                  <span className="choice-tag choice-tag--ok">
                    <Icon name="check" size={13} strokeWidth={3} />
                    {t("paper.tagAnswer")}
                  </span>
                )}
                {isWrongPick && (
                  <span className="choice-tag choice-tag--bad">
                    <Icon name="close" size={13} strokeWidth={3} />
                    {t("paper.tagYours")}
                  </span>
                )}
                <span className="choice-card__ja jp">{c.text}</span>
                {r?.meaning_vi && <span className="paper-choice__meaning">{r.meaning_vi}</span>}
                {r && <span className="choice-card__tr paper-choice__why">{r.explanation_vi}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {!answered && (
        <div className="paper-item__actions">
          <button type="button" className="btn btn--primary" disabled={!selected || busy} onClick={() => selected && void check(selected)}>
            {busy ? t("paper.checking") : t("paper.check")}
          </button>
        </div>
      )}
      {error && (
        <div className="notice notice--error" role="alert">
          <Icon name="alert" />
          {error}
        </div>
      )}

      {answered && (
        <div className="paper-result">
          <p className={`paper-result__verdict${result.correct ? " is-ok" : " is-bad"}`}>
            <Icon name={result.correct ? "check" : "close"} size={16} strokeWidth={3} />
            {result.correct ? t("paper.correct") : t("paper.wrong")}
          </p>
          {result.summary_vi && <p className="paper-result__summary">{result.summary_vi}</p>}
          {result.stem_vi && (
            <p className="paper-result__tr">
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
            <div className="paper-vocab">
              <strong>{t("paper.vocab")}</strong>
              <ul>
                {result.vocab.map((v) => (
                  <li key={v.word}>
                    <span className="jp">{v.word}</span>
                    {v.reading && <span className="paper-vocab__read jp">{v.reading}</span>}
                    <span className="paper-vocab__mean">{v.meaning_vi}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
