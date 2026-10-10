import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ExamHistoryTable, useExamLabel } from "../features/paper/ExamHistoryTable";
import { filterHistory } from "../features/paper/examHistoryFilter";
import { useLessonList } from "../features/lessons/LessonGrid";
import { scopeTitle } from "../features/paper/paperLabels";
import type { ExamScope } from "../shared/api/paper";
import { fmt } from "../shared/i18n/format";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { getExamHistory, reviewableSittings } from "../shared/storage/paperExamStore";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";

const SCOPES: ExamScope[] = ["all", "vocab", "grammar", "reading", "listening"];

/** Every sitting ever submitted in this browser, with search and filters by exam and part, each one reopenable. */
export function ExamHistoryPage() {
  const { t } = useUiLanguage();
  const { lessons } = useLessonList();
  const [history] = useState(getExamHistory);
  const [reviewable] = useState(() => reviewableSittings(history));
  // In the URL so going back from a result keeps the search and filters.
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const lessonId = params.get("exam") ?? "";
  const scopeParam = params.get("scope") ?? "";
  const scope = SCOPES.includes(scopeParam as ExamScope) ? (scopeParam as ExamScope) : "";

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const byId = useMemo(() => new Map(lessons.map((l) => [l.id, l])), [lessons]);
  const label = useExamLabel(byId);

  // Only the exams and parts that were actually sat are worth offering.
  const exams = useMemo(() => {
    const ids = [...new Set(history.map((h) => h.lessonId))];
    const key = (id: string) => Number(byId.get(id)?.source?.year ?? 0) * 100 + Number(byId.get(id)?.source?.month ?? 0);
    return ids.sort((a, b) => key(b) - key(a) || a.localeCompare(b));
  }, [history, byId]);
  const scopes = useMemo(() => SCOPES.filter((s) => history.some((h) => h.scope === s)), [history]);

  const rows = filterHistory(history, byId, label, { query, lessonId, scope });
  const filtered = query.trim() !== "" || lessonId !== "" || scope !== "";

  const crumbs = [{ label: t("nav.exams"), to: "/exams" }, { label: t("exams.history") }];

  return (
    <AppShell breadcrumbs={crumbs}>
      <div className="page-head">
        <div>
          <h1>{t("exams.history")}</h1>
          <p>{t("exams.historySub")}</p>
        </div>
        <div className="page-head__aside">
          <Link to="/exams" className="btn btn--outline">
            {t("exams.backToRoom")}
          </Link>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="notice">
          {t("exams.historyEmpty")}
          <Link to="/exams" className="btn btn--primary btn--sm" style={{ marginLeft: "auto" }}>
            {t("history.examsCta")}
          </Link>
        </div>
      ) : (
        <>
          <div className="lesson-toolbar">
            <label className="lesson-search">
              <Icon name="search" size={18} />
              <input
                type="search"
                value={query}
                onChange={(e) => setParam("q", e.target.value)}
                placeholder={t("lessons.search")}
                aria-label={t("lessons.search")}
                autoComplete="off"
              />
            </label>
            <label className="filter-select">
              <span>{t("exams.colExam")}</span>
              <select value={lessonId} onChange={(e) => setParam("exam", e.target.value)}>
                <option value="">{t("exams.allExams")}</option>
                {exams.map((id) => (
                  <option key={id} value={id}>
                    {label(id)}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-select">
              <span>{t("exams.colScope")}</span>
              <select value={scope} onChange={(e) => setParam("scope", e.target.value)}>
                <option value="">{t("exams.allScopes")}</option>
                {scopes.map((s) => (
                  <option key={s} value={s}>
                    {scopeTitle(s, t)}
                  </option>
                ))}
              </select>
            </label>
            {filtered && (
              <button type="button" className="btn btn--soft btn--sm" onClick={() => setParams({}, { replace: true })}>
                {t("exams.clearFilters")}
              </button>
            )}
          </div>

          <section className="panel table-card exam-history" aria-live="polite">
            <div className="table-card__head">
              <h2>{fmt(t("exams.shown"), { n: String(rows.length), total: String(history.length) })}</h2>
            </div>
            {rows.length === 0 ? (
              <p className="muted exam-history__empty">{t("exams.historyNoMatch")}</p>
            ) : (
              <ExamHistoryTable rows={rows} label={label} reviewable={reviewable} />
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
