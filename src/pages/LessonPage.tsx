import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useLesson, usePractice } from "../shared/content/hooks";
import { getLocalizedText } from "../shared/content/getLocalizedText";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";
import {
  lessonLevel,
  lessonShortTitle,
  lessonTitle,
  partLabel,
  partType,
} from "../shared/content/lessonLabels";
import {
  getLessonProgress,
  syncLessonProgressFromServer,
  type SegmentProgressData,
} from "../shared/storage/dictationProgressStore";
import { loadResume } from "../shared/storage/resumeStore";
import { useSyncedListeningAnswers } from "../features/listening/useSyncedListeningAnswers";
import { scoreBySection } from "../features/listening/listeningUnits";

export function LessonPage() {
  const { lessonId = "" } = useParams();
  const { t, uiLang } = useUiLanguage();
  const { lesson, error, loading } = useLesson(lessonId);
  // Segment → section mapping, so progress can be shown per part.
  const { practice } = usePractice(lessonId);
  const [progressMap, setProgressMap] = useState<Record<string, SegmentProgressData>>(() =>
    getLessonProgress(lessonId),
  );

  useEffect(() => {
    let cancelled = false;
    syncLessonProgressFromServer(lessonId).then((map) => {
      if (!cancelled) setProgressMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  const correctBySection = useMemo(() => {
    const out: Record<string, number> = {};
    for (const s of practice?.sections ?? []) {
      const ids = new Set<string>();
      for (const q of s.questions) for (const seg of q.segments) ids.add(seg.id);
      out[s.id] = [...ids].filter((id) => progressMap[id]?.status === "correct").length;
    }
    return out;
  }, [practice, progressMap]);

  const { answers: listeningAnswers } = useSyncedListeningAnswers(lessonId);
  const listeningScore = useMemo(
    () => (practice ? scoreBySection(practice, listeningAnswers) : null),
    [practice, listeningAnswers],
  );
  const listeningDone = listeningScore ? listeningScore.right + listeningScore.wrong : 0;

  const crumbsBase = [{ label: t("nav.practice"), to: "/lessons" }];

  if (loading) {
    return (
      <AppShell breadcrumbs={crumbsBase}>
        <div className="notice">{t("lesson.loading")}</div>
      </AppShell>
    );
  }

  if (error || !lesson) {
    return (
      <AppShell breadcrumbs={crumbsBase}>
        <div className="notice notice--error" role="alert">
          <Icon name="alert" />
          {t("lesson.notFound")}
          <Link to="/lessons" className="btn btn--outline btn--sm" style={{ marginLeft: "auto" }}>
            {t("home.viewAll")}
          </Link>
        </div>
      </AppShell>
    );
  }

  const fallbackTitle = getLocalizedText(lesson.title, uiLang) || lesson.id;
  const total = lesson.counts.dictation_segments;
  const correct = Object.values(progressMap).filter((p) => p.status === "correct").length;
  const pct = total ? Math.min(100, Math.round((correct / total) * 100)) : 0;
  const base = `/lessons/${encodeURIComponent(lesson.id)}`;
  const resume = loadResume();
  const hasResume = resume?.lesson_id === lesson.id;
  const resumeHref = `${base}/dictation${
    hasResume && resume?.section_id ? `?section=${encodeURIComponent(resume.section_id)}` : ""
  }`;

  return (
    <AppShell
      breadcrumbs={[...crumbsBase, { label: lessonShortTitle(lesson.source, fallbackTitle) }]}
    >
      <section className="lesson-head">
        <div className="lesson-head__copy">
          <div className="lesson-head__meta">
            <span className="badge">{lessonLevel(lesson.source)}</span>
            <span>{t("lesson.subtitle")}</span>
          </div>
          <h1>{lessonTitle(lesson.source, fallbackTitle)}</h1>
        </div>
        <dl className="stat-strip">
          <div>
            <dt>{t("lesson.statSections")}</dt>
            <dd>{lesson.counts.sections}</dd>
          </div>
          <div>
            <dt>{t("lesson.statQuestions")}</dt>
            <dd>{lesson.counts.questions}</dd>
          </div>
          <div>
            <dt>{t("lesson.statSegments")}</dt>
            <dd>{total}</dd>
          </div>
          <div>
            <dt>{t("lesson.progress")}</dt>
            <dd className="is-accent">{pct}%</dd>
          </div>
        </dl>
      </section>

      <section className="mode-grid" aria-label={t("dictation.selectMode")}>
        <article className="mode-card is-featured">
          <span className="mode-card__icon">
            <Icon name="pencil" size={24} />
          </span>
          <div className="mode-card__body">
            <div className="mode-card__title">
              <h2>{t("lesson.dictationTitle")}</h2>
              <span className="badge badge--sm">{t("lesson.recommended")}</span>
            </div>
            <p>{t("lesson.dictationDesc")}</p>
            <div className="mode-card__cta">
              <Link to={resumeHref} className="btn btn--primary">
                {hasResume ? t("lesson.continueCta") : t("lesson.startDictationCta")}
              </Link>
              <span>
                {correct} / {total} {t("lesson.sentencesUnit")}
              </span>
            </div>
          </div>
        </article>
        <article className="mode-card">
          <span className="mode-card__icon">
            <Icon name="headphones" size={24} />
          </span>
          <div className="mode-card__body">
            <div className="mode-card__title">
              <h2>{t("lesson.listeningTitle")}</h2>
            </div>
            <p>{t("lesson.listeningDesc")}</p>
            <div className="mode-card__cta">
              <Link to={`${base}/listening`} className="btn btn--outline">
                {t("lesson.startListeningCta")}
              </Link>
              {listeningScore && listeningDone > 0 ? (
                <Link to={`${base}/listening/result`}>
                  {listeningScore.right} / {listeningDone} {t("lesson.listeningScore")}
                </Link>
              ) : (
                <span>
                  {lesson.counts.questions} {t("lesson.statQuestions").toLowerCase()}
                </span>
              )}
            </div>
          </div>
        </article>
      </section>

      <section>
        <div className="section-head">
          <div>
            <h2>{t("lesson.sectionsTitle")}</h2>
            <p>{t("lesson.sectionsSub")}</p>
          </div>
        </div>
        <div className="parts">
          <div className="parts__row parts__row--head" aria-hidden="true">
            <span>{t("lesson.colPart")}</span>
            <span>{t("lesson.colType")}</span>
            <span>{t("lesson.statQuestions")}</span>
            <span>{t("lesson.statSegments")}</span>
            <span>{t("lesson.colProgress")}</span>
            <span />
          </div>
          {lesson.sections.map((s) => {
            const type = partType(lesson.source, s.order);
            const done = correctBySection[s.id] ?? 0;
            const sPct = s.dictation_segment_count
              ? Math.min(100, Math.round((done / s.dictation_segment_count) * 100))
              : 0;
            const q = `?section=${encodeURIComponent(s.id)}`;
            const partNo = s.title.ja || `問題${s.order}`;
            return (
              <div key={s.id} className="parts__row">
                <span className="parts__no">{partNo}</span>
                <div className="parts__type">
                  <strong>{type ? partLabel(type, uiLang) : getLocalizedText(s.title, uiLang)}</strong>
                  {type && uiLang !== "ja" && <span>{type.ja}</span>}
                </div>
                <div className="parts__nums">
                  <span className="parts__num">
                    {s.question_count}
                    <span className="parts__label"> {t("lesson.statQuestions").toLowerCase()}</span>
                  </span>
                  <span className="parts__num">
                    {s.dictation_segment_count}
                    <span className="parts__label"> {t("lesson.sentencesUnit")}</span>
                  </span>
                </div>
                <div className="parts__progress">
                  <div
                    className="progress"
                    role="progressbar"
                    aria-label={`${partNo} ${t("lesson.colProgress")}`}
                    aria-valuenow={sPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span style={{ width: `${sPct}%` }} />
                  </div>
                  <span className="pct">{sPct}%</span>
                </div>
                <div className="parts__actions">
                  <Link to={`${base}/dictation${q}`} className="btn btn--soft btn--sm">
                    <Icon name="pencil" size={16} />
                    {t("lesson.btnDictation")}
                  </Link>
                  <Link to={`${base}/listening${q}`} className="btn btn--muted btn--sm">
                    <Icon name="headphones" size={16} />
                    {t("lesson.btnListening")}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
