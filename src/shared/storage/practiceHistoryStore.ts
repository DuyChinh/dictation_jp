import { apiUrl } from "../env";

export interface UserOverallStats {
  bestStreak: number;
  currentStreak: number;
  totalAttempts: number;
  totalCorrect: number;
  totalScoreSum: number;
  lessonsPracticed: string[];
  updatedAt: number;
}

export interface PracticeSessionItem {
  id: string;
  lessonId: string;
  lessonTitle: string;
  level: string;
  score: number;
  maxStreak: number;
  correctCount: number;
  totalCount: number;
  mascot: string;
  timestamp: number;
}

const STATS_KEY = "jd.user_stats.v1";
const HISTORY_KEY = "jd.practice_history.v1";

const defaultStats: UserOverallStats = {
  bestStreak: 0,
  currentStreak: 0,
  totalAttempts: 0,
  totalCorrect: 0,
  totalScoreSum: 0,
  lessonsPracticed: [],
  updatedAt: Date.now(),
};

export function getUserStats(): UserOverallStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { ...defaultStats };
    return { ...defaultStats, ...JSON.parse(raw) };
  } catch {
    return { ...defaultStats };
  }
}

export function saveUserStats(stats: Partial<UserOverallStats>): UserOverallStats {
  const current = getUserStats();
  const next: UserOverallStats = {
    ...current,
    ...stats,
    updatedAt: Date.now(),
  };
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function getPracticeHistory(): PracticeSessionItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Record a single answer attempt to update best streak and totals in real-time
 */
export function recordAnswerAttempt(data: {
  lessonId: string;
  correct: boolean;
  score: number;
  streak: number;
  mascot: string;
}): UserOverallStats {
  const stats = getUserStats();
  const newBestStreak = Math.max(stats.bestStreak, data.streak);
  const lessons = stats.lessonsPracticed.includes(data.lessonId)
    ? stats.lessonsPracticed
    : [...stats.lessonsPracticed, data.lessonId];

  const updated = saveUserStats({
    bestStreak: newBestStreak,
    currentStreak: data.streak,
    totalAttempts: stats.totalAttempts + 1,
    totalCorrect: data.correct ? stats.totalCorrect + 1 : stats.totalCorrect,
    totalScoreSum: stats.totalScoreSum + data.score,
    lessonsPracticed: lessons,
  });

  return updated;
}

/**
 * Add a completed practice session entry
 */
export function addPracticeSession(
  session: Omit<PracticeSessionItem, "id" | "timestamp">
): PracticeSessionItem {
  const history = getPracticeHistory();
  const newItem: PracticeSessionItem = {
    ...session,
    id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
  };

  const nextHistory = [newItem, ...history].slice(0, 50); // keep last 50 sessions
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  } catch {
    // ignore
  }

  // Sync to server if logged in
  const token = localStorage.getItem("token");
  if (token) {
    void fetch(apiUrl("/api/progress/session"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newItem),
    }).catch(() => {});
  }

  return newItem;
}

/**
 * Sync stats and history from server for logged-in user
 */
export async function syncHistoryFromServer(): Promise<{
  stats: UserOverallStats;
  history: PracticeSessionItem[];
}> {
  const localStats = getUserStats();
  const localHistory = getPracticeHistory();

  const token = localStorage.getItem("token");
  if (!token) {
    return { stats: localStats, history: localHistory };
  }

  try {
    const res = await fetch(apiUrl("/api/progress/history"), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.stats) {
        saveUserStats(data.stats);
      }
      if (Array.isArray(data.history) && data.history.length > 0) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(data.history));
      }
      return {
        stats: getUserStats(),
        history: getPracticeHistory(),
      };
    }
  } catch {
    // fallback
  }

  return { stats: localStats, history: localHistory };
}
