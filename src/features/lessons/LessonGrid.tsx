import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { listLessons, type LessonSummary } from "../../shared/api/content";
import { getLessonProgress } from "../../shared/storage/dictationProgressStore";
import { getAllListeningAnswers } from "../../shared/storage/listeningScoreStore";
import { getPaperProgress } from "../../shared/storage/paperProgressStore";
import {
  getLessonActivity,
  syncLessonActivityFromServer,
  type LessonActivity,
} from "../../shared/storage/lessonActivityStore";
import { fmt } from "../../shared/i18n/format";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import type { TranslationKey } from "../../shared/i18n/translations";
import { useLevel, type JlptLevel } from "../../shared/context/LevelContext";
import { isPracticeLesson, lessonKind, lessonLevel, lessonTitle, type LessonKind } from "../../shared/content/lessonLabels";
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

export type LessonView = "grid" | "list";
const VIEW_KEY = "jd.lesson_view.v1";
const viewListeners = new Set<() => void>();

function readView(): LessonView {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

let currentView = readView();

function setLessonView(view: LessonView) {
  currentView = view;
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    /* blocked storage: the choice just won't be remembered */
  }
  viewListeners.forEach((fn) => fn());
}

/** Cards or a compact list; shared by every lesson listing and remembered in this browser. */
export function useLessonView(): LessonView {
  return useSyncExternalStore(
    (fn) => {
      viewListeners.add(fn);
      return () => viewListeners.delete(fn);
    },
    () => currentView,
    () => "grid",
  );
}

