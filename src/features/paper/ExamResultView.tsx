import { Link } from "react-router-dom";
import type { ExamItemResult } from "../../shared/api/paper";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { partLabel, partType } from "../../shared/content/lessonLabels";
import { formatClock, type ExamSession } from "../../shared/storage/paperExamStore";
import { mondaiLabel, scopeTitle } from "./paperLabels";

type Props = {
  lessonId: string;
  session: ExamSession;
  /** Listening sittings: the lesson source, to name each part (問題) of the audio. */
  source?: Record<string, unknown>;
  /** Opening an earlier sitting from the history: its start time, so each question opens in that sitting's review. */
  sittingAt?: number;
  onRetake: () => void;
};

const pctOf = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
const state = (i: ExamItemResult) => (i.selected === null ? "blank" : i.correct ? "right" : "wrong");

/** The result of a submitted sitting: the score, where it was lost, and every miss linked to its answer. */
export function ExamResultView({ lessonId, session, source, sittingAt, onRetake }: Props) {
  const { t, uiLang } = useUiLanguage();
  const result = session.result;
  if (!result) return null;

  const base = `/lessons/${encodeURIComponent(lessonId)}/paper`;
  const reviewHref = (no?: number) => {
    const query = new URLSearchParams();
    if (sittingAt) query.set("at", String(sittingAt));
    if (no) query.set("q", String(no));
    return `${base}/exam/review${query.size ? `?${query}` : ""}`;
  };
  /** A missed listening question opens in the listening practice, where its explanation is shown. */
  const itemHref = (i?: ExamItemResult) =>
    i?.part === "listening"
      ? `/lessons/${encodeURIComponent(lessonId)}/listening?section=${encodeURIComponent(i.section_id ?? "")}&question=${encodeURIComponent(i.item_id)}`
      : i || result.scope !== "listening"
        ? reviewHref(i?.no)
        : `/lessons/${encodeURIComponent(lessonId)}/listening`;
  const mondaiName = (m: number) =>
    result.scope === "listening" ? partLabel(partType(source, m), uiLang) : mondaiLabel(m, uiLang);
  const limit = session.minutes * 60_000;
  const used = Math.min((session.submittedAt ?? session.endsAt) - session.startedAt, limit);
  const total = result.total;
  const right = result.items.filter((i) => state(i) === "right").length;
  const wrong = result.items.filter((i) => state(i) === "wrong").length;
  const blank = result.items.filter((i) => state(i) === "blank").length;
  const review = result.items.filter((i) => state(i) !== "right");

  const mondai = [...new Set(result.items.map((i) => i.mondai))]
    .sort((a, b) => a - b)
    .map((m) => {
      const list = result.items.filter((i) => i.mondai === m);
      return { m, list, right: list.filter((i) => state(i) === "right").length };
    });

  return (
    <div className="exam-result">
      <nav className="exam-crumbs" aria-label="breadcrumb">
        <Link to={base}>{t("paper.sectionTitle")}</Link>
        <span aria-hidden="true">›</span>
        <span>{t("exam.title")}</span>
        <span aria-hidden="true">›</span>
        <strong>{t("exam.review.back")}</strong>
      </nav>

      <section className="exam-result__hero">
        <div className="exam-result__score">
          <span className="exam-eyebrow">
            {t("exam.result.eyebrow")} · {scopeTitle(result.scope, t)}
          </span>
          <div className="exam-result__big">
            <strong>
              {right}
              <small>/{total}</small>
            </strong>
            <span>
              {t("exam.correctOf")} · <b>{pctOf(right, total)}%</b>
            </span>
          </div>
          <div
            className="exam-meter"
            role="img"
            aria-label={`${t("exam.right")} ${right}, ${t("exam.wrong")} ${wrong}, ${t("exam.blankLabel")} ${blank}`}
          >
            <span className="is-right" style={{ width: `${(right / Math.max(total, 1)) * 100}%` }} />
            <span className="is-wrong" style={{ width: `${(wrong / Math.max(total, 1)) * 100}%` }} />
          </div>
          <ul className="exam-meter__legend">
            <li>
              <i className="is-right" aria-hidden="true" />
              {t("exam.right")} <strong>{right}</strong>
            </li>
            <li>
              <i className="is-wrong" aria-hidden="true" />
              {t("exam.wrong")} <strong>{wrong}</strong>
            </li>
            <li>
              <i aria-hidden="true" />
              {t("exam.blankLabel")} <strong>{blank}</strong>
            </li>
          </ul>
          <p className="exam-result__note">{t("exam.note")}</p>
        </div>

        <div className="exam-result__side">
          <div className="exam-time">
            <span>{t("exam.timeUsed")}</span>
            <strong>
              {formatClock(used)} <small>/ {formatClock(limit)}</small>
            </strong>
            <div className="paper-bar" role="presentation">
              <span style={{ width: `${pctOf(used, limit)}%` }} />
            </div>
          </div>
          <Link to={itemHref(review[0])} className="paper-primary paper-primary--lg">
            {t("exam.viewAnswers")}
            <span aria-hidden="true">→</span>
          </Link>
          <div className="exam-result__links">
            <button type="button" className="paper-outline" onClick={onRetake}>
              {t("exam.retake")}
            </button>
            <Link to={`/lessons/${encodeURIComponent(lessonId)}`} className="paper-ghost">
              {t("paper.backToLesson")}
            </Link>
          </div>
        </div>
      </section>

      <section className="exam-result__section">
        <h2>{t("exam.byType")}</h2>
        <div className="exam-types">
          {mondai.map((g) => (
            <article key={g.m} className="exam-type">
              <div className="exam-type__head">
                <div>
                  <strong className="jp">問題{g.m}</strong>
                  <span>{mondaiName(g.m)}</span>
                </div>
                <b>
                  {g.right}
                  <small>/{g.list.length}</small>
                </b>
              </div>
              <div className="exam-cells">
                {g.list.map((i) => (
                  <Link
                    key={i.item_id}
                    to={itemHref(i)}
                    className={`exam-cell is-${state(i)}`}
                    aria-label={`${t("paper.question")} ${i.no}: ${t(state(i) === "right" ? "exam.right" : state(i) === "wrong" ? "exam.wrong" : "exam.blankLabel")}`}
                  >
                    {i.no}
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="exam-result__section exam-result__review">
        <div className="exam-result__reviewhead">
          <h2>
            {t("exam.reviewTitle")} · {review.length}
          </h2>
          <span>{t("exam.reviewSub")}</span>
        </div>
        {review.length === 0 ? (
          <p className="exam-result__ok">{t("exam.allRight")}</p>
        ) : (
          <ul className="exam-review">
            {review.map((i) => (
              <li key={i.item_id}>
                <Link to={itemHref(i)} className={`exam-review__item is-${state(i)}`}>
                  <strong>{i.no}</strong>
                  <span>{state(i) === "blank" ? t("exam.blank") : t("exam.wrongTag")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
