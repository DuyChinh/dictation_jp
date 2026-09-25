import { Link } from "react-router-dom";
import { loadResume } from "../shared/storage/resumeStore";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { lessonShortTitle } from "../shared/content/lessonLabels";
import {
  LessonGrid,
  LevelFilter,
  correctCountFor,
  useLessonList,
} from "../features/lessons/LessonGrid";

/** Static sample shown in the hero: how a checked sentence looks. */
function PracticePreview() {
  const { t } = useUiLanguage();
  return (
    <div className="preview" aria-hidden="true">
      <div className="preview__player">
        <span className="preview__play">
          <Icon name="play" size={18} />
        </span>
        <div style={{ flex: 1 }}>
          <div className="preview__meta">
            <span>問題1 · {t("dictation.questionLabel")} 1</span>
            <span className="tabular">00:30.6 – 00:33.5</span>
          </div>
          <div className="progress">
            <span style={{ width: "58%" }} />
          </div>
        </div>
      </div>
      <div className="preview__sentence">
        <span className="tok-ok">本に</span>
        <span className="tok-ok">カバーを</span>
        <span className="tok-acc">つける</span>
        <span className="tok-ok">のは</span>
        <span className="tok-ok">私が</span>
        <span className="tok-bad">担当</span>
        <span className="tok-ok">するね。</span>
      </div>
      <div className="preview__translation">
        <strong style={{ color: "var(--text-main)" }}>{t("dictation.translation")} · </strong>
        Việc bọc bìa cho sách thì anh sẽ phụ trách nhé.
      </div>
      <ResultLegend />
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
        <PracticePreview />
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
          </div>
        </div>
        <LessonGrid lessons={lessons} loading={loading} error={error} />
      </section>
    </AppShell>
  );
}
