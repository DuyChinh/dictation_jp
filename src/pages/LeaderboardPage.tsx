import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import {
  LEVEL_TABS,
  LeaderAvatar,
  LeaderRow,
  LevelTabs,
  PeriodTabs,
  formatPoints,
  GainChip,
  useLeaderboard,
  useTimeLeft,
} from "../features/leaderboard/leaderboardUi";
import { Medal } from "../features/leaderboard/Medal";
import type { LeaderboardLevel, LeaderboardPeriod } from "../shared/api/leaderboard";
import { useLevel } from "../shared/context/LevelContext";
import { fmt } from "../shared/i18n/format";
import type { TranslationKey } from "../shared/i18n/translations";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { useMyScore } from "../shared/storage/myScoreStore";
import { AppShell } from "../shared/ui/AppShell";
import { Icon, type IconName } from "../shared/ui/Icon";

const PAGE_SIZE = 50;
const PERIODS: LeaderboardPeriod[] = ["week", "month", "year", "all"];
const RINGS = { 1: "gold", 2: "silver", 3: "bronze" } as const;

const HOW: Array<{ icon: IconName; tone: string; value: string; title: TranslationKey; desc: TranslationKey }> = [
  { icon: "pencil", tone: "blue", value: "+10", title: "lb.how2t", desc: "lb.how2" },
  { icon: "headphones", tone: "violet", value: "+10 / +2", title: "lb.how3t", desc: "lb.how3" },
  { icon: "clock", tone: "orange", value: "+50", title: "lb.how4t", desc: "lb.how4" },
  { icon: "sun", tone: "gold", value: "+20", title: "lb.how5t", desc: "lb.how5" },
  { icon: "flag", tone: "green", value: "1.000", title: "lb.how1t", desc: "lb.how1" },
  { icon: "shield", tone: "pink", value: "1.500", title: "lb.how6t", desc: "lb.how6" },
];

