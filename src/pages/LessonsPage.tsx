import { AppShell } from "../shared/ui/AppShell";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { LessonGrid, LevelFilter, useLessonList } from "../features/lessons/LessonGrid";

export function LessonsPage() {
  const { t } = useUiLanguage();
  const { lessons, loading, error } = useLessonList();

  return (
    <AppShell title={t("nav.practice")}>
      <div className="page-head">
        <div>
          <h1>{t("nav.practice")}</h1>
          <p>{t("home.lessonsSub")}</p>
        </div>
        <div className="page-head__aside">
          <LevelFilter />
        </div>
      </div>
      <LessonGrid lessons={lessons} loading={loading} error={error} />
    </AppShell>
  );
}
