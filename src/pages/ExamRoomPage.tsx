import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LevelFilter, useLessonList } from "../features/lessons/LessonGrid";
import { matchesLessonQuery } from "../features/lessons/lessonSearch";
import { ExamHistoryTable, useExamLabel } from "../features/paper/ExamHistoryTable";
import { scopeTitle } from "../features/paper/paperLabels";
import type { LessonSummary } from "../shared/api/content";
import { getLocalizedText } from "../shared/content/getLocalizedText";
import { lessonTitle } from "../shared/content/lessonLabels";
import { useLevel } from "../shared/context/LevelContext";
import { fmt } from "../shared/i18n/format";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import {
  formatClock,
  getExamHistory,
  listRunningExams,
  reviewableSittings,
  type ExamHistoryEntry,
  type ExamSession,
} from "../shared/storage/paperExamStore";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";

type StatusFilter = "all" | "never" | "taken";
type PartFilter = "all" | "written" | "listening";
const STATUSES: Array<{ id: StatusFilter; label: "exams.statusAll" | "exams.statusNever" | "exams.statusTaken" }> = [
  { id: "all", label: "exams.statusAll" },
  { id: "never", label: "exams.statusNever" },
  { id: "taken", label: "exams.statusTaken" },
];
const PARTS: PartFilter[] = ["all", "written", "listening"];
/** The history table here is a glance; the full list with its filters is on its own page. */
const HISTORY_PREVIEW = 5;

const writtenCount = (l: LessonSummary) => {
  const c = l.paper?.counts;
  return c ? c.vocab + c.grammar + c.reading : 0;
};

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