export function ViewToggle() {
  const { t } = useUiLanguage();
  const view = useLessonView();
  return (
    <div className="view-toggle" role="group" aria-label={t("lessons.viewLabel")}>
      {(["grid", "list"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          title={t(v === "grid" ? "lessons.viewGrid" : "lessons.viewList")}
          aria-label={t(v === "grid" ? "lessons.viewGrid" : "lessons.viewList")}
          onClick={() => setLessonView(v)}
        >
          <Icon name={v} size={18} />
        </button>
      ))}
    </div>
  );
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

type CardProgress = { done: number; total: number; status: LessonStatus };

/** Questions answered across the listening and written parts of each lesson, in this browser. */
function progressFor(lessons: LessonSummary[]): Record<string, CardProgress> {
  const listening = getAllListeningAnswers();
  const out: Record<string, CardProgress> = {};
  for (const l of lessons) {
    const c = l.paper?.counts;
    const total = l.counts.questions + (c ? c.vocab + c.grammar + c.reading : 0);
    const done = Math.min(
      total,
      Object.keys(listening[l.id] ?? {}).length + Object.keys(getPaperProgress(l.id).answers).length,
    );
    out[l.id] = { done, total, status: lessonStatus(done, total) };
  }
  return out;
}

function statusLabelOf(status: LessonStatus, t: (k: TranslationKey) => string): string {
  return status === "done" ? t("lessons.statusDone") : status === "doing" ? t("lessons.statusDoing") : t("lesson.notStarted");
}

function lessonParts(lesson: LessonSummary): number {
  return lesson.paper ? 4 : 1;
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
  const { done, total, status } = progress;
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const detail = `/lessons/${encodeURIComponent(lesson.id)}`;
  const ago = lastActiveAt ? (timeAgo(lastActiveAt, Date.now(), uiLang) ?? t("lessons.justNow")) : null;
  const practice = isPracticeLesson(lesson.source);

  return (
    <article className="lesson-card">
      <div className="lesson-card__top">
        <span className="lesson-card__badges">
          <span className="badge">{lessonLevel(lesson.source)}</span>
          {practice && <span className="badge badge--practice">{t("lessons.practiceBadge")}</span>}
        </span>
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
        {practice && <p className="lesson-card__note">{t("lessons.practiceNote")}</p>}
        <p className="lesson-card__stats">
          {fmt(t("lessons.cardStats"), { total: String(total), parts: String(lessonParts(lesson)) })}
        </p>
      </div>
      <div className="lesson-card__progress">
        <div className="lesson-card__progress-label">
          <span className={`lesson-card__status is-${status}`}>
            {status === "done" && <Icon name="check" size={14} strokeWidth={2.4} />}
            {statusLabelOf(status, t)}
          </span>
          <span className="tabular">
            {done} / {total}
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
        <Link to={detail} className="btn btn--primary">
          {t("lesson.viewDetail")}
        </Link>
      </div>
    </article>
  );
}

/** The compact form of a lesson card: one line with the text laid out across. */
function LessonRow({
  lesson,
  progress,
  lastActiveAt,
}: {
  lesson: LessonSummary;
  progress: CardProgress;
  lastActiveAt: number | undefined;
}) {
  const { t, uiLang } = useUiLanguage();
  const { done, total, status } = progress;
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const detail = `/lessons/${encodeURIComponent(lesson.id)}`;
  const ago = lastActiveAt ? (timeAgo(lastActiveAt, Date.now(), uiLang) ?? t("lessons.justNow")) : null;
  const practice = isPracticeLesson(lesson.source);

  return (
    <article className="lesson-row">
      <span className="lesson-row__badges">
        <span className="badge">{lessonLevel(lesson.source)}</span>
        {practice && <span className="badge badge--practice">{t("lessons.practiceBadge")}</span>}
      </span>
      <div className="lesson-row__main">
        <h3 className="lesson-row__title">
          <Link to={detail}>{lessonTitle(lesson.source, getLocalizedText(lesson.title, uiLang) || lesson.id)}</Link>
        </h3>
        <span className="lesson-row__meta">
          {fmt(t("lessons.cardStats"), { total: String(total), parts: String(lessonParts(lesson)) })}
          {ago && ` · ${fmt(t("lessons.recent"), { ago })}`}
        </span>
      </div>
      <span className={`lesson-card__status lesson-row__status is-${status}`}>
        {status === "done" && <Icon name="check" size={14} strokeWidth={2.4} />}
        {statusLabelOf(status, t)}
      </span>
      <div className="lesson-row__progress">
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
        <span className="tabular">{fmt(t("lessons.listDone"), { done: String(done), total: String(total) })}</span>
      </div>
      <Link to={detail} className="btn btn--soft btn--sm lesson-row__cta">
        {t("lesson.viewDetail")}
        <Icon name="chevronRight" size={16} strokeWidth={2} />
      </Link>
    </article>
  );
}

export type StatusFilter = "all" | LessonStatus;
export type KindFilter = "all" | Exclude<LessonKind, "other">;

const KIND_FILTERS: { id: KindFilter; label: TranslationKey }[] = [
  { id: "all", label: "lessons.kindAll" },
  { id: "exam", label: "lessons.kindExam" },
  { id: "practice", label: "lessons.kindPractice" },
];

const STATUS_FILTERS: { id: StatusFilter; label: TranslationKey }[] = [
  { id: "all", label: "lessons.statusAll" },
  { id: "todo", label: "lessons.statusTodo" },
  { id: "doing", label: "lessons.statusDoing" },
  { id: "done", label: "lessons.statusDone" },
];

/**
 * Level-filtered grid of lessons with loading, error and empty states.
 * Recently practised lessons come first, then the newest sittings. With
 * `onStatusChange` it also shows a toolbar: `search` and the status filter;
 * with `onKindChange`, tabs for past exams / practice tests above it.
 */
export function LessonGrid({
  lessons,
  loading,
  error,
  query = "",
  search,
  status = "all",
  onStatusChange,
  kind = "all",
  onKindChange,
  limit,
  newestFirst = false,
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
  kind?: KindFilter;
  onKindChange?: (kind: KindFilter) => void;
  /** Show only the first few lessons (the home page's "latest" row). */
  limit?: number;
  /** Order by sitting, newest first, ignoring what was practised last. */
  newestFirst?: boolean;
}) {
  const { t, uiLang } = useUiLanguage();
  const { level } = useLevel();
  const activity = useLessonActivity();
  const view = useLessonView();
  const sorted = useMemo(() => sortLessons(lessons, newestFirst ? {} : activity), [lessons, activity, newestFirst]);
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
  const searchText = (l: LessonSummary) => {
    const title = lessonTitle(l.source, getLocalizedText(l.title, uiLang) || l.id);
    return isPracticeLesson(l.source) ? `${title} ${t("lessons.practiceBadge")} ${t("lessons.kindPractice")}` : title;
  };
  const inLevel = sorted.filter(
    (l) =>
      (level === "ALL" || String(l.source?.level ?? "").toUpperCase() === level) &&
      (!searching || matchesLessonQuery(l, query, searchText(l))),
  );
  const kindCounts: Record<KindFilter | "other", number> = { all: inLevel.length, exam: 0, practice: 0, other: 0 };
  for (const l of inLevel) kindCounts[lessonKind(l.source)] += 1;
  const matching = kind === "all" ? inLevel : inLevel.filter((l) => lessonKind(l.source) === kind);
  const counts: Record<StatusFilter, number> = { all: matching.length, todo: 0, doing: 0, done: 0 };
  for (const l of matching) counts[progress[l.id]!.status] += 1;
  const allShown = status === "all" ? matching : matching.filter((l) => progress[l.id]!.status === status);
  const shown = limit ? allShown.slice(0, limit) : allShown;
  const filtered = searching || status !== "all" || kind !== "all";

  const tabs = onKindChange && (
    <div className="lesson-tabs" role="group" aria-label={t("lessons.kindFilter")}>
      {KIND_FILTERS.map((f) => (
        <button key={f.id} type="button" aria-pressed={kind === f.id} onClick={() => onKindChange(f.id)}>
          {t(f.label)}
          <span className="lesson-tabs__count">{kindCounts[f.id]}</span>
        </button>
      ))}
    </div>
  );

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
      {tabs}
      {toolbar}
      {filtered && shown.length === 0 ? (
        <div className="notice">
          {searching ? fmt(t("lessons.noMatch"), { q: query.trim() }) : t("lessons.noStatusMatch")}
        </div>
      ) : (
        <div className={view === "list" ? "lesson-list" : "lesson-grid"}>
          {view === "list" && (
            <div className="lesson-row lesson-row--head" aria-hidden="true">
              <span />
              <span>{t("lessons.colExam")}</span>
              <span>{t("lessons.colStatus")}</span>
              <span>{t("lesson.progress")}</span>
              <span />
            </div>
          )}
          {shown.map((l) =>
            view === "list" ? (
              <LessonRow key={l.id} lesson={l} progress={progress[l.id]!} lastActiveAt={activity[l.id]} />
            ) : (
              <LessonCard key={l.id} lesson={l} progress={progress[l.id]!} lastActiveAt={activity[l.id]} />
            ),
          )}
          {!filtered && (!limit || shown.length === 0) && (
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
