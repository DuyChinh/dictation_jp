import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchLeaderboard,
  type LeaderboardMe,
  type LeaderboardPeriod,
  type LeaderboardRow,
} from "../../shared/api/leaderboard";
import type { UiLang } from "../../shared/i18n/translations";

const LOCALES: Record<UiLang, string> = { vi: "vi-VN", ja: "ja-JP", en: "en-US" };

export function formatPoints(points: number, lang: UiLang): string {
  return points.toLocaleString(LOCALES[lang]);
}

function hueOf(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) % 360;
  return h;
}

/** A learner's picture, or a coloured initial when they have none. */
export function LeaderAvatar({ name, avatar, size = 40 }: { name: string; avatar: string | null; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (avatar) return <img className="lb-avatar" src={avatar} alt="" style={style} loading="lazy" />;
  const initial = Array.from(name.trim())[0]?.toUpperCase() || "?";
  return (
    <span
      className="lb-avatar lb-avatar--initial"
      aria-hidden="true"
      style={{ ...style, background: `hsl(${hueOf(name)} 55% 42%)` }}
    >
      {initial}
    </span>
  );
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

/** The ranking for a period in pages of `pageSize`; it reloads what is shown when `refreshKey` changes. */
export function useLeaderboard(pageSize: number, period: LeaderboardPeriod, refreshKey: unknown): LeaderboardState {
  const [entries, setEntries] = useState<LeaderboardRow[]>([]);
  const [total, setTotal] = useState(0);
  const [participants, setParticipants] = useState(0);
  const [me, setMe] = useState<LeaderboardMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const shown = useRef(0);
  const shownPeriod = useRef(period);
  shown.current = entries.length;

  const apply = (data: Awaited<ReturnType<typeof fetchLeaderboard>>, append: boolean) => {
    setEntries((prev) => (append ? [...prev, ...data.entries] : data.entries));
    setTotal(data.total);
    setParticipants(data.participants);
    setMe(data.me);
  };

  useEffect(() => {
    let live = true;
    // A new period starts over from the first page; a score change keeps what is on screen.
    const count = shownPeriod.current === period ? shown.current : 0;
    if (shownPeriod.current !== period) setLoading(true);
    shownPeriod.current = period;
    setError(false);
    fetchLeaderboard(Math.max(count, pageSize), 0, period)
      .then((data) => live && apply(data, false))
      .catch(() => live && setError(true))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [pageSize, period, refreshKey]);

  const loadMore = useCallback(() => {
    setLoadingMore(true);
    fetchLeaderboard(pageSize, shown.current, period)
      .then((data) => apply(data, true))
      .catch(() => setError(true))
      .finally(() => setLoadingMore(false));
  }, [pageSize, period]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchLeaderboard(Math.max(shown.current, pageSize), 0, period)
      .then((data) => apply(data, false))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [pageSize, period]);

  return { entries, total, participants, me, loading, loadingMore, error, hasMore: entries.length < total, loadMore, retry };
}

/** Switch between the rankings; `periods` lists the ones offered. */
export function PeriodTabs({
  value,
  onChange,
  periods,
  label,
}: {
  value: LeaderboardPeriod;
  onChange: (p: LeaderboardPeriod) => void;
  periods: LeaderboardPeriod[];
  label: (p: LeaderboardPeriod) => string;
}) {
  return (
    <div className="lb-tabs" role="tablist">
      {periods.map((p) => (
        <button
          key={p}
          type="button"
          role="tab"
          aria-selected={value === p}
          className={value === p ? "is-active" : undefined}
          onClick={() => onChange(p)}
        >
          {label(p)}
        </button>
      ))}
    </div>
  );
}
