import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  clearLessonProgress,
  clearSegmentProgress,
  getLessonProgress,
  syncLessonProgressFromServer,
  type SegmentProgressData,
} from "../shared/storage/dictationProgressStore";
import { clearListeningAnswers } from "../shared/storage/listeningScoreStore";
import { clearResume, loadResume } from "../shared/storage/resumeStore";
import { useSyncedListeningAnswers } from "../features/listening/useSyncedListeningAnswers";
import { scoreBySection } from "../features/listening/listeningUnits";
import { ExamEntry } from "../features/paper/ExamEntry";
import { mondaiLabel, mondaiNo, PART_KANJI } from "../features/paper/paperLabels";
import type { PaperPart } from "../shared/api/paper";
import { getPaperProgress, resetPaperMondai, resetPaperPart } from "../shared/storage/paperProgressStore";
import { getLastMondai } from "../shared/storage/lastMondaiStore";
import { usePaperPractice } from "../features/paper/usePaperPractice";
import { useSyncedPaperProgress } from "../features/paper/useSyncedPaperProgress";

export function LessonPage() {
  const { lessonId = "" } = useParams();
  useSyncedPaperProgress(lessonId);
  const { t, uiLang } = useUiLanguage();
  const { lesson, error, loading } = useLesson(lessonId);
  // Segment → section mapping, so progress can be shown per part.
  const { practice } = usePractice(lessonId);
  // The written part's questions give each 問題 its size, for the chips on the part cards.
  const { paper } = usePaperPractice(lessonId, !!lesson?.paper);
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

  const { answers: listeningAnswers, reload: reloadListening } = useSyncedListeningAnswers(lessonId);
  // Paper progress is read straight from storage on each render; this makes it render again after a reset.
  const [, setResetCount] = useState(0);
  const listeningScore = useMemo(
    () => (practice ? scoreBySection(practice, listeningAnswers) : null),
    [practice, listeningAnswers],
  );
  const listeningDone = listeningScore ? listeningScore.right + listeningScore.wrong : 0;

  /**
   * Forgets this lesson's results for one part so it can be done again; the exam history is left alone.
   * `ids` are the 問題 to redo (section ids, or 問題 numbers for the written parts); none means the whole part.
   */
  function resetPart(key: string, ids?: string[]) {
    if (key === "listening") {
      const questionIds = ids
        ? (practice?.sections ?? []).filter((s) => ids.includes(s.id)).flatMap((s) => s.questions.map((q) => q.id))
        : undefined;
      clearListeningAnswers(lessonId, questionIds);
      reloadListening();
    } else if (key === "dictation") {
      if (ids) {
        const segmentIds = (practice?.sections ?? [])
          .filter((s) => ids.includes(s.id))
          .flatMap((s) => s.questions.flatMap((q) => q.segments.map((seg) => seg.id)));
        clearSegmentProgress(lessonId, segmentIds);
        setProgressMap(getLessonProgress(lessonId));
      } else {
        clearLessonProgress(lessonId);
        clearResume(lessonId);
        setProgressMap({});
      }
    } else if (key === "vocab" || key === "grammar" || key === "reading") {
      if (ids && paper) {
        const mondai = ids.map(Number);
        const items = paper.items.filter((i) => i.part === key && mondai.includes(i.mondai));
        const passages = paper.passages.filter((p) => mondai.includes(p.mondai));
        resetPaperMondai(lessonId, items.map((i) => i.id), passages.map((p) => p.id));
      } else {
        resetPaperPart(lessonId, key);
      }
    }
    setResetCount((n) => n + 1);
  }

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
  const paperProgress = getPaperProgress(lessonId);
  const listeningBySection = new Map((listeningScore?.sections ?? []).map((x) => [x.section.id, x.right + x.wrong]));
  /** One chip per 問題 of a listening/dictation part, opening that section. */
  const sectionPicks = (kind: "listening" | "dictation"): Pick[] =>
    lesson.sections
      .filter((s) => (kind === "listening" ? s.question_count : s.dictation_segment_count) > 0)
      .map((s) => {
        const type = partType(lesson.source, s.order);
        return {
          id: s.id,
          label: `問${s.order}`,
          title: type ? partLabel(type, uiLang) : getLocalizedText(s.title, uiLang),
          href: `${base}/${kind}?section=${encodeURIComponent(s.id)}`,
          done: kind === "listening" ? (listeningBySection.get(s.id) ?? 0) : (correctBySection[s.id] ?? 0),
          total: kind === "listening" ? s.question_count : s.dictation_segment_count,
          current: getLastMondai(lesson.id, kind) === s.id,
        };
      });
  /** The 問題 of one written part, sized from its questions. */
  const paperPicks = (part: PaperPart): Pick[] => {
    const items = (paper?.items ?? []).filter((i) => i.part === part);
    return [...new Set(items.map((i) => i.mondai))]
      .sort((x, y) => x - y)
      .map((m) => {
        const inMondai = items.filter((i) => i.mondai === m);
        return {
          id: String(m),
          label: `問${mondaiNo(m, lesson.id)}`,
          title: mondaiLabel(m, uiLang, lesson.id),
          href: `${base}/paper/${part}?mondai=${m}`,
          done: inMondai.filter((i) => paperProgress.answers[i.id]).length,
          total: inMondai.length,
          current: getLastMondai(lesson.id, part) === String(m),
        };
      });
  };

  const cards: PartCardProps[] = [
    ...(lesson.counts.questions > 0
      ? [
          {
            key: "listening",
            kanji: "聴",
            tone: "listening",
            title: t("lesson.listeningPart"),
            desc: t("lesson.listeningPartDesc"),
            done: listeningDone,
            total: lesson.counts.questions,
            href: `${base}/listening`,
            picks: sectionPicks("listening"),
          },
        ]
      : []),
    ...(total > 0
      ? [
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
            picks: sectionPicks("dictation"),
          },
        ]
      : []),
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
          picks: paperPicks(part),
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
          {(allDone > 0 || correct > 0) && (
            <div className="section-head__aside">
              <ResetButton
                label={t("lesson.resetAll")}
                confirm={t("lesson.resetConfirmAll")}
                onConfirm={() => cards.forEach((c) => resetPart(c.key))}
              />
            </div>
          )}
        </div>
        <div className="part-grid">
          {cards.map(({ key, ...card }) => (
            <PartCard key={key} {...card} onReset={(ids) => resetPart(key, ids)} />
          ))}
        </div>
      </section>

      {lesson.sections.length > 0 && (
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
      )}
    </AppShell>
  );
}

