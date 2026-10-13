import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchLeaderboard,
  type LeaderboardLevel,
  type LeaderboardMe,
  type LeaderboardPeriod,
  type LeaderboardRow,
} from "../../shared/api/leaderboard";
import { fmt } from "../../shared/i18n/format";
import type { TranslationKey, UiLang } from "../../shared/i18n/translations";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { Icon, type IconName } from "../../shared/ui/Icon";
import { AnimalAvatar } from "./animals";
import { Medal, RankBadge } from "./Medal";

const LOCALES: Record<UiLang, string> = { vi: "vi-VN", ja: "ja-JP", en: "en-US" };

export function formatPoints(points: number, lang: UiLang): string {
  return points.toLocaleString(LOCALES[lang]);
}

export const LEVEL_TABS: LeaderboardLevel[] = ["ALL", "N5", "N4", "N3", "N2", "N1"];

/** A learner's picture when they uploaded one, otherwise their animal. */
export function LeaderAvatar({
  name,
  avatar,
  size = 40,
  ring,
}: {
  name: string;
  avatar: string | null;
  size?: number;
  ring?: "gold" | "silver" | "bronze" | "me";
}) {
  const className = `lb-avatar${ring ? ` lb-avatar--${ring}` : ""}`;
  if (avatar) {
    return <img className={className} src={avatar} alt="" width={size} height={size} loading="lazy" />;
  }
  return <AnimalAvatar name={name} size={size} className={className} />;
}

export type LeaderboardState = {
  entries: LeaderboardRow[];
  total: number;
  participants: number;
  me: LeaderboardMe | null;
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
  hasMore: boolean;
  loadMore: () => void;
  retry: () => void;
};

