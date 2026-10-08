import { Link, useParams } from "react-router-dom";
import { ExamSetup } from "../features/paper/ExamSetup";
import { usePaperPractice } from "../features/paper/usePaperPractice";
import { getLocalizedText } from "../shared/content/getLocalizedText";
import { useLesson } from "../shared/content/hooks";
import { lessonShortTitle, lessonTitle } from "../shared/content/lessonLabels";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";

/** Where a sitting starts: choose the part and the time. */
export function PaperExamSetupPage() {
  const { lessonId = "" } = useParams();
  const { t, uiLang } = useUiLanguage();
  const { lesson } = useLesson(lessonId);
  const { paper, error, loading } = usePaperPractice(lessonId);

  const lessonHref = `/lessons/${encodeURIComponent(lessonId)}`;
  const fallback = (lesson && getLocalizedText(lesson.title, uiLang)) || lessonId;
  const crumbs = [
    { label: t("nav.practice"), to: "/lessons" },
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
      {paper && (
        <ExamSetup
          lessonId={lessonId}
          paper={paper}
          lessonLabel={lesson ? lessonTitle(lesson.source, fallback) : lessonId}
        />
      )}
    </AppShell>
  );
}
