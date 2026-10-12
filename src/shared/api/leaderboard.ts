import { apiUrl } from "../env";

export type LeaderboardRow = {
  rank: number;
  name: string;
  avatar: string | null;
  points: number;
  isMe: boolean;
};

export type LeaderboardMe = { rank: number; name: string; avatar: string | null; points: number };

export type LeaderboardPeriod = "week" | "month" | "all";

/** `total` is the rows in this ranking; `participants` everyone on the board. */
export type LeaderboardPageData = {
  entries: LeaderboardRow[];
  total: number;
  participants: number;
  me: LeaderboardMe | null;
};

export type MyScore = { points: number; rank: number; total: number; awarded: number };

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchLeaderboard(
  limit: number,
  offset: number,
  period: LeaderboardPeriod,
): Promise<LeaderboardPageData> {
  const res = await fetch(apiUrl(`/api/leaderboard?period=${period}&limit=${limit}&offset=${offset}`), {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as LeaderboardPageData;
}

export async function fetchMyScore(): Promise<MyScore> {
  const res = await fetch(apiUrl("/api/leaderboard/me"), { headers: authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as MyScore;
}
