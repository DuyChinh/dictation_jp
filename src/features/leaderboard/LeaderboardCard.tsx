import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { fmt } from "../../shared/i18n/format";
import { useMyScore } from "../../shared/storage/myScoreStore";
import { Icon } from "../../shared/ui/Icon";
import type { LeaderboardPeriod } from "../../shared/api/leaderboard";
import { LeaderAvatar, PeriodTabs, formatPoints, useLeaderboard } from "./leaderboardUi";

const HOME_ROWS = 5;

/** Home-page ranking: the top five, where the signed-in learner stands, and a way to the full list. */
export function LeaderboardCard() {
  const { t, uiLang } = useUiLanguage();
  const { user } = useAuth();
  const score = useMyScore(!!user);
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  const { entries, participants, me, loading, error, retry } = useLeaderboard(HOME_ROWS, period, score?.points);
  const meInTop = entries.some((e) => e.isMe);

  return (
    <section className="lb-card" aria-labelledby="lb-card-title">
      <div className="section-head">
        <div>
          <h2 id="lb-card-title" className="lb-card__title">
            <Icon name="trophy" size={22} />
            {t("lb.title")}
          </h2>
          <p>{period === "week" ? t("lb.hintWeek") : t("lb.hintMonth")}</p>
        </div>
        <div className="section-head__aside lb-card__actions">
          <PeriodTabs
            value={period}
            onChange={setPeriod}
            periods={["week", "month"]}
            label={(p) => (p === "week" ? t("lb.week") : t("lb.month"))}
          />
          <Link to="/leaderboard" className="btn btn--soft btn--sm">
            {t("lb.viewAll")}
            <Icon name="chevronRight" size={16} strokeWidth={2} />
          </Link>
        </div>
      </div>

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
          <p className="lb-empty">{t("lb.periodEmpty")}</p>
        ) : (
          <ol className="lb-list">
            {entries.map((e) => (
              <li key={e.rank} className={`lb-row${e.isMe ? " is-me" : ""}`} data-top={e.rank <= 3 ? e.rank : undefined}>
                <span className="lb-rank tabular">{e.rank}</span>
                <LeaderAvatar name={e.name} avatar={e.avatar} />
                <span className="lb-name">
                  {e.name}
                  {e.isMe && <em className="lb-you">{t("lb.you")}</em>}
                </span>
                <span className="lb-points tabular">
                  {formatPoints(e.points, uiLang)} <small>{t("lb.pointsUnit")}</small>
                </span>
              </li>
            ))}
          </ol>
        )}

        {user && me && !meInTop && !loading && !error && (
          <div className="lb-me">
            <span className="lb-me__label">{t("lb.yourRank")}</span>
            <div className="lb-row is-me">
              <span className="lb-rank tabular">{me.rank}</span>
              <LeaderAvatar name={me.name} avatar={me.avatar} />
              <span className="lb-name">
                {me.name}
                <em className="lb-you">{t("lb.you")}</em>
              </span>
              <span className="lb-points tabular">
                {formatPoints(me.points, uiLang)} <small>{t("lb.pointsUnit")}</small>
              </span>
            </div>
            {participants > 0 && (
              <span className="lb-me__of">{fmt(t("lb.rankOf"), { rank: me.rank, total: participants })}</span>
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
