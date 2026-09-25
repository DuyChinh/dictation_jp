import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ListeningWorkspace } from "../features/listening/ListeningWorkspace";
import { usePractice } from "../shared/content/hooks";
import { getLocalizedText } from "../shared/content/getLocalizedText";
import { lessonShortTitle } from "../shared/content/lessonLabels";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";

export function ListeningPage() {
  const { lessonId = "" } = useParams();
  const [params] = useSearchParams();
  const sectionId = params.get("section") ?? undefined;
  const questionId = params.get("question") ?? undefined;
  const onlyParam = params.get("only") ?? "";
  const onlyQuestionIds = useMemo(
    () => (onlyParam ? onlyParam.split(",").filter(Boolean) : undefined),
    [onlyParam],
  );
  // Whole lesson: the score panel covers every part even when one part is open.
  const { practice, error, loading } = usePractice(lessonId);
  const { t, uiLang } = useUiLanguage();

  const lessonHref = `/lessons/${encodeURIComponent(lessonId)}`;
  const fallback = (practice && getLocalizedText(practice.title, uiLang)) || lessonId;

  return (
    <AppShell
      breadcrumbs={[
        { label: t("nav.practice"), to: "/lessons" },
        { label: lessonShortTitle(practice?.source, fallback), to: lessonHref },
        { label: t("listening.title") },
      ]}
    >
      {loading && <div className="notice">{t("dictation.loading")}</div>}

      {error && (
        <div className="notice notice--error" role="alert">
          <Icon name="alert" />
          {error}
        </div>
      )}

      {practice && !loading && (
        <ListeningWorkspace
          key={`${sectionId ?? "all"}:${onlyParam}`}
          lessonId={lessonId}
          practice={practice}
          sectionId={sectionId}
          initialQuestionId={questionId}
          onlyQuestionIds={onlyQuestionIds}
          basePath={`${lessonHref}/listening`}
          lessonHref={lessonHref}
        />
      )}
    </AppShell>
  );
}
