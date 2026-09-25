import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listLessons, type LessonSummary } from "../../shared/api/content";
import { getLessonProgress } from "../../shared/storage/dictationProgressStore";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { useLevel, type JlptLevel } from "../../shared/context/LevelContext";
import { lessonLevel, lessonSitting, lessonTitle } from "../../shared/content/lessonLabels";
import { getLocalizedText } from "../../shared/content/getLocalizedText";
import { Icon } from "../../shared/ui/Icon";

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

function LessonCard({ lesson }: { lesson: LessonSummary }) {
  const { t, uiLang } = useUiLanguage();
  const total = lesson.counts.dictation_segments;
  const correct = correctCountFor(lesson.id);
  const pct = total ? Math.min(100, Math.round((correct / total) * 100)) : 0;
  const sitting = lessonSitting(lesson.source);
  const detail = `/lessons/${encodeURIComponent(lesson.id)}`;

  return (
    <article className="lesson-card">
      <div className="lesson-card__top">
        <span className="badge">{lessonLevel(lesson.source)}</span>
        {sitting && <span className="lesson-card__when">{sitting}</span>}
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
          <span>{t("lesson.progress")}</span>
          <span className="tabular">{correct > 0 ? `${correct} / ${total}` : t("lesson.notStarted")}</span>
        </div>
        <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
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

/** Level-filtered grid of lessons with loading, error and empty states. */
export function LessonGrid({
  lessons,
  loading,
  error,
}: {
  lessons: LessonSummary[];
  loading: boolean;
  error: string | null;
}) {
  const { t } = useUiLanguage();
  const { level } = useLevel();

  if (loading) return <div className="notice">{t("home.loading")}</div>;
  if (error) {
    return (
      <div className="notice notice--error" role="alert">
        <Icon name="alert" />
        {t("home.loadError")}
      </div>
    );
  }

  const shown = lessons.filter(
    (l) => level === "ALL" || String(l.source?.level ?? "").toUpperCase() === level,
  );

  return (
    <div className="lesson-grid">
      {shown.map((l) => (
        <LessonCard key={l.id} lesson={l} />
      ))}
      <div className="coming-card">
        <strong>{shown.length === 0 ? t("home.empty") : t("home.comingTitle")}</strong>
        <span>{t("home.comingBody")}</span>
      </div>
    </div>
  );
}
