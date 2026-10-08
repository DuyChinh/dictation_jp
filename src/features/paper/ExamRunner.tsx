import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { submitPaperExam, type PaperItem, type PaperPassage, type PaperPractice } from "../../shared/api/paper";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import {
  clearExamAnswer,
  finishExam,
  formatClock,
  setExamAnswer,
  toggleExamFlag,
  type ExamSession,
} from "../../shared/storage/paperExamStore";
import { saveAnswer } from "../../shared/storage/paperProgressStore";
import { Icon } from "../../shared/ui/Icon";
import { PassageView } from "./PassageView";
import { mondaiLabel, scopeTitle, splitTarget } from "./paperLabels";

type Props = {
  lessonId: string;
  paper: PaperPractice;
  session: ExamSession;
  onChange: (session: ExamSession) => void;
};

const WARN_MS = 5 * 60_000;
const DANGER_MS = 60_000;

/** The exam room: a clock, the question palette, one question at a time, and no feedback until submit. */
export function ExamRunner({ lessonId, paper, session, onChange }: Props) {
  const { t, uiLang } = useUiLanguage();
  const items = useMemo(
    () => paper.items.filter((i) => session.scope === "all" || i.part === session.scope).sort((a, b) => a.no - b.no),
    [paper, session.scope],
  );
  const [currentId, setCurrentId] = useState(items[0]?.id ?? "");
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittedOnce = useRef(false);

  const remaining = session.endsAt - now;
  const answeredCount = items.filter((i) => session.answers[i.id]).length;
  const flaggedCount = items.filter((i) => session.flagged[i.id]).length;
  const item = items.find((i) => i.id === currentId) ?? items[0];
  const index = item ? items.indexOf(item) : -1;
  const passage: PaperPassage | undefined = item?.passage_id
    ? paper.passages.find((p) => p.id === item.passage_id)
    : undefined;

  const submit = useCallback(async () => {
    if (submittedOnce.current) return;
    submittedOnce.current = true;
    setSubmitting(true);
    setConfirming(false);
    setError(null);
    try {
      const { result } = await submitPaperExam({
        lesson_id: lessonId,
        scope: session.scope,
        answers: Object.entries(session.answers).map(([item_id, choice_id]) => ({ item_id, choice_id })),
      });
      // What was answered counts as progress in the normal practice screens too.
      for (const r of result.items) {
        if (r.selected) saveAnswer(lessonId, r.item_id, { choiceId: r.selected, correct: r.correct, at: Date.now(), part: r.part });
      }
      const done = finishExam(lessonId, result);
      if (done) onChange(done);
    } catch (e) {
      submittedOnce.current = false;
      setError(e instanceof Error ? e.message : t("exam.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  }, [lessonId, onChange, session.answers, session.scope, t]);

  // The clock: derived from the stored deadline, so a reload keeps it honest.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    // After a failed attempt the learner retries by hand, so a dead connection is not hammered every tick.
    if (remaining <= 0 && !submittedOnce.current && !submitting && !error) {
      setTimeUp(true);
      void submit();
    }
  }, [remaining, submit, submitting, error]);

  function pick(it: PaperItem, choiceId: string) {
    const next = setExamAnswer(lessonId, it.id, choiceId);
    if (next) onChange(next);
  }
  function clearPick(it: PaperItem) {
    const next = clearExamAnswer(lessonId, it.id);
    if (next) onChange(next);
  }
  function flag(it: PaperItem) {
    const next = toggleExamFlag(lessonId, it.id);
    if (next) onChange(next);
  }
  function go(id: string | undefined) {
    if (id) {
      setCurrentId(id);
      window.scrollTo({ top: 0 });
    }
  }

  if (!item) return null;

  const tone = remaining <= DANGER_MS ? " is-danger" : remaining <= WARN_MS ? " is-warn" : "";
  const stem = splitTarget(item.stem.ja, item.stem.target);
  const picked = session.answers[item.id];
  const groups = [...new Set(items.map((i) => i.mondai))];
  const announce = remaining <= DANGER_MS ? t("exam.warn1") : remaining <= WARN_MS ? t("exam.warn5") : "";

  const card = (
    <article className="paper-card exam-card" id={`q-${item.no}`}>
      <header className="paper-qhead">
        <span className="paper-qno">{item.no}</span>
        <button
          type="button"
          className={`exam-flag${session.flagged[item.id] ? " is-on" : ""}`}
          aria-pressed={!!session.flagged[item.id]}
          onClick={() => flag(item)}
        >
          <Icon name="pin" size={16} />
          {session.flagged[item.id] ? t("exam.flagged") : t("exam.flag")}
        </button>
      </header>
      <p className="paper-stem jp" lang="ja">
        {stem.map((p, i) => (p.mark ? <u key={i}>{p.text}</u> : <span key={i}>{p.text}</span>))}
      </p>
      <div className="paper-choices" role="radiogroup" aria-label={`${t("paper.question")} ${item.no}`}>
        {item.choices.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={picked === c.id}
            className={`paper-tile${picked === c.id ? " is-selected" : ""}`}
            onClick={() => pick(item, c.id)}
          >
            <span className="paper-tile__no">{c.id}</span>
            <span className="paper-tile__body">
              <span className="paper-tile__text jp" lang="ja">
                {c.text}
              </span>
            </span>
          </button>
        ))}
      </div>
      <footer className="paper-actions">
        <button type="button" className="paper-ghost" disabled={!picked} onClick={() => clearPick(item)}>
          {t("exam.clear")}
        </button>
        <div className="exam-nav">
          <button type="button" className="paper-outline" disabled={index === 0} onClick={() => go(items[index - 1]?.id)}>
            {t("exam.prev")}
          </button>
          <button type="button" className="paper-primary" disabled={index === items.length - 1} onClick={() => go(items[index + 1]?.id)}>
            {t("exam.next")}
          </button>
        </div>
      </footer>
    </article>
  );

  return (
    <div className="exam">
      <div className={`exam-bar${tone}`}>
        <div className="exam-clock" role="timer" aria-label={t("exam.timeLeft")}>
          <Icon name="clock" size={22} strokeWidth={2.2} />
          <strong>{formatClock(remaining)}</strong>
          <small>{t("exam.timeLeft").toLowerCase()}</small>
        </div>
        <span className="exam-bar__scope">{scopeTitle(session.scope, t)}</span>
        <div className="exam-bar__count">
          <strong>
            {answeredCount}/{items.length}
          </strong>{" "}
          {t("exam.answered")}
        </div>
        <button type="button" className="paper-primary" disabled={submitting} onClick={() => setConfirming(true)}>
          {t("exam.submit")}
        </button>
      </div>
      <div className="exam-sr" role="status" aria-live="polite">
        {announce}
      </div>

      {timeUp && (
        <div className="notice" role="status">
          <Icon name="clock" />
          {submitting ? t("exam.submitting") : t("exam.timeUp")}
        </div>
      )}

      {confirming && (
        <div
          className="exam-modal"
          onKeyDown={(e) => {
            if (e.key === "Escape") setConfirming(false);
          }}
        >
          <div className="exam-confirm" role="alertdialog" aria-modal="true" aria-labelledby="exam-confirm-title">
            <div className="exam-confirm__head">
              <h3 id="exam-confirm-title">{t("exam.confirmTitle")}</h3>
              <p>{t("exam.confirmWarn")}</p>
            </div>
            <ul>
              <li>
                <span>{t("exam.confirmLeft")}</span>
                <strong>{formatClock(remaining)}</strong>
              </li>
              {items.length - answeredCount > 0 && (
                <li className="is-warn">
                  <span>{t("exam.confirmBlankLabel")}</span>
                  <strong>
                    {items.length - answeredCount} {t("paper.questionsUnit")}
                  </strong>
                </li>
              )}
              {flaggedCount > 0 && (
                <li>
                  <span>{t("exam.confirmFlaggedLabel")}</span>
                  <strong>
                    {flaggedCount} {t("paper.questionsUnit")}
                  </strong>
                </li>
              )}
            </ul>
            <div className="exam-confirm__actions">
              <button type="button" className="paper-outline" autoFocus onClick={() => setConfirming(false)}>
                {t("exam.keepGoing")}
              </button>
              <button type="button" className="paper-primary" onClick={() => void submit()}>
                {t("exam.submitNow")}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="notice notice--error" role="alert">
          <Icon name="alert" />
          <span>{t("exam.submitFailed")}</span>
          <button type="button" className="paper-soft" style={{ marginLeft: "auto" }} onClick={() => void submit()}>
            {t("exam.retrySubmit")}
          </button>
        </div>
      )}

      <div className="exam-layout">
        <aside className="exam-palette" aria-label={t("exam.palette")}>
          {groups.map((m) => (
            <div key={m} className="exam-palette__group">
              <span className="exam-palette__label">
                <strong className="jp">問題{m}</strong> · {mondaiLabel(m, uiLang)}
              </span>
              <div className="exam-palette__dots">
                {items
                  .filter((i) => i.mondai === m)
                  .map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      className={`paper-dot${session.answers[i.id] ? " is-answered" : ""}${session.flagged[i.id] ? " is-flagged" : ""}${i.id === item.id ? " is-current" : ""}`}
                      aria-label={`${t("paper.question")} ${i.no}`}
                      aria-current={i.id === item.id ? "true" : undefined}
                      onClick={() => go(i.id)}
                    >
                      {i.no}
                    </button>
                  ))}
              </div>
            </div>
          ))}
          <ul className="exam-palette__legend">
            <li>
              <i className="is-answered" aria-hidden="true" />
              {t("exam.legend.answered")}
            </li>
            <li>
              <i className="is-flagged" aria-hidden="true" />
              {t("exam.legend.flagged")}
            </li>
            <li>
              <i aria-hidden="true" />
              {t("exam.legend.blank")}
            </li>
          </ul>
        </aside>
        <div className="exam-main">
          {passage ? (
            <div className="paper-split">
              <div className="paper-split__passage">
                <PassageView
                  passage={passage}
                  evidenceIds={new Set()}
                  translation={null}
                  showTranslation={false}
                  busy={false}
                  error={null}
                  drillReady
                  drilling={false}
                  onToggleTranslation={() => undefined}
                  onOpenDrill={() => undefined}
                  plain
                />
              </div>
              <div className="paper-split__side">{card}</div>
            </div>
          ) : (
            card
          )}
        </div>
      </div>
    </div>
  );
}