/** Newest sitting first, so the latest past exam is the first card. */
function bySitting(a: LessonSummary, b: LessonSummary): number {
  const key = (l: LessonSummary) => Number(l.source?.year ?? 0) * 100 + Number(l.source?.month ?? 0);
  return key(b) - key(a);
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

/** The exam room as a place of its own: pick a past exam, sit it timed, and see every earlier sitting. */
export function ExamRoomPage() {
  const { t, uiLang } = useUiLanguage();
  const { level } = useLevel();
  const { lessons, loading, error } = useLessonList();
  const [history] = useState<ExamHistoryEntry[]>(getExamHistory);
  const [reviewable] = useState(() => reviewableSittings(history));
  const [running] = useState<ExamSession[]>(listRunningExams);
  const now = useNow(running.length > 0);

  // In the URL so coming back from an exam keeps the search and filters.
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const statusParam = params.get("status");
  const status = STATUSES.find((s) => s.id === statusParam)?.id ?? "all";
  const partParam = params.get("part") as PartFilter | null;
  const part = partParam && PARTS.includes(partParam) ? partParam : "all";
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const inLevel = useMemo(
    () =>
      lessons
        .filter((l) => (l.paper || l.counts.questions > 0) && (level === "ALL" || String(l.source?.level ?? "").toUpperCase() === level))
        .sort(bySitting),
    [lessons, level],
  );
  const byId = useMemo(() => new Map(lessons.map((l) => [l.id, l])), [lessons]);
  const label = useExamLabel(byId);
  const sat = useMemo(() => new Set(history.map((h) => h.lessonId)), [history]);

  const matching = inLevel.filter(
    (l) =>
      (!query.trim() || matchesLessonQuery(l, query, lessonTitle(l.source, getLocalizedText(l.title, uiLang) || l.id))) &&
      (part === "all" || (part === "written" ? writtenCount(l) > 0 : l.counts.questions > 0)),
  );
  const counts: Record<StatusFilter, number> = {
    all: matching.length,
    never: matching.filter((l) => !sat.has(l.id)).length,
    taken: matching.filter((l) => sat.has(l.id)).length,
  };
  const exams = status === "all" ? matching : matching.filter((l) => sat.has(l.id) === (status === "taken"));
  const filtered = query.trim() !== "" || status !== "all" || part !== "all";

  return (
    <AppShell title={t("nav.exams")}>
      <div className="page-head">
        <div>
          <h1>{t("exams.title")}</h1>
          <p>{t("exams.sub")}</p>
        </div>
        <div className="page-head__aside">
          <LevelFilter />
        </div>
      </div>

      {running.map((s) => {
        const left = s.endsAt - now;
        return (
          <section key={s.lessonId} className="exam-running" aria-label={t("exams.running")}>
            <span className="exam-running__icon" aria-hidden="true">
              <Icon name="clock" size={22} />
            </span>
            <div className="exam-running__body">
              <span className="eyebrow">{t("exams.running")}</span>
              <strong>
                {label(s.lessonId)} · {scopeTitle(s.scope, t)}
              </strong>
              <span className={`exam-running__left${left <= 0 ? " is-over" : ""}`}>
                {left > 0 ? `${formatClock(left)} ${t("exams.timeLeft")}` : t("exams.timeUp")}
              </span>
            </div>
            <Link
              to={`/lessons/${encodeURIComponent(s.lessonId)}/paper/exam`}
              className="btn btn--primary"
            >
              {t("exams.resume")}
            </Link>
          </section>
        );
      })}

      {!loading && !error && inLevel.length > 0 && (
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
            <span>{t("exams.colScope")}</span>
            <select value={part} onChange={(e) => setParam("part", e.target.value === "all" ? "" : e.target.value)}>
              <option value="all">{t("exams.allScopes")}</option>
              <option value="written">{t("exams.partWritten")}</option>
              <option value="listening">{t("exams.partListening")}</option>
            </select>
          </label>
          <div className="status-filter" role="group" aria-label={t("exams.statusFilter")}>
            {STATUSES.map((f) => (
              <button
                key={f.id}
                type="button"
                className="status-chip"
                aria-pressed={status === f.id}
                onClick={() => setParam("status", f.id === "all" ? "" : f.id)}
              >
                {t(f.label)}
                <span className="status-chip__count">{counts[f.id]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="notice">{t("home.loading")}</div>
      ) : error ? (
        <div className="notice notice--error" role="alert">
          <Icon name="alert" />
          {t("home.loadError")}
        </div>
      ) : inLevel.length === 0 ? (
        <div className="notice">{t("exams.empty")}</div>
      ) : exams.length === 0 ? (
        <div className="notice">
          {query.trim() ? fmt(t("lessons.noMatch"), { q: query.trim() }) : t("exams.noMatch")}
          {filtered && (
            <button
              type="button"
              className="btn btn--soft btn--sm"
              style={{ marginLeft: "auto" }}
              onClick={() => setParams({}, { replace: true })}
            >
              {t("exams.clearFilters")}
            </button>
          )}
        </div>
      ) : (
        <div className="exam-grid">
          {exams.map((l) => {
            const written = writtenCount(l);
            const listeningTotal = l.counts.questions;
            const sittings = history.filter((h) => h.lessonId === l.id);
            const last = sittings[0];
            const setup = `/lessons/${encodeURIComponent(l.id)}/paper/exam/setup`;
            return (
              <article key={l.id} className="exam-pick">
                <div className="exam-pick__top">
                  <span className="badge">{String(l.source?.level ?? "").toUpperCase() || "JLPT"}</span>
                  <span className="exam-pick__parts jp">{[listeningTotal > 0 ? "聴" : "", written > 0 ? "語 · 文 · 読" : ""].filter(Boolean).join(" · ")}</span>
                </div>
                <h3 className="exam-pick__title">
                  <Link to={`/lessons/${encodeURIComponent(l.id)}`}>
                    {lessonTitle(l.source, getLocalizedText(l.title, uiLang) || l.id)}
                  </Link>
                </h3>
                <p className="exam-pick__meta">
                  {[
                    written > 0 ? `${written} ${t("exams.questions")} · ${t("exams.parts")}` : "",
                    listeningTotal > 0 ? `${listeningTotal} ${t("exams.listeningQuestions")}` : "",
                  ]
                    .filter(Boolean)
                    .join(" + ")}
                </p>
                <p className={`exam-pick__last${last ? "" : " is-empty"}`}>
                  {last ? (
                    <>
                      {t("exams.last")} ({scopeTitle(last.scope, t)}): <strong>{last.correct}/{last.total}</strong> ({pct(last.correct, last.total)}%)
                      {sittings.length > 1 && <span> · {sittings.length} {t("exams.times")}</span>}
                    </>
                  ) : (
                    t("exams.never")
                  )}
                </p>
                <div className="exam-pick__actions">
                  {written > 0 && (
                    <Link to={setup} className="btn btn--primary">
                      {listeningTotal > 0 ? t("exams.startWritten") : t("exams.start")}
                      <Icon name="chevronRight" size={16} strokeWidth={2} />
                    </Link>
                  )}
                  {listeningTotal > 0 && (
                    <Link to={`${setup}?scope=listening`} className={`btn ${written > 0 ? "btn--outline" : "btn--primary"}`}>
                      <Icon name="headphones" size={16} />
                      {written > 0 ? t("exams.startListening") : t("exams.start")}
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <section className="panel table-card exam-history" aria-labelledby="exam-history-title">
        <div className="table-card__head">
          <h2 id="exam-history-title">{t("exams.history")}</h2>
          <span className="muted">{t("exams.historySub")}</span>
          {history.length > 0 && (
            <Link to="/exams/history" className="btn btn--soft btn--sm" style={{ marginLeft: "auto" }}>
              {t("exams.historyAll")}
              <Icon name="chevronRight" size={16} strokeWidth={2} />
            </Link>
          )}
        </div>
        {history.length === 0 ? (
          <p className="muted exam-history__empty">{t("exams.historyEmpty")}</p>
        ) : (
          <ExamHistoryTable rows={history.slice(0, HISTORY_PREVIEW)} label={label} reviewable={reviewable} />
        )}
      </section>
    </AppShell>
  );
}
