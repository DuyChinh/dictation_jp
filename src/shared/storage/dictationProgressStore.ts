import { apiUrl } from "../env";

export type SegmentStatus = "correct" | "incorrect" | "unattempted";

export interface SegmentProgressData {
  status: SegmentStatus;
  score: number;
  attempts: number;
  lastAnswer?: string;
  updatedAt: number;
}

const STORAGE_KEY = "jd.dictation_progress.v1";

/**
 * Load all stored progress map from localStorage
 * Structure: { [lessonId]: { [segmentId]: SegmentProgressData } }
 */
export function getAllDictationProgress(): Record<string, Record<string, SegmentProgressData>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Get progress map for a specific lesson
 */
export function getLessonProgress(lessonId: string): Record<string, SegmentProgressData> {
  const all = getAllDictationProgress();
  return all[lessonId] || {};
}

/**
 * Save progress for a segment (local storage + optional backend sync)
 */
export function saveSegmentProgress(
  lessonId: string,
  questionId: string,
  segmentId: string,
  data: {
    status: "correct" | "incorrect";
    score: number;
    lastAnswer?: string;
  }
): SegmentProgressData {
  const all = getAllDictationProgress();
  if (!all[lessonId]) all[lessonId] = {};

  const existing = all[lessonId]![segmentId];
  const updated: SegmentProgressData = {
    status: data.status,
    score: Math.max(data.score, existing?.score || 0),
    attempts: (existing?.attempts || 0) + 1,
    lastAnswer: data.lastAnswer,
    updatedAt: Date.now(),
  };

  all[lessonId]![segmentId] = updated;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }

  // Fire-and-forget backend sync if token exists
  const token = localStorage.getItem("token");
  if (token) {
    void fetch(apiUrl("/api/progress/dictation"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        lesson_id: lessonId,
        question_id: questionId,
        segment_id: segmentId,
        status: data.status,
        score: data.score,
        last_answer: data.lastAnswer,
      }),
    }).catch(() => {});
  }

  return updated;
}

/**
 * Fetch and merge progress from backend for a lesson
 */
export async function syncLessonProgressFromServer(
  lessonId: string
): Promise<Record<string, SegmentProgressData>> {
  const token = localStorage.getItem("token");
  if (!token) {
    return getLessonProgress(lessonId);
  }

  try {
    const res = await fetch(apiUrl(`/api/progress/lesson/${encodeURIComponent(lessonId)}`), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.progress && typeof data.progress === "object") {
        const all = getAllDictationProgress();
        all[lessonId] = { ...(all[lessonId] || {}), ...data.progress };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
        } catch {
          // ignore
        }
        return all[lessonId]!;
      }
    }
  } catch {
    // fallback to local
  }

  return getLessonProgress(lessonId);
}
