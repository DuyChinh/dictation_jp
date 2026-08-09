import { Link, useParams } from "react-router-dom";
import { useLesson } from "../shared/content/hooks";
import { getLocalizedText } from "../shared/content/getLocalizedText";
import { useContentLanguage } from "../shared/content/LanguageProvider";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { AppShell } from "../shared/ui/AppShell";

export function LessonPage() {
  const { lessonId = "" } = useParams();
  const { translationLang } = useContentLanguage();
  const { t } = useUiLanguage();
  const { lesson, error, loading } = useLesson(lessonId);

  if (loading) {
    return (
      <AppShell>
        <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--text-muted)" }}>
          ⏳ Đang tải nội dung bài học...
        </div>
      </AppShell>
    );
  }

  if (error || !lesson) {
    return (
      <AppShell>
        <div className="card-glass" style={{ padding: "2rem", textAlign: "center" }}>
          <p style={{ color: "#ef4444", fontSize: "1.1rem", marginBottom: "1rem" }}>
            {error ?? "Không tìm thấy bài học này."}
          </p>
          <Link to="/" className="btn-base btn-primary">
            {t("lesson.back")}
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell wide>
      <div style={{ marginBottom: "1.5rem" }}>
        <Link
          to="/"
          style={{
            fontSize: "0.9rem",
            color: "var(--text-muted)",
            fontWeight: 500,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            minHeight: "var(--touch-min)",
          }}
        >
          {t("lesson.back")}
        </Link>
      </div>

      <div className="card-glass lesson-header-card">
        <div
          style={{
            display: "inline-block",
            fontSize: "0.75rem",
            fontWeight: 800,
            padding: "0.25rem 0.75rem",
            borderRadius: "6px",
            background: "var(--primary-light)",
            color: "var(--primary-color)",
            marginBottom: "0.75rem",
          }}
        >
          {String(lesson.source?.level || "JLPT")}
        </div>

        <h1>{getLocalizedText(lesson.title, translationLang)}</h1>
        <p
          style={{
            margin: "0 0 1rem",
            fontSize: "1.1rem",
            color: "var(--text-muted)",
            fontFamily: '"Hiragino Sans", "Noto Sans JP", sans-serif',
          }}
        >
          {lesson.title.ja}
        </p>

        <div
          style={{
            display: "flex",
            gap: 16,
            fontSize: "0.88rem",
            color: "var(--text-muted)",
            marginBottom: "1.5rem",
            flexWrap: "wrap",
          }}
        >
          <span>📂 {lesson.counts.sections} {t("home.sectionCount")}</span>
          <span>💬 {lesson.counts.questions} {t("home.questionCount")}</span>
          <span>✍️ {lesson.counts.dictation_segments} {t("home.dictationCount")}</span>
        </div>

        <div className="lesson-cta-row">
          <Link
            to={`/lessons/${encodeURIComponent(lesson.id)}/listening`}
            className="btn-base"
            style={{
              background: "var(--accent-light)",
              color: "var(--accent-color)",
              borderColor: "var(--accent-color)",
              fontWeight: 600,
            }}
          >
            🎧 {t("lesson.listeningMode")}
          </Link>
          <Link
            to={`/lessons/${encodeURIComponent(lesson.id)}/dictation`}
            className="btn-base btn-primary"
          >
            ✍️ {t("lesson.dictationMode")}
          </Link>
        </div>
      </div>

      <section>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "1rem" }}>
          {t("lesson.bySection")}
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {lesson.sections.map((s) => (
            <div key={s.id} className="card-glass lesson-section-row">
              <div>
                <div style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: 4 }}>
                  {getLocalizedText(s.title, translationLang)}{" "}
                  <span
                    style={{
                      fontWeight: 400,
                      color: "var(--text-muted)",
                      fontSize: "0.95rem",
                      marginLeft: 6,
                    }}
                  >
                    ({s.title.ja})
                  </span>
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-subtle)" }}>
                  {s.question_count} {t("home.questionCount")} · {s.dictation_segment_count}{" "}
                  {t("home.dictationCount")}
                </div>
              </div>

              <div className="lesson-section-actions">
                <Link
                  to={`/lessons/${encodeURIComponent(lesson.id)}/listening?section=${encodeURIComponent(s.id)}`}
                  className="btn-base"
                  style={{ fontSize: "0.85rem", padding: "0.45rem 0.9rem" }}
                >
                  {t("lesson.startListening")}
                </Link>
                <Link
                  to={`/lessons/${encodeURIComponent(lesson.id)}/dictation?section=${encodeURIComponent(s.id)}`}
                  className="btn-base btn-primary"
                  style={{ fontSize: "0.85rem", padding: "0.45rem 0.9rem" }}
                >
                  {t("lesson.startDictation")}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
