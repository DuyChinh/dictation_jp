import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { LeaderboardLevel, LeaderboardPeriod, LeaderboardRow } from "../../shared/api/leaderboard";
import { useLevel } from "../../shared/context/LevelContext";
import { fmt } from "../../shared/i18n/format";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { useMyScore } from "../../shared/storage/myScoreStore";
import { Icon } from "../../shared/ui/Icon";
import { useAuth } from "../auth/AuthContext";
import { LeaderRow, LevelTabs, PeriodTabs, useLeaderboard } from "./leaderboardUi";

const HOME_ROWS = 5;

/** Home-page ranking: the top five for the learner's level, where they stand, and a way to the full list. */
export function LeaderboardCard() {
  const { t } = useUiLanguage();
  const { user } = useAuth();
  const { level: pickedLevel } = useLevel();
  const score = useMyScore(!!user);
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  const [level, setLevel] = useState<LeaderboardLevel>(pickedLevel);
  useEffect(() => setLevel(pickedLevel), [pickedLevel]);

  const { entries, me, loading, error, retry } = useLeaderboard(HOME_ROWS, period, level, score?.points);
  const meInTop = entries.some((e) => e.isMe);
  const maxPoints = entries[0]?.points ?? 0;
  const meRow: LeaderboardRow | null = me
    ? { rank: me.rank, name: me.name, avatar: me.avatar, points: me.points, totalPoints: me.totalPoints, level: me.level, isMe: true }
    : null;
  const hint = period === "week" ? t("lb.hintWeek") : period === "month" ? t("lb.hintMonth") : t("lb.hintYear");

  return (
    <section className="lb-card" aria-labelledby="lb-card-title">
      <div className="section-head">
        <div>
          <h2 id="lb-card-title" className="lb-card__title">
            <span className="lb-card__badge" aria-hidden="true">
              <Icon name="trophy" size={20} />
            </span>
            {t("lb.title")}
          </h2>
          <p>{hint}</p>
        </div>
        <div className="section-head__aside lb-card__actions">
          <PeriodTabs value={period} onChange={setPeriod} periods={["week", "month", "year"]} />
          <Link to={`/leaderboard?period=${period}&level=${level}`} className="btn btn--soft btn--sm">
            {t("lb.viewAll")}
            <Icon name="chevronRight" size={16} strokeWidth={2} />
          </Link>
        </div>
      </div>

      <LevelTabs value={level} onChange={setLevel} />

      <div className="lb-panel">
        {loading ? (
          <ol className="lb-list" aria-busy="true">
            {Array.from({ length: HOME_ROWS }, (_, i) => (
              <li key={i} className="lb-row lb-row--skeleton" />
            ))}
          </ol>
        ) : error ? (
          <div className="lb-empty">
            <p>{t("lb.error")}</p>
            <button type="button" className="btn btn--soft btn--sm" onClick={retry}>
              {t("lb.retry")}
            </button>
          </div>
        ) : entries.length === 0 ? (
          <p className="lb-empty">{level === "ALL" ? t("lb.periodEmpty") : t("lb.levelEmpty")}</p>
        ) : (
          <ol className="lb-list">
            {entries.map((e) => (
              <LeaderRow key={e.rank} entry={e} period={period} level={level} maxPoints={maxPoints} showBar={false} />
            ))}
          </ol>
        )}

        {user && meRow && !meInTop && !loading && !error && (
          <div className="lb-me">
            <span className="lb-me__label">{t("lb.yourRank")}</span>
            <ol className="lb-list">
              <LeaderRow entry={meRow} period={period} level={level} maxPoints={maxPoints} showBar={false} />
            </ol>
            {me?.ahead && (
              <span className="lb-me__of">
                <Icon name="arrowUp" size={13} strokeWidth={2.2} />
                {fmt(t("lb.ahead"), { n: me.ahead.gap, name: me.ahead.name })}
              </span>
            )}
          </div>
        )}

        {!user && !loading && (
          <div className="lb-guest">
            <p>{t("lb.guestCta")}</p>
            <Link to="/auth" className="btn btn--primary btn--sm">
              {t("lb.guestBtn")}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
