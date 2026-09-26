import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { listLessons, type LessonSummary } from "../../shared/api/content";
import { getAllDictationProgress, getLessonProgress } from "../../shared/storage/dictationProgressStore";
import {
  getLessonActivity,
  syncLessonActivityFromServer,
  type LessonActivity,
} from "../../shared/storage/lessonActivityStore";
import { fmt } from "../../shared/i18n/format";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import type { TranslationKey } from "../../shared/i18n/translations";
import { useLevel, type JlptLevel } from "../../shared/context/LevelContext";
import { lessonLevel, lessonTitle } from "../../shared/content/lessonLabels";
import { getLocalizedText } from "../../shared/content/getLocalizedText";
import { Icon } from "../../shared/ui/Icon";
import { lessonStatus, matchesLessonQuery, sortLessons, timeAgo, type LessonStatus } from "./lessonSearch";

const LEVELS: JlptLevel[] = ["ALL", "N1", "N2", "N3", "N4", "N5"];

export function useLessonList() {
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listLessons()
      .then((data) => {
        if (!cancelled) setLessons(data.lessons);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { lessons, error, loading };
}

/** When each lesson was last practised: this browser's at once, then merged with the account's. */
function useLessonActivity(): LessonActivity {
  const [activity, setActivity] = useState<LessonActivity>(getLessonActivity);
  useEffect(() => {
    let cancelled = false;
    void syncLessonActivityFromServer().then((merged) => {
      if (!cancelled) setActivity(merged);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return activity;
}

export function correctCountFor(lessonId: string): number {
  return Object.values(getLessonProgress(lessonId)).filter((p) => p.status === "correct").length;
}

export function LevelFilter() {
  const { t } = useUiLanguage();
  const { level, setLevel } = useLevel();
  return (
    <div className="segmented" role="group" aria-label={t("home.filterLabel")}>
      {LEVELS.map((lv) => (
        <button key={lv} type="button" aria-pressed={level === lv} onClick={() => setLevel(lv)}>
          {lv === "ALL" ? t("home.all") : lv}
        </button>
      ))}
    </div>
  );
}

type CardProgress = { correct: number; attempted: number; status: LessonStatus };

function progressFor(lessons: LessonSummary[]): Record<string, CardProgress> {
  const all = getAllDictationProgress();
  const out: Record<string, CardProgress> = {};
  for (const l of lessons) {
    const entries = Object.values(all[l.id] ?? {});
    const correct = entries.filter((p) => p.status === "correct").length;
    const attempted = entries.filter((p) => p.status === "correct" || p.status === "incorrect").length;
    out[l.id] = { correct, attempted, status: lessonStatus(attempted, l.counts.dictation_segments) };
  }
  return out;
}

function LessonCard({
  lesson,
  progress,
  lastActiveAt,
}: {
  lesson: LessonSummary;
  progress: CardProgress;
  lastActiveAt: number | undefined;
}) {
  const { t, uiLang } = useUiLanguage();
  const total = lesson.counts.dictation_segments;
  const { correct, status } = progress;
  const pct = total ? Math.min(100, Math.round((correct / total) * 100)) : 0;
  const detail = `/lessons/${encodeURIComponent(lesson.id)}`;
  const ago = lastActiveAt ? (timeAgo(lastActiveAt, Date.now(), uiLang) ?? t("lessons.justNow")) : null;
  const statusLabel =
    status === "done" ? t("lessons.statusDone") : status === "doing" ? t("lessons.statusDoing") : t("lesson.notStarted");

  return (
    <article className="lesson-card">
      <div className="lesson-card__top">
        <span className="badge">{lessonLevel(lesson.source)}</span>
        {ago && (
          <span className="lesson-card__recent" title={fmt(t("lessons.recentTitle"), { ago })}>
            <Icon name="clock" size={14} strokeWidth={2} />
            {fmt(t("lessons.recent"), { ago })}
          </span>
        )}
      </div>
      <div>
        <h3 className="lesson-card__title">
          <Link to={detail}>
            {lessonTitle(lesson.source, getLocalizedText(lesson.title, uiLang) || lesson.id)}
          </Link>
        </h3>
        <p className="lesson-card__stats">
          {lesson.counts.sections} 問題 · {lesson.counts.questions} {t("lesson.statQuestions").toLowerCase()} ·{" "}
          {total} {t("lesson.statSegments").toLowerCase()}
        </p>
      </div>
      <div className="lesson-card__progress">
        <div className="lesson-card__progress-label">
          <span className={`lesson-card__status is-${status}`}>
            {status === "done" && <Icon name="check" size={14} strokeWidth={2.4} />}
            {statusLabel}
          </span>
          <span className="tabular">
            {correct} / {total}
          </span>
        </div>
        <div
          className={`progress${status === "done" ? " progress--ok" : ""}`}
          role="progressbar"
          aria-label={t("lesson.progress")}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="lesson-card__actions">
        <Link to={`${detail}/dictation`} className="btn btn--primary">
          {t("lesson.dictationTitle")}
        </Link>
        <Link to={detail} className="btn btn--outline">
          {t("lesson.viewDetail")}
        </Link>
      </div>
    </article>
  );
}

export type StatusFilter = "all" | LessonStatus;

const STATUS_FILTERS: { id: StatusFilter; label: TranslationKey }[] = [
  { id: "all", label: "lessons.statusAll" },
  { id: "todo", label: "lessons.statusTodo" },
  { id: "doing", label: "lessons.statusDoing" },
  { id: "done", label: "lessons.statusDone" },
];

/**
 * Level-filtered grid of lessons with loading, error and empty states.
 * Recently practised lessons come first, then the newest sittings. With
 * `onStatusChange` it also shows a toolbar: `search` and the status filter.
 */
export function LessonGrid({
  lessons,
  loading,
  error,
  query = "",
  search,
  status = "all",
  onStatusChange,
}: {
  lessons: LessonSummary[];
  loading: boolean;
  error: string | null;
  /** Text from the search box; empty shows every lesson. */
  query?: string;
  /** The search box, shown at the start of the toolbar. */
  search?: ReactNode;
  status?: StatusFilter;
  onStatusChange?: (status: StatusFilter) => void;
}) {
  const { t, uiLang } = useUiLanguage();
  const { level } = useLevel();
  const activity = useLessonActivity();
  const sorted = useMemo(() => sortLessons(lessons, activity), [lessons, activity]);
  const progress = useMemo(() => progressFor(lessons), [lessons]);

  if (loading) return <div className="notice">{t("home.loading")}</div>;
  if (error) {
    return (
      <div className="notice notice--error" role="alert">
        <Icon name="alert" />
        {t("home.loadError")}
      </div>
    );
  }

  const searching = query.trim() !== "";
  const matching = sorted.filter(
    (l) =>
      (level === "ALL" || String(l.source?.level ?? "").toUpperCase() === level) &&
      (!searching ||
        matchesLessonQuery(l, query, lessonTitle(l.source, getLocalizedText(l.title, uiLang) || l.id))),
  );
  const counts: Record<StatusFilter, number> = { all: matching.length, todo: 0, doing: 0, done: 0 };
  for (const l of matching) counts[progress[l.id]!.status] += 1;
  const shown = status === "all" ? matching : matching.filter((l) => progress[l.id]!.status === status);
  const filtered = searching || status !== "all";

  const toolbar = onStatusChange && (
    <div className="lesson-toolbar">
      {search}
      <div className="status-filter" role="group" aria-label={t("lessons.statusFilter")}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className="status-chip"
            aria-pressed={status === f.id}
            onClick={() => onStatusChange(f.id)}
          >
            {t(f.label)}
            <span className="status-chip__count">{counts[f.id]}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {toolbar}
      {filtered && shown.length === 0 ? (
        <div className="notice">
          {searching ? fmt(t("lessons.noMatch"), { q: query.trim() }) : t("lessons.noStatusMatch")}
        </div>
      ) : (
        <div className="lesson-grid">
          {shown.map((l) => (
            <LessonCard key={l.id} lesson={l} progress={progress[l.id]!} lastActiveAt={activity[l.id]} />
          ))}
          {!filtered && (
            <div className="coming-card">
              <strong>{shown.length === 0 ? t("home.empty") : t("home.comingTitle")}</strong>
              <span>{t("home.comingBody")}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
