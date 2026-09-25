import { useParams, useSearchParams } from "react-router-dom";
import { DictationWorkspace, type PartLink } from "../features/dictation/DictationWorkspace";
import { useLesson, usePractice } from "../shared/content/hooks";
import { getLocalizedText } from "../shared/content/getLocalizedText";
import { lessonShortTitle, partLabel, partType } from "../shared/content/lessonLabels";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";

export function DictationPage() {
  const { lessonId = "" } = useParams();
  const [params] = useSearchParams();
  const sectionId = params.get("section") ?? undefined;
  const questionId = params.get("question") ?? undefined;
  const { practice, error, loading } = usePractice(lessonId, sectionId);
  const { lesson } = useLesson(lessonId);
  const { t, uiLang } = useUiLanguage();

  const lessonHref = `/lessons/${encodeURIComponent(lessonId)}`;
  const source = practice?.source ?? lesson?.source;
  const fallback = (practice && getLocalizedText(practice.title, uiLang)) || lessonId;

  const parts: PartLink[] | undefined = lesson?.sections.map((s) => ({
    id: s.id,
    label: `問${s.order}`,
    href: `${lessonHref}/dictation?section=${encodeURIComponent(s.id)}`,
    active: s.id === sectionId,
  }));
  const partsWithAll = parts && [
    { label: t("dictation.allSections"), href: `${lessonHref}/dictation`, active: !sectionId },
    ...parts,
  ];

  const currentSection = sectionId ? lesson?.sections.find((s) => s.id === sectionId) : undefined;
  const sectionTypeLabel = currentSection
    ? partLabel(partType(source, currentSection.order), uiLang)
    : undefined;

  return (
    <AppShell
      breadcrumbs={[
        { label: t("nav.practice"), to: "/lessons" },
        { label: lessonShortTitle(source, fallback), to: lessonHref },
        { label: t("lesson.dictationTitle") },
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
        <DictationWorkspace
          key={sectionId ?? "all"}
          lessonId={lessonId}
          practice={practice}
          sectionId={sectionId}
          initialQuestionId={questionId}
          parts={partsWithAll}
          lessonHref={lessonHref}
          sectionTypeLabel={sectionTypeLabel || undefined}
        />
      )}
    </AppShell>
  );
}
