import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { isPaperPart, PARTS, PART_KANJI } from "../features/paper/paperLabels";
import { PaperWorkspace } from "../features/paper/PaperWorkspace";
import { usePaperPractice } from "../features/paper/usePaperPractice";
import { useLesson } from "../shared/content/hooks";
import { getLocalizedText } from "../shared/content/getLocalizedText";
import { lessonShortTitle } from "../shared/content/lessonLabels";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { touchLesson } from "../shared/storage/lessonActivityStore";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";

export function PaperPage() {
  const { lessonId = "", part } = useParams();
  const { t, uiLang } = useUiLanguage();
  const { lesson } = useLesson(lessonId);
  const { paper, error, loading } = usePaperPractice(lessonId);

  useEffect(() => touchLesson(lessonId), [lessonId]);

  const lessonHref = `/lessons/${encodeURIComponent(lessonId)}`;
  if (!isPaperPart(part)) return <Navigate to={lessonHref} replace />;

  const fallback = (lesson && getLocalizedText(lesson.title, uiLang)) || lessonId;

  return (
    <AppShell
      breadcrumbs={[
        { label: t("nav.practice"), to: "/lessons" },
        { label: lessonShortTitle(lesson?.source, fallback), to: lessonHref },
        { label: t(`paper.title.${part}` as const) },
      ]}
    >
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
        <>
          <div className="paper-topbar">
            <Link to={`${lessonHref}/paper`} className="paper-back">
              <span aria-hidden="true">‹</span>
              {t("paper.sectionTitle")}
            </Link>
          </div>
          <div className="paper-parts" role="tablist" aria-label={t("paper.sectionTitle")}>
            {PARTS.map((p) => (
              <Link
                key={p}
                role="tab"
                aria-selected={p === part}
                to={`${lessonHref}/paper/${p}`}
                className={`paper-parts__tab${p === part ? " is-active" : ""}`}
              >
                <span className="paper-parts__kanji" aria-hidden="true">
                  {PART_KANJI[p]}
                </span>
                {t(`paper.title.${p}` as const)}
                <small>{paper.counts[p]}</small>
              </Link>
            ))}
          </div>
          <PaperWorkspace key={part} lessonId={lessonId} paper={paper} part={part} />
        </>
      )}
    </AppShell>
  );
}
