import { Link, useParams, useSearchParams } from "react-router-dom";
import { DictationWorkspace } from "../features/dictation/DictationWorkspace";
import { usePractice } from "../shared/content/hooks";
import { getLocalizedText } from "../shared/content/getLocalizedText";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { AppShell } from "../shared/ui/AppShell";

export function DictationPage() {
  const { lessonId = "" } = useParams();
  const [params] = useSearchParams();
  const sectionId = params.get("section") ?? undefined;
  const { practice, error, loading } = usePractice(lessonId, sectionId);
  const { t } = useUiLanguage();

  return (
    <AppShell wide>
      <div style={{ marginBottom: "1rem" }}>
        <Link
          to={`/lessons/${encodeURIComponent(lessonId)}`}
          style={{
            fontSize: "0.9rem",
            color: "var(--text-muted)",
            fontWeight: 500,
          }}
        >
          {t("dictation.backLesson")}
        </Link>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-muted)" }}>
          ⏳ Đang tải bài luyện chép chính tả...
        </div>
      )}

      {error && (
        <div className="card-glass" style={{ color: "#ef4444", borderColor: "#f87171", padding: "1.25rem", textAlign: "center" }}>
          Lỗi: {error}
        </div>
      )}

      {practice && (
        <>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "1.5rem", color: "var(--text-main)" }}>
            {getLocalizedText(practice.title, "vi")}
          </h1>
          <DictationWorkspace
            lessonId={lessonId}
            practice={practice}
            sectionId={sectionId}
          />
        </>
      )}
    </AppShell>
  );
}
