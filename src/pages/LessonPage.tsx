import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLesson, usePractice } from "../shared/content/hooks";
import { getLocalizedText } from "../shared/content/getLocalizedText";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";
import {
  isPracticeLesson,
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
import { ExamEntry } from "../features/paper/ExamEntry";
import { PART_KANJI } from "../features/paper/paperLabels";
import type { PaperPart } from "../shared/api/paper";
import { getPaperProgress } from "../shared/storage/paperProgressStore";

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
  const paperAnswers = Object.values(getPaperProgress(lessonId).answers);
  const paperDone = (part: PaperPart) => paperAnswers.filter((a) => a.part === part).length;

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
  const base = `/lessons/${encodeURIComponent(lesson.id)}`;
  const resume = loadResume();
  const hasResume = resume?.lesson_id === lesson.id;
  const resumeHref = `${base}/dictation${
    hasResume && resume?.section_id ? `?section=${encodeURIComponent(resume.section_id)}` : ""
  }`;

  const paperCounts = lesson.paper?.counts;
  const cards: PartCardProps[] = [
    {
      key: "listening",
      kanji: "聴",
      tone: "listening",
      title: t("lesson.listeningPart"),
      desc: t("lesson.listeningPartDesc"),
      done: listeningDone,
      total: lesson.counts.questions,
      href: `${base}/listening`,
    },
    {
      key: "dictation",
      kanji: "書",
      tone: "dictation",
      title: t("lesson.dictationTitle"),
      desc: t("lesson.dictationDesc"),
      done: correct,
      total,
      unit: t("lesson.sentencesUnit"),
      href: resumeHref,
    },
    ...(paperCounts
      ? (["vocab", "grammar", "reading"] as const).map((part) => ({
          key: part,
          kanji: PART_KANJI[part],
          tone: part,
          title: t(`paper.title.${part}` as const),
          desc: t(`paper.desc.${part}` as const),
          done: paperDone(part),
          total: paperCounts[part],
          href: `${base}/paper/${part}`,
        }))
      : []),
  ];
  // Dictation counts sentences, not questions, so it stays out of the exam-level totals.
  const examCards = cards.filter((c) => c.key !== "dictation");
  const allTotal = examCards.reduce((n, c) => n + c.total, 0);
  const allDone = examCards.reduce((n, c) => n + Math.min(c.done, c.total), 0);
  const pct = allTotal ? Math.min(100, Math.round((allDone / allTotal) * 100)) : 0;

  return (
    <AppShell
      breadcrumbs={[...crumbsBase, { label: lessonShortTitle(lesson.source, fallbackTitle) }]}
    >
      <section className="lesson-head">
        <div className="lesson-head__copy">
          <div className="lesson-head__meta">
            <span className="badge">{lessonLevel(lesson.source)}</span>
            {isPracticeLesson(lesson.source) && (
              <span className="badge badge--practice">{t("lessons.practiceBadge")}</span>
            )}
            <span>{t("lesson.subtitle")}</span>
          </div>
          <h1>{lessonTitle(lesson.source, fallbackTitle)}</h1>
          {isPracticeLesson(lesson.source) && <p className="lesson-head__note">{t("lessons.practiceNote")}</p>}
        </div>
        <dl className="stat-strip">
          <div>
            <dt>{t("lesson.statTotal")}</dt>
            <dd>{allTotal}</dd>
          </div>
          <div>
            <dt>{t("lesson.statDone")}</dt>
            <dd>{allDone}</dd>
          </div>
          <div>
            <dt>{t("lesson.progress")}</dt>
            <dd className="is-accent">{pct}%</dd>
          </div>
        </dl>
      </section>

      {(lesson.paper || lesson.counts.questions > 0) && (
        <ExamEntry lessonId={lesson.id} hasWritten={!!lesson.paper} hasListening={lesson.counts.questions > 0} />
      )}

      <section aria-labelledby="lesson-parts-title">
        <div className="section-head">
          <div>
            <h2 id="lesson-parts-title">{t("lesson.partsTitle")}</h2>
            <p>{t("lesson.partsSub")}</p>
          </div>
        </div>
        <div className="part-grid">
          {cards.map(({ key, ...card }) => (
            <PartCard key={key} {...card} />
          ))}
        </div>
      </section>

      <details className="parts-fold">
        <summary>
          <span>
            <strong>{t("lesson.sectionsTitle")}</strong>
            <small>{t("lesson.sectionsSub")}</small>
          </span>
          <Icon name="chevronRight" size={18} strokeWidth={2} />
        </summary>
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
      </details>
    </AppShell>
  );
}

type PartCardProps = {
  key: string;
  kanji: string;
  /** Picks the part's colour. */
  tone?: string;
  /** What `total` counts; questions unless said otherwise. */
  unit?: string;
  title: string;
  desc: string;
  done: number;
  total: number;
  href: string;
  extra?: ReactNode;
};

function PartCard({ kanji, tone, unit, title, desc, done, total, href, extra }: Omit<PartCardProps, "key">) {
  const { t } = useUiLanguage();
  const shown = Math.min(done, total);
  const pct = total ? Math.round((shown / total) * 100) : 0;
  return (
    <article className="part-card">
      <div className="part-card__head">
        <span className="part-card__kanji jp" data-tone={tone} aria-hidden="true">
          {kanji}
        </span>
        <h3>{title}</h3>
      </div>
      <p>{desc}</p>
      <div className="part-card__progress">
        <div className="progress" role="progressbar" aria-label={title} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <span className="tabular">
          {shown} / {total} {unit ?? t("paper.questionsUnit")}
        </span>
      </div>
      <div className="part-card__cta">
        <Link to={href} className={`btn ${shown > 0 ? "btn--primary" : "btn--outline"}`}>
          {shown > 0 && shown < total ? t("paper.continue") : t("paper.start")}
        </Link>
        {extra}
      </div>
    </article>
  );
}
