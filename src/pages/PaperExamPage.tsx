import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ExamListeningRunner } from "../features/paper/ExamListeningRunner";
import { ExamResultView } from "../features/paper/ExamResultView";
import { ExamRunner } from "../features/paper/ExamRunner";
import { usePaperPractice } from "../features/paper/usePaperPractice";
import { getLocalizedText } from "../shared/content/getLocalizedText";
import { useLesson, usePractice } from "../shared/content/hooks";
import { lessonShortTitle } from "../shared/content/lessonLabels";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { clearExam, getExam, type ExamSession } from "../shared/storage/paperExamStore";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";

function WrittenExam() {
  const { lessonId = "" } = useParams();
  const navigate = useNavigate();
  const { t, uiLang } = useUiLanguage();
  const { lesson } = useLesson(lessonId);
  const { paper, error, loading } = usePaperPractice(lessonId);
  const [session, setSession] = useState<ExamSession | null>(() => getExam(lessonId));

  const lessonHref = `/lessons/${encodeURIComponent(lessonId)}`;
  const overviewHref = `${lessonHref}/paper`;
  const fallback = (lesson && getLocalizedText(lesson.title, uiLang)) || lessonId;
  const crumbs = [
    { label: t("nav.exams"), to: "/exams" },
    { label: lessonShortTitle(lesson?.source, fallback), to: lessonHref },
    { label: t("exam.title") },
  ];

  return (
    <AppShell breadcrumbs={crumbs}>
      {loading && <div className="notice">{t("dictation.loading")}</div>}

      {!loading && (error || !paper) && (
        <div className="notice notice--error" role="alert">
          <Icon name="alert" />
          {t("paper.notAvailable")}
          <Link to={lessonHref} className="btn btn--outline btn--sm" style={{ marginLeft: "auto" }}>
            {t("paper.backToLesson")}
          </Link>
        </div>
      )}

      {paper && !session && (
        <div className="notice">
          <Icon name="clock" />
          {t("exam.noSession")}
          <Link to={`${overviewHref}/exam/setup`} className="paper-soft" style={{ marginLeft: "auto" }}>
            {t("exam.title")}
          </Link>
        </div>
      )}

      {paper && session && !session.submittedAt && (
        <ExamRunner lessonId={lessonId} paper={paper} session={session} onChange={setSession} />
      )}

      {paper && session?.submittedAt && (
        <ExamResultView
          lessonId={lessonId}
          session={session}
          onRetake={() => {
            clearExam(lessonId);
            setSession(null);
            navigate(`${overviewHref}/exam/setup`);
          }}
        />
      )}
    </AppShell>
  );
}

/** A timed listening sitting: the audio of each question plays by itself, and the result comes on submit. */
function ListeningExam() {
  const { lessonId = "" } = useParams();
  const navigate = useNavigate();
  const { t, uiLang } = useUiLanguage();
  const { lesson } = useLesson(lessonId);
  const { practice, error, loading } = usePractice(lessonId);
  const [session, setSession] = useState<ExamSession | null>(() => getExam(lessonId));

  const lessonHref = `/lessons/${encodeURIComponent(lessonId)}`;
  const setupHref = `${lessonHref}/paper/exam/setup?scope=listening`;
  const fallback = (lesson && getLocalizedText(lesson.title, uiLang)) || lessonId;
  const crumbs = [
    { label: t("nav.exams"), to: "/exams" },
    { label: lessonShortTitle(lesson?.source, fallback), to: lessonHref },
    { label: t("exam.scope.listening") },
  ];

  return (
    <AppShell breadcrumbs={crumbs}>
      {loading && <div className="notice">{t("dictation.loading")}</div>}

      {!loading && (error || !practice) && (
        <div className="notice notice--error" role="alert">
          <Icon name="alert" />
          {t("paper.notAvailable")}
          <Link to={lessonHref} className="btn btn--outline btn--sm" style={{ marginLeft: "auto" }}>
            {t("paper.backToLesson")}
          </Link>
        </div>
      )}

      {practice && !session && (
        <div className="notice">
          <Icon name="clock" />
          {t("exam.noSession")}
          <Link to={setupHref} className="paper-soft" style={{ marginLeft: "auto" }}>
            {t("exam.title")}
          </Link>
        </div>
      )}

      {practice && session && !session.submittedAt && (
        <ExamListeningRunner lessonId={lessonId} practice={practice} session={session} onChange={setSession} />
      )}

      {practice && session?.submittedAt && (
        <ExamResultView
          lessonId={lessonId}
          session={session}
          source={practice.source}
          onRetake={() => {
            clearExam(lessonId);
            setSession(null);
            navigate(setupHref);
          }}
        />
      )}
    </AppShell>
  );
}

/** The exam page picks the written or the listening room from the sitting stored for this lesson. */
export function PaperExamPage() {
  const { lessonId = "" } = useParams();
  const scope = useMemo(() => getExam(lessonId)?.scope, [lessonId]);
  return scope === "listening" ? <ListeningExam /> : <WrittenExam />;
}
