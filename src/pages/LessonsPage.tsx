import { useSearchParams } from "react-router-dom";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { LessonGrid, LevelFilter, useLessonList, type StatusFilter } from "../features/lessons/LessonGrid";

const STATUSES: StatusFilter[] = ["all", "todo", "doing", "done"];

export function LessonsPage() {
  const { t } = useUiLanguage();
  const { lessons, loading, error } = useLessonList();
  // In the URL so going back from a lesson keeps the search and filter.
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const statusParam = params.get("status") as StatusFilter | null;
  const status = statusParam && STATUSES.includes(statusParam) ? statusParam : "all";

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

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
      <LessonGrid
        lessons={lessons}
        loading={loading}
        error={error}
        query={query}
        status={status}
        onStatusChange={(s) => setParam("status", s === "all" ? "" : s)}
        search={
          <label className="lesson-search">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={query}
              onChange={(e) => setParam("q", e.target.value)}
              placeholder={t("lessons.search")}
              aria-label={t("lessons.search")}
              autoComplete="off"
            />
          </label>
        }
      />
    </AppShell>
  );
}
