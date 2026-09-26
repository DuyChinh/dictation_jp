import { useEffect } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { DictationWorkspace, type PartLink } from "../features/dictation/DictationWorkspace";
import { useLesson, usePractice } from "../shared/content/hooks";
import type { LessonDetail } from "../shared/api/content";
import { getLocalizedText } from "../shared/content/getLocalizedText";
import { lessonShortTitle, partLabel, partType } from "../shared/content/lessonLabels";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { touchLesson } from "../shared/storage/lessonActivityStore";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";

export function DictationPage() {
  const { lessonId = "" } = useParams();
  const [params] = useSearchParams();
  const sectionId = params.get("section") ?? undefined;
  const { lesson, loading } = useLesson(lessonId);
  const { t } = useUiLanguage();

  // There is no whole-lesson mode: a link without a section opens the first one.
  if (!sectionId) {
    if (loading) return <AppShell><div className="notice">{t("dictation.loading")}</div></AppShell>;
    const first = lesson?.sections[0];
    if (first) {
      const next = new URLSearchParams(params);
      next.set("section", first.id);
      return <Navigate replace to={`?${next.toString()}`} />;
    }
  }

  return <DictationContent lessonId={lessonId} lesson={lesson} sectionId={sectionId} />;
}

function DictationContent({
  lessonId,
  lesson,
  sectionId,
}: {
  lessonId: string;
  lesson: LessonDetail | null;
  sectionId: string | undefined;
}) {
  const [params] = useSearchParams();
  const questionId = params.get("question") ?? undefined;
  const { practice, error, loading } = usePractice(lessonId, sectionId);
  const { t, uiLang } = useUiLanguage();

  useEffect(() => touchLesson(lessonId), [lessonId]);

  const lessonHref = `/lessons/${encodeURIComponent(lessonId)}`;
  const source = practice?.source ?? lesson?.source;
  const fallback = (practice && getLocalizedText(practice.title, uiLang)) || lessonId;

  const parts: PartLink[] | undefined = lesson?.sections.map((s) => ({
    id: s.id,
    label: `問${s.order}`,
    href: `${lessonHref}/dictation?section=${encodeURIComponent(s.id)}`,
    active: s.id === sectionId,
  }));

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
          parts={parts}
          lessonHref={lessonHref}
          sectionTypeLabel={sectionTypeLabel || undefined}
        />
      )}
    </AppShell>
  );
}
