import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ExamSetup } from "../features/paper/ExamSetup";
import { usePaperPractice } from "../features/paper/usePaperPractice";
import { scoreBySection } from "../features/listening/listeningUnits";
import type { ExamScope } from "../shared/api/paper";
import { getLocalizedText } from "../shared/content/getLocalizedText";
import { useLesson, usePractice } from "../shared/content/hooks";
import { lessonShortTitle, lessonTitle } from "../shared/content/lessonLabels";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";

const SCOPES: ExamScope[] = ["all", "vocab", "grammar", "reading", "listening"];

/** Where a sitting starts: choose the part (written or listening) and the time. */
export function PaperExamSetupPage() {
  const { lessonId = "" } = useParams();
  const [params] = useSearchParams();
  const { t, uiLang } = useUiLanguage();
  const { lesson } = useLesson(lessonId);
  const { paper, loading: paperLoading } = usePaperPractice(lessonId);
  const { practice, loading: practiceLoading } = usePractice(lessonId);

  const lessonHref = `/lessons/${encodeURIComponent(lessonId)}`;
  const fallback = (lesson && getLocalizedText(lesson.title, uiLang)) || lessonId;
  const crumbs = [
    { label: t("nav.exams"), to: "/exams" },
    { label: lessonShortTitle(lesson?.source, fallback), to: lessonHref },
    { label: t("exam.setup.eyebrow") },
  ];

  const listeningCount = useMemo(() => (practice ? scoreBySection(practice, {}).total : 0), [practice]);
  const loading = paperLoading || practiceLoading;
  const requested = params.get("scope") as ExamScope | null;
  const initialScope = requested && SCOPES.includes(requested) ? requested : undefined;

  return (
    <AppShell breadcrumbs={crumbs}>
      {loading && <div className="notice">{t("dictation.loading")}</div>}
      {!loading && !paper && listeningCount === 0 && (
        <div className="notice notice--error" role="alert">
          <Icon name="alert" />
          {t("paper.notAvailable")}
          <Link to={lessonHref} className="btn btn--outline btn--sm" style={{ marginLeft: "auto" }}>
            {t("paper.backToLesson")}
          </Link>
        </div>
      )}
      {!loading && (paper || listeningCount > 0) && (
        <ExamSetup
          lessonId={lessonId}
          paper={paper}
          listeningCount={listeningCount}
          initialScope={initialScope}
          lessonLabel={lesson ? lessonTitle(lesson.source, fallback) : lessonId}
        />
      )}
    </AppShell>
  );
}
