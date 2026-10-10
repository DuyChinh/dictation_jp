import { Link } from "react-router-dom";
import type { LessonSummary } from "../../shared/api/content";
import { getLocalizedText } from "../../shared/content/getLocalizedText";
import { lessonShortTitle } from "../../shared/content/lessonLabels";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { sittingKey, type ExamHistoryEntry } from "../../shared/storage/paperExamStore";
import { scopeTitle } from "./paperLabels";

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

function dateLabel(ts: number, lang: string): string {
  return new Intl.DateTimeFormat(lang === "ja" ? "ja-JP" : lang === "en" ? "en-GB" : "vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(ts);
}

/** How a lesson is named in the exam lists: "JLPT N2 · 12/2025". */
export function useExamLabel(lessons: Map<string, LessonSummary>): (lessonId: string) => string {
  const { uiLang } = useUiLanguage();
  return (lessonId) => {
    const l = lessons.get(lessonId);
    return l ? lessonShortTitle(l.source, getLocalizedText(l.title, uiLang) || lessonId) : lessonId;
  };
}

/** Submitted sittings, newest first; a sitting whose detail is still stored can be opened again. */
export function ExamHistoryTable({
  rows,
  label,
  reviewable,
}: {
  rows: ExamHistoryEntry[];
  label: (lessonId: string) => string;
  reviewable: Set<string>;
}) {
  const { t, uiLang } = useUiLanguage();
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col">{t("exams.colWhen")}</th>
          <th scope="col">{t("exams.colExam")}</th>
          <th scope="col">{t("exams.colScope")}</th>
          <th scope="col">{t("exams.colScore")}</th>
          <th scope="col">{t("exams.colTime")}</th>
          <th scope="col">
            <span className="visually-hidden">{t("exams.review")}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((h) => (
          <tr key={sittingKey(h)}>
            <td className="num muted">{dateLabel(h.submittedAt, uiLang)}</td>
            <td>
              <Link to={`/lessons/${encodeURIComponent(h.lessonId)}`}>{label(h.lessonId)}</Link>
            </td>
            <td>{scopeTitle(h.scope, t)}</td>
            <td className="tabular">
              <strong>
                {h.correct}/{h.total}
              </strong>{" "}
              ({pct(h.correct, h.total)}%)
            </td>
            <td className="tabular">
              {Math.max(1, Math.round((h.submittedAt - h.startedAt) / 60000))}/{h.minutes} {t("exams.minutes")}
            </td>
            <td style={{ textAlign: "right" }}>
              {reviewable.has(sittingKey(h)) ? (
                <Link
                  to={`/lessons/${encodeURIComponent(h.lessonId)}/paper/exam/result?at=${h.startedAt}`}
                  className="btn btn--outline btn--sm"
                >
                  {t("exams.review")}
                </Link>
              ) : (
                <span className="muted" title={t("exams.noDetail")}>
                  —
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
