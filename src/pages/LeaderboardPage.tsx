import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { LeaderAvatar, PeriodTabs, formatPoints, useLeaderboard } from "../features/leaderboard/leaderboardUi";
import type { LeaderboardPeriod } from "../shared/api/leaderboard";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { fmt } from "../shared/i18n/format";
import { useMyScore } from "../shared/storage/myScoreStore";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";

const PAGE_SIZE = 50;

export function LeaderboardPage() {
  const { t, uiLang } = useUiLanguage();
  const { user } = useAuth();
  const score = useMyScore(!!user);
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  const { entries, participants, me, loading, loadingMore, error, hasMore, loadMore, retry } = useLeaderboard(
    PAGE_SIZE,
    period,
    score?.points,
  );
  const hint = period === "week" ? t("lb.hintWeek") : period === "month" ? t("lb.hintMonth") : t("lb.hintAll");
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);
  const meShown = entries.some((e) => e.isMe);

  return (
    <AppShell title={t("nav.leaderboard")}>
      <section className="lb-page-head">
        <span className="lb-page-head__icon" aria-hidden="true">
          <Icon name="trophy" size={28} />
        </span>
        <div>
          <h1>{t("lb.title")}</h1>
          <p>{participants > 0 ? fmt(t("lb.pageSub"), { n: formatPoints(participants, uiLang) }) : t("lb.sub")}</p>
        </div>
      </section>

      <div className="lb-toolbar">
        <PeriodTabs
          value={period}
          onChange={setPeriod}
          periods={["week", "month", "all"]}
          label={(p) => (p === "week" ? t("lb.week") : p === "month" ? t("lb.month") : t("lb.all"))}
        />
        <span className="lb-toolbar__hint">{hint}</span>
      </div>

      {user && me && (
        <section className="lb-mycard" aria-label={t("lb.yourRank")}>
          <LeaderAvatar name={me.name} avatar={me.avatar} size={52} />
          <div className="lb-mycard__text">
            <span className="lb-mycard__name">{me.name}</span>
            <span className="lb-mycard__sub">{fmt(t("lb.rankOf"), { rank: me.rank, total: participants })}</span>
          </div>
          <span className="lb-mycard__points tabular">
            {formatPoints(me.points, uiLang)} <small>{t("lb.pointsUnit")}</small>
          </span>
        </section>
      )}
      {!user && (
        <section className="lb-guest lb-guest--page">
          <p>{t("lb.guestCta")}</p>
          <Link to="/auth" className="btn btn--primary btn--sm">
            {t("lb.guestBtn")}
          </Link>
        </section>
      )}

      {loading ? (
        <div className="lb-panel" aria-busy="true">
          <ol className="lb-list">
            {Array.from({ length: 8 }, (_, i) => (
              <li key={i} className="lb-row lb-row--skeleton" />
            ))}
          </ol>
        </div>
      ) : error && entries.length === 0 ? (
        <div className="lb-panel lb-empty">
          <p>{t("lb.error")}</p>
          <button type="button" className="btn btn--soft btn--sm" onClick={retry}>
            {t("lb.retry")}
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div className="lb-panel lb-empty">{period === "all" ? t("lb.empty") : t("lb.periodEmpty")}</div>
      ) : (
        <>
          <ol className="lb-podium" aria-label={fmt(t("lb.top"), { n: 3 })}>
            {podium.map((e) => (
              <li key={e.rank} className={`lb-podium__item${e.isMe ? " is-me" : ""}`} data-place={e.rank}>
                <span className="lb-podium__medal tabular">{e.rank}</span>
                <LeaderAvatar name={e.name} avatar={e.avatar} size={e.rank === 1 ? 72 : 60} />
                <span className="lb-podium__name">{e.name}</span>
                <span className="lb-podium__points tabular">
                  {formatPoints(e.points, uiLang)} <small>{t("lb.pointsUnit")}</small>
                </span>
              </li>
            ))}
          </ol>

          {rest.length > 0 && (
            <div className="lb-panel">
              <div className="lb-list-head" aria-hidden="true">
                <span>{t("lb.rank")}</span>
                <span>{t("lb.learner")}</span>
                <span>{t("lb.points")}</span>
              </div>
              <ol className="lb-list" start={4}>
                {rest.map((e) => (
                  <li key={e.rank} className={`lb-row${e.isMe ? " is-me" : ""}`}>
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
              {hasMore && (
                <div className="lb-more">
                  <button type="button" className="btn btn--soft" onClick={loadMore} disabled={loadingMore}>
                    {t("lb.loadMore")}
                  </button>
                </div>
              )}
            </div>
          )}
          {user && me && !meShown && (
            <p className="lb-note">{fmt(t("lb.rankOf"), { rank: me.rank, total: participants })}</p>
          )}
        </>
      )}

      <section className="lb-how" aria-labelledby="lb-how-title">
        <h2 id="lb-how-title">{t("lb.howTitle")}</h2>
        <ul>
          {(["lb.how1", "lb.how2", "lb.how3", "lb.how4", "lb.how5", "lb.how6"] as const).map((k) => (
            <li key={k}>
              <Icon name="check" size={16} strokeWidth={2.2} />
              {t(k)}
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