/** The ranking for a period and level in pages of `pageSize`; it reloads what is shown when `refreshKey` changes. */
export function useLeaderboard(
  pageSize: number,
  period: LeaderboardPeriod,
  level: LeaderboardLevel,
  refreshKey: unknown,
): LeaderboardState {
  const [entries, setEntries] = useState<LeaderboardRow[]>([]);
  const [total, setTotal] = useState(0);
  const [participants, setParticipants] = useState(0);
  const [me, setMe] = useState<LeaderboardMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const shown = useRef(0);
  const shownKey = useRef(`${period}|${level}`);
  shown.current = entries.length;

  const apply = (data: Awaited<ReturnType<typeof fetchLeaderboard>>, append: boolean) => {
    setEntries((prev) => (append ? [...prev, ...data.entries] : data.entries));
    setTotal(data.total);
    setParticipants(data.participants);
    setMe(data.me);
  };

  useEffect(() => {
    let live = true;
    const key = `${period}|${level}`;
    // A new ranking starts over from the first page; a score change keeps what is on screen.
    const count = shownKey.current === key ? shown.current : 0;
    if (shownKey.current !== key) setLoading(true);
    shownKey.current = key;
    setError(false);
    fetchLeaderboard(Math.max(count, pageSize), 0, period, level)
      .then((data) => live && apply(data, false))
      .catch(() => live && setError(true))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [pageSize, period, level, refreshKey]);

  const loadMore = useCallback(() => {
    setLoadingMore(true);
    fetchLeaderboard(pageSize, shown.current, period, level)
      .then((data) => apply(data, true))
      .catch(() => setError(true))
      .finally(() => setLoadingMore(false));
  }, [pageSize, period, level]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchLeaderboard(Math.max(shown.current, pageSize), 0, period, level)
      .then((data) => apply(data, false))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [pageSize, period, level]);

  return { entries, total, participants, me, loading, loadingMore, error, hasMore: entries.length < total, loadMore, retry };
}

const PERIOD_ICON: Record<LeaderboardPeriod, IconName> = { week: "calendar", month: "calendar", year: "calendar", all: "infinity" };
const PERIOD_LABEL: Record<LeaderboardPeriod, TranslationKey> = {
  week: "lb.week",
  month: "lb.month",
  year: "lb.year",
  all: "lb.all",
};

/** Switch between this week, this month and all time; `periods` lists the ones offered. */
export function PeriodTabs({
  value,
  onChange,
  periods,
}: {
  value: LeaderboardPeriod;
  onChange: (p: LeaderboardPeriod) => void;
  periods: LeaderboardPeriod[];
}) {
  const { t } = useUiLanguage();
  return (
    <div className="lb-tabs" role="tablist" aria-label={t("lb.periodLabel")}>
      {periods.map((p) => (
        <button
          key={p}
          type="button"
          role="tab"
          aria-selected={value === p}
          className={value === p ? "is-active" : undefined}
          onClick={() => onChange(p)}
        >
          <Icon name={PERIOD_ICON[p]} size={16} strokeWidth={2} />
          {t(PERIOD_LABEL[p])}
        </button>
      ))}
    </div>
  );
}

/** Switch the ranking between all levels and one JLPT level. */
export function LevelTabs({ value, onChange }: { value: LeaderboardLevel; onChange: (l: LeaderboardLevel) => void }) {
  const { t } = useUiLanguage();
  return (
    <div className="lb-levels" role="tablist" aria-label={t("lb.levelLabel")}>
      {LEVEL_TABS.map((lv) => (
        <button
          key={lv}
          type="button"
          role="tab"
          aria-selected={value === lv}
          className={value === lv ? "is-active" : undefined}
          onClick={() => onChange(lv)}
        >
          {lv === "ALL" ? t("lb.levelAll") : lv}
        </button>
      ))}
    </div>
  );
}

/** What a learner earned in the ranking's period or level, as a small green label; none for the plain all-time board. */
export function GainChip({
  points,
  period,
  level,
}: {
  points: number;
  period: LeaderboardPeriod;
  level: LeaderboardLevel;
}) {
  const { t, uiLang } = useUiLanguage();
  if (period === "all" && level === "ALL") return null;
  const key: TranslationKey =
    period === "week" ? "lb.gainWeek" : period === "month" ? "lb.gainMonth" : period === "year" ? "lb.gainYear" : "lb.gainLevel";
  return (
    <span className="lb-gain">
      <Icon name="arrowUp" size={12} strokeWidth={2.6} />
      {fmt(t(key), { n: formatPoints(points, uiLang), level })}
    </span>
  );
}

/** One learner in a list: rank, picture, name, how far they are from the top, and their score. */
export function LeaderRow({
  entry,
  period,
  level,
  maxPoints,
  showBar,
}: {
  entry: LeaderboardRow;
  period: LeaderboardPeriod;
  level: LeaderboardLevel;
  maxPoints: number;
  showBar: boolean;
}) {
  const { t, uiLang } = useUiLanguage();
  const hasGain = !(period === "all" && level === "ALL");
  const width = maxPoints > 0 ? Math.max(4, Math.round((entry.points / maxPoints) * 100)) : 0;
  return (
    <li className={`lb-row${entry.isMe ? " is-me" : ""}`} data-top={entry.rank <= 3 ? entry.rank : undefined}>
      {entry.rank <= 3 ? (
        <span className="lb-rank lb-rank--medal">
          <Medal place={entry.rank as 1 | 2 | 3} size={30} ribbon={false} />
        </span>
      ) : entry.rank <= 10 ? (
        <span className="lb-rank lb-rank--medal">
          <RankBadge rank={entry.rank} size={30} />
        </span>
      ) : (
        <span className="lb-rank tabular">{entry.rank}</span>
      )}
      <LeaderAvatar name={entry.name} avatar={entry.avatar} ring={entry.isMe ? "me" : undefined} />
      <span className="lb-name">
        <span className="lb-name__text">{entry.name}</span>
        {entry.isMe && <em className="lb-you">{t("lb.you")}</em>}
        {entry.level && level === "ALL" && <span className="lb-level">{entry.level}</span>}
      </span>
      {showBar && hasGain && (
        <span className="lb-bar" aria-hidden="true">
          <span style={{ width: `${width}%` }} />
        </span>
      )}
      <span className="lb-points tabular">
        <span className="lb-points__total">
          {formatPoints(entry.totalPoints, uiLang)} <small>{t("lb.pointsUnit")}</small>
        </span>
        <GainChip points={entry.points} period={period} level={level} />
      </span>
    </li>
  );
}

/** Time left until the week or month closes (Vietnam time, where weeks start on Monday), refreshed each minute. */
export function useTimeLeft(period: LeaderboardPeriod): { days: number; hours: number; minutes: number } | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  if (period === "all") return null;
  const offset = 7 * 3600_000;
  const vn = new Date(now + offset);
  const y = vn.getUTCFullYear();
  const m = vn.getUTCMonth();
  const d = vn.getUTCDate();
  const end =
    period === "year"
      ? Date.UTC(y + 1, 0, 1) - offset
      : period === "month"
        ? Date.UTC(y, m + 1, 1) - offset
        : Date.UTC(y, m, d + (7 - ((vn.getUTCDay() + 6) % 7))) - offset;
  const left = Math.max(0, end - now);
  return {
    days: Math.floor(left / 86_400_000),
    hours: Math.floor((left % 86_400_000) / 3_600_000),
    minutes: Math.floor((left % 3_600_000) / 60_000),
  };
}
