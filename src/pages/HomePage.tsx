import { Link } from "react-router-dom";
import { loadResume } from "../shared/storage/resumeStore";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { lessonShortTitle } from "../shared/content/lessonLabels";
import {
  LessonGrid,
  LevelFilter,
  ViewToggle,
  correctCountFor,
  useLessonList,
} from "../features/lessons/LessonGrid";

/** Static sample shown in the hero: the four parts of an exam and the 問題 each one covers. */
function ExamPreview() {
  const { t } = useUiLanguage();
  const parts = [
    { kanji: "聴", name: t("lesson.listeningPart"), range: "問題1 – 5" },
    { kanji: "語", name: t("paper.title.vocab"), range: "問題1 – 6" },
    { kanji: "文", name: t("paper.title.grammar"), range: "問題7 – 9" },
    { kanji: "読", name: t("paper.title.reading"), range: "問題10 – 14" },
  ];
  return (
    <div className="preview" aria-hidden="true">
      <div className="preview__head">
        <strong>JLPT N2</strong>
        <span className="tabular">12/2023</span>
      </div>
      <ul className="preview__parts">
        {parts.map((p) => (
          <li key={p.kanji}>
            <span className="preview__kanji">{p.kanji}</span>
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

export function HomePage() {
  const { t } = useUiLanguage();
  const { lessons, loading, error } = useLessonList();
  const resume = loadResume();
  const resumeLesson = resume ? lessons.find((l) => l.id === resume.lesson_id) : undefined;

  const resumeHref = resume
    ? `/lessons/${encodeURIComponent(resume.lesson_id)}/dictation${
        resume.section_id ? `?section=${encodeURIComponent(resume.section_id)}` : ""
      }`
    : "";
  const resumeTotal = resumeLesson?.counts.dictation_segments ?? 0;
  const resumeCorrect = resume ? correctCountFor(resume.lesson_id) : 0;
  const resumePct = resumeTotal ? Math.min(100, Math.round((resumeCorrect / resumeTotal) * 100)) : 0;
  const firstLesson = lessons[0];

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
          <div className="hero__cta">
            <Link
              to={firstLesson ? `/lessons/${encodeURIComponent(firstLesson.id)}` : "/lessons"}
              className="btn btn--primary btn--lg"
            >
              {t("home.ctaStart")}
              <Icon name="chevronRight" size={18} strokeWidth={2} />
            </Link>
            <Link to="/pricing" className="btn btn--outline btn--lg">
              {t("upsell.cta")}
            </Link>
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
        <ExamPreview />
      </section>

      {resume && (
        <section className="resume" aria-label={t("home.resumeLabel")}>
          <span className="resume__icon">
            <Icon name="pencil" size={22} />
          </span>
          <div className="resume__body">
            <span className="eyebrow">{t("home.resumeLabel")}</span>
            <span className="resume__title">
              {resumeLesson
                ? lessonShortTitle(resumeLesson.source, resume.lesson_id)
                : resume.lesson_id}{" "}
              — {t("lesson.dictationTitle")}
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
      )}

      <section>
        <div className="section-head">
          <div>
            <h2>{t("nav.practice")}</h2>
            <p>{t("home.lessonsSub")}</p>
          </div>
          <div className="section-head__aside">
            <LevelFilter />
            <ViewToggle />
          </div>
        </div>
        <LessonGrid lessons={lessons} loading={loading} error={error} />
      </section>
    </AppShell>
  );
}