export function LeaderboardPage() {
  const { t, uiLang } = useUiLanguage();
  const { user } = useAuth();
  const { level: pickedLevel } = useLevel();
  const score = useMyScore(!!user);
  const [params] = useSearchParams();

  const [period, setPeriod] = useState<LeaderboardPeriod>(() => {
    const p = params.get("period");
    return PERIODS.includes(p as LeaderboardPeriod) ? (p as LeaderboardPeriod) : "week";
  });
  const [level, setLevel] = useState<LeaderboardLevel>(() => {
    const l = params.get("level");
    return LEVEL_TABS.includes(l as LeaderboardLevel) ? (l as LeaderboardLevel) : pickedLevel;
  });
  const hasLevelParam = params.has("level");
  useEffect(() => {
    if (!hasLevelParam) setLevel(pickedLevel);
  }, [pickedLevel, hasLevelParam]);

  const { entries, participants, me, loading, loadingMore, error, hasMore, loadMore, retry } = useLeaderboard(
    PAGE_SIZE,
    period,
    level,
    score?.points,
  );
  const timeLeft = useTimeLeft(period);

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);
  const meShown = entries.some((e) => e.isMe);
  const maxPoints = entries[0]?.points ?? 0;
  const hint =
    period === "week"
      ? t("lb.hintWeek")
      : period === "month"
        ? t("lb.hintMonth")
        : period === "year"
          ? t("lb.hintYear")
          : level === "ALL"
            ? t("lb.hintAll")
            : fmt(t("lb.hintLevelAll"), { level });
  const timeText = timeLeft
    ? timeLeft.days > 0
      ? fmt(t("lb.timeDH"), { d: timeLeft.days, h: timeLeft.hours })
      : fmt(t("lb.timeHM"), { h: timeLeft.hours, m: timeLeft.minutes })
    : "";

  return (
    <AppShell title={t("nav.leaderboard")}>
      <section className="lb-page-head">
        <span className="lb-page-head__icon" aria-hidden="true">
          <Icon name="trophy" size={32} />
        </span>
        <div className="lb-page-head__text">
          <h1>{t("lb.title")}</h1>
          <p>{participants > 0 ? fmt(t("lb.pageSub"), { n: formatPoints(participants, uiLang) }) : t("lb.sub")}</p>
        </div>
        {timeLeft && (
          <div className="lb-countdown">
            <span className="lb-countdown__icon" aria-hidden="true">
              <Icon name="clock" size={20} />
            </span>
            <span className="lb-countdown__text">
              <small>{t(period === "week" ? "lb.endsInWeek" : period === "month" ? "lb.endsInMonth" : "lb.endsInYear")}</small>
              <strong className="tabular">{timeText}</strong>
            </span>
          </div>
        )}
      </section>

      <div className="lb-toolbar">
        <PeriodTabs value={period} onChange={setPeriod} periods={PERIODS} />
        <span className="lb-toolbar__hint">{hint}</span>
      </div>
      <LevelTabs value={level} onChange={setLevel} />

      {user && me ? (
        <section className="lb-mycard" aria-label={t("lb.yourRank")}>
          <LeaderAvatar name={me.name} avatar={me.avatar} size={68} ring="me" />
          <div className="lb-mycard__text">
            <span className="lb-mycard__name">
              {me.name}
              <em className="lb-you">{t("lb.you")}</em>
            </span>
            <span className="lb-mycard__sub">
              {t("lb.rankWord")} <b>{me.rank}</b>
              {participants > 0 && <> / {formatPoints(participants, uiLang)}</>}
            </span>
            <span className="lb-mycard__next">
              <Icon name={me.ahead ? "arrowUp" : "crown"} size={14} strokeWidth={2.2} />
              {me.ahead ? fmt(t("lb.ahead"), { n: formatPoints(me.ahead.gap, uiLang), name: me.ahead.name }) : t("lb.leading")}
            </span>
          </div>
          <div className="lb-mycard__stats">
            {(period !== "all" || level !== "ALL") && (
              <div className="lb-stat">
                <small>{t("lb.statGain")}</small>
                <strong className="lb-stat__gain tabular">+{formatPoints(me.points, uiLang)}</strong>
              </div>
            )}
            <div className="lb-stat">
              <small>{t("lb.statTotal")}</small>
              <strong className="tabular">{formatPoints(me.totalPoints, uiLang)}</strong>
            </div>
          </div>
        </section>
      ) : (
        !user && (
          <section className="lb-guest lb-guest--page">
            <p>{t("lb.guestCta")}</p>
            <Link to="/auth" className="btn btn--primary btn--sm">
              {t("lb.guestBtn")}
            </Link>
          </section>
        )
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
        <div className="lb-panel lb-empty">
          <p>{level !== "ALL" ? t("lb.levelEmpty") : period === "all" ? t("lb.empty") : t("lb.periodEmpty")}</p>
        </div>
      ) : (
        <>
          <ol className="lb-podium" aria-label={fmt(t("lb.top"), { n: 3 })}>
            {podium.map((e) => (
              <li key={e.rank} className={`lb-podium__item${e.isMe ? " is-me" : ""}`} data-place={e.rank}>
                {e.rank === 1 && (
                  <span className="lb-podium__crown" aria-hidden="true">
                    <Icon name="crown" size={30} strokeWidth={1.6} />
                  </span>
                )}
                <LeaderAvatar
                  name={e.name}
                  avatar={e.avatar}
                  size={e.rank === 1 ? 92 : 68}
                  ring={RINGS[e.rank as 1 | 2 | 3]}
                />
                <span className="lb-podium__name">
                  {e.name}
                  {e.isMe && <em className="lb-you">{t("lb.you")}</em>}
                </span>
                <span className="lb-podium__points tabular">
                  {formatPoints(e.totalPoints, uiLang)} <small>{t("lb.pointsUnit")}</small>
                </span>
                <GainChip points={e.points} period={period} level={level} />
                <span className="lb-podium__step">
                  <Medal place={e.rank as 1 | 2 | 3} size={e.rank === 1 ? 52 : 44} />
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
                  <LeaderRow key={e.rank} entry={e} period={period} level={level} maxPoints={maxPoints} showBar />
                ))}
              </ol>
              {hasMore && (
                <div className="lb-more">
                  <button type="button" className="btn btn--soft" onClick={loadMore} disabled={loadingMore}>
                    {t("lb.loadMore")}
                    <Icon name="chevronRight" size={16} strokeWidth={2} style={{ transform: "rotate(90deg)" }} />
                  </button>
                </div>
              )}
            </div>
          )}
          {user && me && !meShown && (
            <p className="lb-note">
              {t("lb.rankWord")} {me.rank}
              {participants > 0 && <> / {formatPoints(participants, uiLang)}</>}
            </p>
          )}
        </>
      )}

      <section className="lb-how" aria-labelledby="lb-how-title">
        <h2 id="lb-how-title">{t("lb.howTitle")}</h2>
        <p>{t("lb.howSub")}</p>
        <div className="lb-how__grid">
          {HOW.map((h) => (
            <div key={h.title} className={`lb-tile lb-tile--${h.tone}`}>
              <span className="lb-tile__icon" aria-hidden="true">
                <Icon name={h.icon} size={22} />
              </span>
              <span className="lb-tile__value tabular">{h.value}</span>
              <span className="lb-tile__desc">{t(h.desc)}</span>
            </div>
          ))}
        </div>
        <p className="lb-how__note">
          <Icon name="bulb" size={16} />
          {t("lb.howLevel")}
        </p>
      </section>
    </AppShell>
  );
}
