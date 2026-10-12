import { Link } from "react-router-dom";
import type { LessonSummary } from "../../shared/api/content";
import { lessonShortTitle } from "../../shared/content/lessonLabels";
import { getLocalizedText } from "../../shared/content/getLocalizedText";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { PART_KANJI } from "../paper/paperLabels";
import { timeAgo } from "../lessons/lessonSearch";
import { positionText, type ActivityKind, type Position } from "./recentActivity";

const KANJI: Record<ActivityKind, string> = { listening: "聴", dictation: "書", ...PART_KANJI };

/** Where the learner last worked, part by part: which exam, which part, which question, how long ago. */
export function RecentActivityList({
  positions,
  lessons,
}: {
  positions: Position[];
  lessons: Map<string, LessonSummary>;
}) {
  const { t, uiLang } = useUiLanguage();
  const now = Date.now();
  return (
    <ul className="recent-list">
      {positions.map((p) => {
        const lesson = lessons.get(p.lessonId);
        const name = lesson ? lessonShortTitle(lesson.source, getLocalizedText(lesson.title, uiLang) || p.lessonId) : p.lessonId;
        return (
          <li key={`${p.lessonId}|${p.kind}`}>
            <span className="recent-list__kanji jp" data-tone={p.kind} aria-hidden="true">
              {KANJI[p.kind]}
            </span>
            <div className="recent-list__main">
              <Link to={`/lessons/${encodeURIComponent(p.lessonId)}`} className="recent-list__lesson">
                {name}
              </Link>
              <span className="recent-list__where">{positionText(p, t)}</span>
            </div>
            <span className="recent-list__ago muted">{timeAgo(p.at, now, uiLang) ?? t("lessons.justNow")}</span>
            <Link to={p.href} className="btn btn--soft btn--sm">
              {t("home.recentCta")}
              <span aria-hidden="true">→</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
