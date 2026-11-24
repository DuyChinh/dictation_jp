import { Link } from "react-router-dom";
import type { ExamItemResult, JlptScore, ScaleScore } from "../../shared/api/paper";
import { fmt } from "../../shared/i18n/format";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import type { TranslationKey } from "../../shared/i18n/translations";
import { partLabel, partType } from "../../shared/content/lessonLabels";
import { formatClock, type ExamSession } from "../../shared/storage/paperExamStore";
import { mondaiLabel, mondaiNo, scopeTitle } from "./paperLabels";

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

const scaleKey = (id: ScaleScore["id"]) => `exam.scale.${id}` as TranslationKey;

/** The scaled score: per section out of 60 (120 for language + reading at N4/N5), the total out of 180 and pass or fail. */
function ScoreBoard({ score }: { score: JlptScore }) {
  const { t } = useUiLanguage();
  const anyPartial = score.scales.some((s) => s.partial);
  return (
    <section className="exam-result__section exam-score" aria-labelledby="exam-score-title">
      <div className="exam-score__head">
        <h2 id="exam-score-title">{t("exam.score.title")}</h2>
        {score.total !== null && (
          <span className={`exam-pass is-${score.passed ? "yes" : "no"}`}>
            {score.passed ? t("exam.score.passed") : t("exam.score.failed")}
          </span>
        )}
      </div>
      <div className="exam-scales">
        {score.scales.map((s) => {
          const below = !s.partial && s.score < s.min;
          return (
            <article key={s.id} className={`exam-scale${below ? " is-below" : ""}`}>
              <div className="exam-scale__head">
                <span>{t(scaleKey(s.id))}</span>
                {s.partial && <em className="exam-scale__tag">{t("exam.score.estimate")}</em>}
              </div>
              <b className="exam-scale__score">
                {s.score}
                <small>/{s.max}</small>
              </b>
              <div
                className="exam-scale__bar"
                role="img"
                aria-label={`${s.score}/${s.max}`}
              >
                <span style={{ width: `${(s.score / s.max) * 100}%` }} />
                <i style={{ left: `${(s.min / s.max) * 100}%` }} aria-hidden="true" />
              </div>
              <small className="exam-scale__meta">
                {s.correct}/{s.total} · {fmt(t(below ? "exam.score.belowMin" : "exam.score.min"), { m: s.min })}
              </small>
            </article>
          );
        })}
      </div>
      {score.total !== null ? (
        <p className="exam-score__rule">
          {fmt(t("exam.score.passMark"), { level: score.level, n: score.pass_total })} · {t("exam.score.minSection")}
        </p>
      ) : (
        <p className="exam-score__rule">{anyPartial ? t("exam.score.partialNote") : t("exam.score.writtenNote")}</p>
      )}
    </section>
  );
}

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

  const limit = session.minutes * 60_000;
  const used = Math.min((session.submittedAt ?? session.endsAt) - session.startedAt, limit);
  const total = result.total;
  const right = result.items.filter((i) => state(i) === "right").length;
  const wrong = result.items.filter((i) => state(i) === "wrong").length;
  const blank = result.items.filter((i) => state(i) === "blank").length;
  const review = result.items.filter((i) => state(i) !== "right");

  // The written parts and the listening part number their 問題 separately, so a full exam groups by both.
  const keyOf = (i: ExamItemResult) => `${i.part === "listening" ? "L" : "W"}${i.mondai}`;
  const mondai = [...new Set(result.items.map(keyOf))]
    .map((key) => {
      const list = result.items.filter((i) => keyOf(i) === key);
      const listening = list[0]!.part === "listening";
      const m = list[0]!.mondai;
      return {
        key,
        m,
        listening,
        name: listening ? partLabel(partType(source, m), uiLang) : mondaiLabel(m, uiLang, lessonId),
        no: listening ? m : mondaiNo(m, lessonId),
        list,
        right: list.filter((i) => state(i) === "right").length,
      };
    })
    .sort((a, b) => Number(a.listening) - Number(b.listening) || a.m - b.m);
  const score = result.score;
  const headline = score?.total != null;

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
            {headline && score ? (
              <>
                <strong>
                  {score.total}
                  <small>/{score.total_max}</small>
                </strong>
                <span>
                  {t("exam.score.total")} · <b>{score.passed ? t("exam.score.passed") : t("exam.score.failed")}</b>
                  {" · "}
                  {right}/{total} {t("exam.correctOf")} ({pctOf(right, total)}%)
                </span>
              </>
            ) : (
              <>
                <strong>
                  {right}
                  <small>/{total}</small>
                </strong>
                <span>
                  {t("exam.correctOf")} · <b>{pctOf(right, total)}%</b>
                </span>
              </>
            )}
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
          <p className="exam-result__note">{score ? t("exam.score.method") : t("exam.note")}</p>
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

      {score && <ScoreBoard score={score} />}

      <section className="exam-result__section">
        <h2>{t("exam.byType")}</h2>
        <div className="exam-types">
          {mondai.map((g) => (
            <article key={g.key} className="exam-type">
              <div className="exam-type__head">
                <div>
                  <strong className="jp">
                    {g.listening && result.scope === "full" ? "聴解 " : ""}問題{g.no}
                  </strong>
                  <span>{g.name}</span>
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
                  <strong>
                    {i.part === "listening" && result.scope === "full" ? "聴 " : ""}
                    {i.no}
                  </strong>
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
