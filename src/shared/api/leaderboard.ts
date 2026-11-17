import { apiUrl } from "../env";

export type LeaderboardRow = {
  rank: number;
  name: string;
  avatar: string | null;
  /** Points earned in the ranking's period (the whole score for all time). */
  points: number;
  /** The whole score, never below the starting 1,000. */
  totalPoints: number;
  /** JLPT level they mostly study, when known. */
  level: string | null;
  isMe: boolean;
};

export type LeaderboardMe = {
  rank: number;
  name: string;
  avatar: string | null;
  points: number;
  totalPoints: number;
  level: string | null;
  /** The learner just above, and the points needed to pass them. */
  ahead: { name: string; gap: number } | null;
};

export type LeaderboardLevel = "ALL" | "N5" | "N4" | "N3" | "N2" | "N1";

export type LeaderboardPeriod = "week" | "month" | "year" | "all";

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
  level: LeaderboardLevel = "ALL",
): Promise<LeaderboardPageData> {
  const res = await fetch(apiUrl(`/api/leaderboard?period=${period}&level=${level}&limit=${limit}&offset=${offset}`), {
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

/**
 * Points for a finished game of "Who wants to be a millionaire" (a million of the prize is a point). Resolves to
 * what was really added, which can be less than the game is worth once the day's limit is reached.
 */
export async function awardMillionairePoints(prize: number): Promise<number> {
  const res = await fetch(apiUrl("/api/leaderboard/game"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ game: "millionaire", prize }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { gained?: unknown };
  return typeof body.gained === "number" && body.gained > 0 ? body.gained : 0;
}
