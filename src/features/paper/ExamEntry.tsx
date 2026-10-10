import { Link } from "react-router-dom";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { PRESET_MINUTES } from "../../shared/storage/paperExamStore";

/** The door to the exam room on a lesson page. */
export function ExamEntry({
  lessonId,
  hasWritten = true,
  hasListening = false,
}: {
  lessonId: string;
  hasWritten?: boolean;
  hasListening?: boolean;
}) {
  const { t } = useUiLanguage();
  const setup = `/lessons/${encodeURIComponent(lessonId)}/paper/exam/setup`;
  return (
    <section className="exam-entry" aria-label={t("exam.title")}>
      <div className="exam-entry__main">
        <div className="exam-entry__stamp" aria-hidden="true">
          <span className="jp">試</span>
          <small>{t("exam.stamp")}</small>
        </div>
        <div className="exam-entry__copy">
          <h2>{t("exam.entry.title")}</h2>
          <p>{t("exam.entry.desc")}</p>
        </div>
      </div>
      <div className="exam-entry__side">
        <div>
          <span className="exam-entry__label">{t("exam.entry.time")}</span>
          <ul className="exam-entry__mins">
            {PRESET_MINUTES.map((m) => (
              <li key={m}>{m}&apos;</li>
            ))}
            <li className="is-custom">{t("exam.entry.custom")}</li>
          </ul>
        </div>
        <div className="exam-entry__ctas">
          {hasWritten && (
            <Link to={setup} className="exam-entry__cta">
              {t("exam.entry.cta")}
              <span aria-hidden="true">→</span>
            </Link>
          )}
          {hasListening && (
            <Link to={`${setup}?scope=listening`} className={hasWritten ? "exam-entry__cta exam-entry__cta--alt" : "exam-entry__cta"}>
              {hasWritten ? t("exam.entry.listenCta") : t("exam.entry.cta")}
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
