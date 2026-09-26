import { apiUrl } from "../env";

/**
 * When the learner last practised each lesson (epoch ms by lesson id), so the
 * lesson list can put recent ones first. Kept in this browser and, when
 * signed in, on the account.
 */
export const LESSON_ACTIVITY_KEY = "jd.lesson_activity.v1";

export type LessonActivity = Record<string, number>;

export function getLessonActivity(): LessonActivity {
  try {
    const raw = localStorage.getItem(LESSON_ACTIVITY_KEY);
    return raw ? (JSON.parse(raw) as LessonActivity) : {};
  } catch {
    return {};
  }
}

function write(activity: LessonActivity): void {
  try {
    localStorage.setItem(LESSON_ACTIVITY_KEY, JSON.stringify(activity));
  } catch {
    // storage full or blocked: the list just keeps its default order
  }
}

/** Marks a lesson as practised now. */
export function touchLesson(lessonId: string): void {
  write({ ...getLessonActivity(), [lessonId]: Date.now() });

  const token = localStorage.getItem("token");
  if (token) {
    void fetch(apiUrl("/api/progress/activity"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ lesson_id: lessonId }),
    }).catch(() => {});
  }
}

/** Fetches the account's activity and merges it in, keeping the later time per lesson. */
export async function syncLessonActivityFromServer(): Promise<LessonActivity> {
  const token = localStorage.getItem("token");
  if (!token) return getLessonActivity();

  try {
    const res = await fetch(apiUrl("/api/progress/activity"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.activity && typeof data.activity === "object") {
        const merged = { ...getLessonActivity() };
        for (const [id, at] of Object.entries(data.activity as LessonActivity)) {
          if (typeof at === "number" && at > (merged[id] ?? 0)) merged[id] = at;
        }
        write(merged);
      }
    }
  } catch {
    // offline: this browser's activity still orders the list
  }

  return getLessonActivity();
}
