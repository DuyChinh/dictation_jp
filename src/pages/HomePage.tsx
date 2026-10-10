import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PRICING_READY } from "../config/pricing";
import { sortLessons } from "../features/lessons/lessonSearch";
import { useLevel, type JlptLevel } from "../shared/context/LevelContext";
import { formatClock, listRunningExams } from "../shared/storage/paperExamStore";
import { loadResume } from "../shared/storage/resumeStore";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { lessonKind, lessonShortTitle, lessonSitting } from "../shared/content/lessonLabels";
import {
  LessonGrid,
  LevelFilter,
  correctCountFor,
  useLessonList,
} from "../features/lessons/LessonGrid";

/** Static sample shown in the hero: the four parts of an exam and the 問題 each one covers. */
function ExamPreview({ sitting }: { sitting: string }) {
  const { t } = useUiLanguage();
  const parts = [
    { kanji: "聴", tone: "listening", name: t("lesson.listeningPart"), range: "問題1 – 5" },
    { kanji: "語", tone: "vocab", name: t("paper.title.vocab"), range: "問題1 – 6" },
    { kanji: "文", tone: "grammar", name: t("paper.title.grammar"), range: "問題7 – 9" },
    { kanji: "読", tone: "reading", name: t("paper.title.reading"), range: "問題10 – 14" },
  ];
  return (
    <div className="preview" aria-hidden="true">
      <div className="preview__head">
        <strong>JLPT N2</strong>
        {sitting && <span className="tabular">{sitting}</span>}
      </div>
      <ul className="preview__parts">
        {parts.map((p) => (
          <li key={p.kanji}>
            <span className="preview__kanji" data-tone={p.tone}>
              {p.kanji}
            </span>
            <span className="preview__name">{p.name}</span>
            <span className="preview__range">{p.range}</span>
          </li>
        ))}
      </ul>
      <div className="preview__question">
        <p className="preview__stem">
          <span className="preview__stem-no">1</span>
          私が<u>担当</u>します。
        </p>
        <ol className="preview__choices">
          {["たんとう", "たんどう", "だんとう", "だんどう"].map((c, i) => (
            <li key={c} className={i === 0 ? "is-right" : undefined}>
              <span>{i + 1}</span>
              {c}
              {i === 0 && <Icon name="check" size={16} strokeWidth={2.4} />}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function ResultLegend() {
  const { t } = useUiLanguage();
  return (
    <div className="legend">
      <span>
        <i className="l-ok" />
        {t("dictation.legendCorrect")}
      </span>
      <span>
        <i className="l-acc" />
        {t("dictation.accepted")}
      </span>
      <span>
        <i className="l-bad" />
        {t("dictation.wrongMissing")}
      </span>
    </div>
  );
}

const CHOOSABLE: JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];

/** Three ways to study, each one a click away from the home page. */
function StudyPaths({ dictationHref }: { dictationHref: string }) {
  const { t } = useUiLanguage();
  const paths = [
    { to: "/lessons", icon: "book", title: t("home.path1"), desc: t("home.path1Desc"), tone: "practice" },
    { to: "/exams", icon: "clock", title: t("home.path2"), desc: t("home.path2Desc"), tone: "exam" },
    { to: dictationHref, icon: "headphones", title: t("home.path3"), desc: t("home.path3Desc"), tone: "dictation" },
  ] as const;
  return (
    <section aria-labelledby="home-paths-title">
      <div className="section-head">
        <div>
          <h2 id="home-paths-title">{t("home.pathTitle")}</h2>
        </div>
      </div>
      <div className="path-grid">
        {paths.map((p) => (
          <Link key={p.tone} to={p.to} className={`path-card path-card--${p.tone}`}>
            <span className="path-card__icon" aria-hidden="true">
              <Icon name={p.icon} size={22} />
            </span>
            <span className="path-card__text">
              <strong>{p.title}</strong>
              <span>{p.desc}</span>
            </span>
            <Icon name="chevronRight" size={18} strokeWidth={2} />
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Asked once, until a level is picked: the home page then points at tests of that level. */
function LevelAsk() {
  const { t } = useUiLanguage();
  const { level, setLevel } = useLevel();
  return (
    <div className="level-ask" role="group" aria-label={t("home.levelAsk")}>
      <span className="level-ask__q">{t("home.levelAsk")}</span>
      <div className="level-ask__chips">
        {CHOOSABLE.map((lv) => (
          <button key={lv} type="button" aria-pressed={level === lv} onClick={() => setLevel(lv)}>
            {lv}
          </button>
        ))}
      </div>
      <span className="level-ask__hint">{t("home.levelHint")}</span>
    </div>
  );
}

export function HomePage() {
  const { t } = useUiLanguage();
  const { level, chosen } = useLevel();
  const { lessons, loading, error } = useLessonList();
  const resume = loadResume();
  const resumeLesson = resume ? lessons.find((l) => l.id === resume.lesson_id) : undefined;
  const [runningExam] = useState(() => listRunningExams()[0]);
  const runningLesson = runningExam ? lessons.find((l) => l.id === runningExam.lessonId) : undefined;

  const resumeHref = resume
    ? `/lessons/${encodeURIComponent(resume.lesson_id)}/dictation${
        resume.section_id ? `?section=${encodeURIComponent(resume.section_id)}` : ""
      }`
    : "";
  const resumeTotal = resumeLesson?.counts.dictation_segments ?? 0;
  const resumeCorrect = resume ? correctCountFor(resume.lesson_id) : 0;
  const resumePct = resumeTotal ? Math.min(100, Math.round((resumeCorrect / resumeTotal) * 100)) : 0;

  /** Tests of the chosen level, newest sitting first: where "start" and the preview point. */
  const inLevel = useMemo(
    () =>
      sortLessons(
        lessons.filter((l) => level === "ALL" || String(l.source?.level ?? "").toUpperCase() === level),
        {},
      ),
    [lessons, level],
  );
  const startLesson = inLevel.find((l) => lessonKind(l.source) === "exam") ?? inLevel[0];
  const previewLesson = inLevel.find((l) => l.paper) ?? startLesson;
  const startHref = startLesson ? `/lessons/${encodeURIComponent(startLesson.id)}` : "/lessons";
  const dictationHref = startLesson ? `/lessons/${encodeURIComponent(startLesson.id)}/dictation` : "/lessons";

  return (
    <AppShell title={t("nav.home")}>
      <section className="hero">
        <div className="hero__copy">
          <span className="hero__eyebrow">{t("home.eyebrow")}</span>
          <h1 className="hero__title">
            {t("home.heroLine1")}
            <br />
            {t("home.heroLine2")}
          </h1>
          <p className="hero__sub">{t("home.heroSub")}</p>
          {!chosen && <LevelAsk />}
          <div className="hero__cta">
            <Link to={startHref} className="btn btn--primary btn--lg">
              {t("home.ctaStart")}
              <Icon name="chevronRight" size={18} strokeWidth={2} />
            </Link>
            {PRICING_READY ? (
              <Link to="/pricing" className="btn btn--outline btn--lg">
                {t("upsell.cta")}
              </Link>
            ) : (
              <Link to="/exams" className="btn btn--outline btn--lg">
                <Icon name="clock" size={18} />
                {t("home.path2")}
              </Link>
            )}
          </div>
          <ul className="trust">
            {(["home.trust1", "home.trust2", "home.trust3"] as const).map((k) => (
              <li key={k}>
                <Icon name="check" size={16} strokeWidth={2.2} />
                {t(k)}
              </li>
            ))}
          </ul>
        </div>
        <ExamPreview sitting={previewLesson ? lessonSitting(previewLesson.source) : ""} />
      </section>

      {runningExam ? (
        <section className="resume resume--exam" aria-label={t("home.resumeExam")}>
          <span className="resume__icon">
            <Icon name="clock" size={22} />
          </span>
          <div className="resume__body">
            <span className="eyebrow">{t("home.resumeExam")}</span>
            <span className="resume__title">
              {runningLesson ? lessonShortTitle(runningLesson.source, runningExam.lessonId) : runningExam.lessonId}
              {" · "}
              {runningExam.endsAt > Date.now()
                ? `${formatClock(runningExam.endsAt - Date.now())} ${t("home.resumeExamLeft")}`
                : t("exams.timeUp")}
            </span>
          </div>
          <Link
            to={`/lessons/${encodeURIComponent(runningExam.lessonId)}/paper/exam`}
            className="btn btn--dark"
            style={{ flexShrink: 0 }}
          >
            {t("home.resumeExamCta")}
          </Link>
        </section>
      ) : (
        resume && (
          <section className="resume" aria-label={t("home.resumeLabel")}>
            <span className="resume__icon">
              <Icon name="pencil" size={22} />
            </span>
            <div className="resume__body">
              <span className="eyebrow">{t("home.resumeLabel")}</span>
              <span className="resume__title">
                {resumeLesson ? lessonShortTitle(resumeLesson.source, resume.lesson_id) : resume.lesson_id} —{" "}
                {t("lesson.dictationTitle")}
              </span>
            </div>
            {resumeTotal > 0 && (
              <div className="resume__progress">
                <div className="resume__progress-label">
                  <span>{t("lesson.progress")}</span>
                  <span className="tabular">
                    {resumeCorrect} / {resumeTotal} {t("lesson.sentencesUnit")}
                  </span>
                </div>
                <div className="progress">
                  <span style={{ width: `${resumePct}%` }} />
                </div>
              </div>
            )}
            <Link to={resumeHref} className="btn btn--dark" style={{ flexShrink: 0 }}>
              {t("home.resumeCta")}
            </Link>
          </section>
        )
      )}

      <StudyPaths dictationHref={dictationHref} />

      <section>
        <div className="section-head">
          <div>
            <h2>{t("home.latestTitle")}</h2>
            <p>{t("home.latestSub")}</p>
          </div>
          <div className="section-head__aside">
            <LevelFilter />
            <Link to="/lessons" className="btn btn--soft btn--sm">
              {t("home.viewAll")}
              <Icon name="chevronRight" size={16} strokeWidth={2} />
            </Link>
          </div>
        </div>
        <LessonGrid lessons={lessons} loading={loading} error={error} limit={3} newestFirst />
      </section>
    </AppShell>
  );
}
