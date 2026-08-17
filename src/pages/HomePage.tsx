import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listLessons, type LessonSummary } from "../shared/api/content";
import { loadResume } from "../shared/storage/resumeStore";
import { AppShell } from "../shared/ui/AppShell";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { useLevel, type JlptLevel } from "../shared/context/LevelContext";

export function HomePage() {
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { level: selectedLevel, setLevel: setSelectedLevel, getLevelLabel } = useLevel();
  const { t } = useUiLanguage();
  const resume = loadResume();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listLessons();
        if (!cancelled) setLessons(data.lessons);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Không tải được danh sách bài học"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const levels: JlptLevel[] = ["ALL", "N1", "N2", "N3", "N4", "N5"];

  const filteredLessons = lessons.filter((l) => {
    if (selectedLevel === "ALL") return true;
    return String(l.source?.level || "").toUpperCase() === selectedLevel;
  });

  return (
    <AppShell wide>
      <section className="home-hero">
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "0.35rem 1rem",
            borderRadius: 99,
            background: "var(--primary-light)",
            color: "var(--primary-color)",
            fontSize: "0.85rem",
            fontWeight: 600,
            marginBottom: "1rem",
          }}
        >
          <span>✨</span>
          <span>JLPT Dictation & Listening</span>
        </div>
        <h1>{t("home.heroTitle")}</h1>
        <p>{t("home.heroSub")}</p>
      </section>

      {resume && (
        <section className="card-glass home-resume">
          <div>
            <div
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--primary-color)",
                marginBottom: 4,
              }}
            >
              ⚡ tiếp tục bài học gần nhất
            </div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>
              {resume.lesson_id}
              {resume.segment_id ? ` · ${resume.segment_id}` : ""}
            </div>
          </div>
          <Link
            to={`/lessons/${encodeURIComponent(resume.lesson_id)}/dictation${
              resume.section_id
                ? `?section=${encodeURIComponent(resume.section_id)}`
                : ""
            }`}
            className="btn-base btn-primary"
          >
            {t("home.startPractice")} →
          </Link>
        </section>
      )}

      <section style={{ marginBottom: "2rem" }}>
        <div className="home-lessons-head">
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
            {t("nav.lessons")}
          </h2>

          <div className="home-level-chips">
            {levels.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setSelectedLevel(lvl)}
                className={`home-level-chip${selectedLevel === lvl ? " is-active" : ""}`}
              >
                {getLevelLabel(lvl)}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-muted)" }}>
            ⏳ Đang tải bài học...
          </div>
        )}

        {error && (
          <div
            className="card-glass"
            style={{
              padding: "1.25rem",
              borderColor: "#f87171",
              color: "#ef4444",
            }}
          >
            Lỗi: {error}. Vui lòng kiểm tra backend server.
          </div>
        )}

        {!loading && !error && filteredLessons.length === 0 && (
          <div
            className="card-glass"
            style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}
          >
            Chưa tìm thấy bài học nào phù hợp.
          </div>
        )}

        <div className="home-lesson-grid">
          {filteredLessons.map((l) => {
            const level = String(l.source?.level || "N2");
            const dateStr = [l.source?.year, l.source?.month].filter(Boolean).join("/");
            return (
              <Link
                key={l.id}
                to={`/lessons/${encodeURIComponent(l.id)}`}
                className="card-glass"
                style={{
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "0.75rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        padding: "0.2rem 0.6rem",
                        borderRadius: "6px",
                        background: "var(--primary-light)",
                        color: "var(--primary-color)",
                      }}
                    >
                      {level}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-subtle)" }}>
                      {dateStr}
                    </span>
                  </div>

                  <h3
                    style={{
                      margin: "0 0 0.25rem",
                      fontSize: "1.15rem",
                      fontWeight: 700,
                      color: "var(--text-main)",
                    }}
                  >
                    {l.title.vi || l.title.ja}
                  </h3>
                  <div
                    style={{
                      fontSize: "0.9rem",
                      color: "var(--text-muted)",
                      marginBottom: "1rem",
                      fontFamily: '"Hiragino Sans", "Noto Sans JP", sans-serif',
                    }}
                  >
                    {l.title.ja}
                  </div>
                </div>

                <div
                  style={{
                    paddingTop: "0.85rem",
                    borderTop: "1px solid var(--border-color)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
                    flexWrap: "wrap",
                    gap: 6,
                  }}
                >
                  <span>
                    💬 {l.counts.questions} {t("home.questionCount")}
                  </span>
                  <span>
                    ✍️ {l.counts.dictation_segments} {t("home.dictationCount")}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
