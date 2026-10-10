import { useMemo } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ExamResultView } from "../features/paper/ExamResultView";
import { getLocalizedText } from "../shared/content/getLocalizedText";
import { useLesson, usePractice } from "../shared/content/hooks";
import { lessonShortTitle } from "../shared/content/lessonLabels";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { clearExam, getExam, getExamSitting, type ExamSession } from "../shared/storage/paperExamStore";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";

type ResultProps = { lessonId: string; session: ExamSession; onRetake: () => void };

function WrittenResult({ lessonId, session, onRetake }: ResultProps) {
  return <ExamResultView lessonId={lessonId} session={session} sittingAt={session.startedAt} onRetake={onRetake} />;
}

/** The listening result names each part of the audio after the lesson's source, so it loads the lesson first. */
function ListeningResult({ lessonId, session, onRetake }: ResultProps) {
  const { practice } = usePractice(lessonId);
  return (
    <ExamResultView
      lessonId={lessonId}
      session={session}
      source={practice?.source}
      sittingAt={session.startedAt}
      onRetake={onRetake}
    />
  );
}

/** The result of one earlier sitting of a lesson, opened from the exam history. */
export function PaperExamResultPage() {
  const { lessonId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t, uiLang } = useUiLanguage();
  const { lesson } = useLesson(lessonId);
  const startedAt = Number(params.get("at")) || 0;
  const session = useMemo(() => (startedAt ? getExamSitting(lessonId, startedAt) : null), [lessonId, startedAt]);
  const listening = session?.scope === "listening";

  const lessonHref = `/lessons/${encodeURIComponent(lessonId)}`;
  const setupHref = `${lessonHref}/paper/exam/setup${listening ? "?scope=listening" : ""}`;
  const fallback = (lesson && getLocalizedText(lesson.title, uiLang)) || lessonId;
  const Result = listening ? ListeningResult : WrittenResult;
  const retake = () => {
    // A finished current sitting makes room for the new one; one still running is left for the setup page to offer.
    if (getExam(lessonId)?.submittedAt) clearExam(lessonId);
    navigate(setupHref);
  };
  const crumbs = [
    { label: t("nav.exams"), to: "/exams" },
    { label: t("exams.history"), to: "/exams/history" },
    { label: lessonShortTitle(lesson?.source, fallback) },
  ];

  return (
    <AppShell breadcrumbs={crumbs}>
      {!session ? (
        <div className="notice">
          <Icon name="clock" />
          {t("exams.sittingGone")}
          <Link to="/exams/history" className="paper-soft" style={{ marginLeft: "auto" }}>
            {t("exams.history")}
          </Link>
        </div>
      ) : (
        <Result lessonId={lessonId} session={session} onRetake={retake} />
      )}
    </AppShell>
  );
}