type Pick = {
  /** Section id (listening, dictation) or 問題 number (written parts); what a partial reset is told. */
  id: string;
  label: string;
  title: string;
  href: string;
  done: number;
  total: number;
  /** The 問題 of this part opened last. */
  current: boolean;
};

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
  /** Jump straight to one 問題 of this part. */
  picks?: Pick[];
  extra?: ReactNode;
  /** Start this part over (all of it, or only the given 問題); offered once something in it has been done. */
  onReset?: (ids?: string[]) => void;
};

/** A button that asks once, in place, before doing something that deletes results. */
function ResetButton({ label, confirm, onConfirm }: { label: string; confirm: string; onConfirm: () => void }) {
  const { t } = useUiLanguage();
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className="btn btn--ghost btn--sm reset-btn" onClick={() => setAsking(true)}>
        <Icon name="refresh" size={15} />
        {label}
      </button>
    );
  }
  return (
    <div className="reset-confirm" role="alertdialog" aria-label={label}>
      <p>{confirm}</p>
      <div>
        <button
          type="button"
          className="btn btn--danger btn--sm"
          onClick={() => {
            setAsking(false);
            onConfirm();
          }}
        >
          {t("lesson.resetYes")}
        </button>
        <button type="button" className="btn btn--outline btn--sm" onClick={() => setAsking(false)}>
          {t("lesson.resetCancel")}
        </button>
      </div>
    </div>
  );
}

/** "Làm lại phần này": opens a dialog to choose which 問題 to redo; everything is chosen to begin with. */
function ResetPartButton({
  title,
  picks,
  onReset,
}: {
  title: string;
  picks: Pick[];
  onReset: (ids?: string[]) => void;
}) {
  const { t } = useUiLanguage();
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(true);
  const [chosen, setChosen] = useState<string[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const many = picks.length > 1;

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  function show() {
    setAll(true);
    setChosen([]);
    setOpen(true);
  }
  function toggle(id: string) {
    const base = all ? [] : chosen;
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    // Nothing picked, or everything picked, is the same as "all".
    const everything = next.length === 0 || next.length === picks.length;
    setAll(everything);
    setChosen(everything ? [] : next);
  }

  return (
    <>
      <button type="button" className="btn btn--outline btn--sm part-card__reset" onClick={show}>
        <Icon name="refresh" size={15} />
        {t("lesson.resetPart")}
      </button>
      {open && (
        <div
          className="reset-modal"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            className="reset-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
          >
            <h3 id="reset-dialog-title">
              {t("lesson.resetTitle")} <small>{title}</small>
            </h3>
            <p>{many ? t("lesson.resetHint") : t("lesson.resetConfirmPart")}</p>
            {many && (
              <div className="reset-dialog__picks" role="group" aria-label={t("lesson.pickMondai")}>
                <button
                  type="button"
                  className={`reset-chip reset-chip--all${all ? " is-on" : ""}`}
                  aria-pressed={all}
                  onClick={() => {
                    setAll(true);
                    setChosen([]);
                  }}
                >
                  {t("lesson.resetEvery")}
                </button>
                {picks.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`reset-chip jp${!all && chosen.includes(p.id) ? " is-on" : ""}`}
                    aria-pressed={!all && chosen.includes(p.id)}
                    title={p.title}
                    onClick={() => toggle(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
            <div className="reset-dialog__actions">
              <button type="button" className="btn btn--outline btn--sm" onClick={() => setOpen(false)}>
                {t("lesson.resetCancel")}
              </button>
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={() => {
                  setOpen(false);
                  onReset(all ? undefined : chosen);
                }}
              >
                {t("lesson.resetYes")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PartCard({ kanji, tone, unit, title, desc, done, total, href, picks, extra, onReset }: Omit<PartCardProps, "key">) {
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
      {picks && picks.length > 1 && (
        <nav className="part-card__picks" aria-label={`${title} · ${t("lesson.pickMondai")}`}>
          <span className="part-card__picks-label">{t("lesson.pickMondai")}</span>
          <div>
            {picks.map((p) => (
              <Link
                key={p.href}
                to={p.href}
                className={`part-pick jp${p.current ? " is-current" : ""}`}
                style={{ ["--pct" as string]: `${p.total ? Math.round((Math.min(p.done, p.total) / p.total) * 100) : 0}%` }}
                title={`${p.title} · ${Math.min(p.done, p.total)}/${p.total}`}
                aria-current={p.current ? "true" : undefined}
              >
                {p.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
      <div className="part-card__cta">
        <Link to={href} className={`btn ${shown > 0 ? "btn--primary" : "btn--outline"}`}>
          {shown > 0 && shown < total ? t("paper.continue") : t("paper.start")}
        </Link>
        {extra}
        {shown > 0 && onReset && <ResetPartButton title={title} picks={picks ?? []} onReset={onReset} />}
      </div>
    </article>
  );
}
