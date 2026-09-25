import { apiUrl } from "../env";
import { DICTATION_PROGRESS_KEY, getAllDictationProgress } from "./dictationProgressStore";
import { LISTENING_KEY, getAllListeningAnswers } from "./listeningScoreStore";
import { HISTORY_KEY, STATS_KEY, getPracticeHistory } from "./practiceHistoryStore";
import { RESUME_KEY } from "./resumeStore";

/**
 * Practice data in this browser belongs either to a guest or to one account.
 * This records which, so signing out doesn't leave one person's progress for
 * the next, and practice done as a guest moves onto the account at sign-in.
 * Settings, theme, level and UI language are device preferences and stay.
 */
const OWNER_KEY = "jd.data_owner.v1";
/** Set to the user id when moving guest data onto that account failed and should be retried. */
const PENDING_IMPORT_KEY = "jd.pending_import.v1";

const PRACTICE_KEYS = [DICTATION_PROGRESS_KEY, STATS_KEY, HISTORY_KEY, LISTENING_KEY, RESUME_KEY];

/** Rows per import request, to stay well under the server's request size limit. */
const CHUNK = 1000;

export function clearAccountData(): void {
  for (const key of [...PRACTICE_KEYS, OWNER_KEY, PENDING_IMPORT_KEY]) {
    try {
      localStorage.removeItem(key);
    } catch {
      // storage blocked: nothing stored either
    }
  }
}

function collectGuestData() {
  const dictation = Object.entries(getAllDictationProgress()).flatMap(([lessonId, segments]) =>
    Object.entries(segments)
      .filter(([, p]) => p.status === "correct" || p.status === "incorrect")
      .map(([segmentId, p]) => ({
        lesson_id: lessonId,
        segment_id: segmentId,
        status: p.status,
        score: p.score,
        attempts: p.attempts,
        last_answer: p.lastAnswer,
      })),
  );
  const listening = Object.entries(getAllListeningAnswers()).flatMap(([lessonId, answers]) =>
    Object.entries(answers).map(([questionId, a]) => ({
      lesson_id: lessonId,
      question_id: questionId,
      choice_id: a.choiceId,
      correct: a.correct,
      correct_choice_id: a.correctChoiceId,
      answered_at: a.answeredAt,
    })),
  );
  return { dictation, listening, sessions: getPracticeHistory() };
}

async function importGuestData(token: string): Promise<boolean> {
  const { dictation, listening, sessions } = collectGuestData();
  const batches: Record<string, unknown>[] = [];
  for (let i = 0; i < dictation.length; i += CHUNK) batches.push({ dictation: dictation.slice(i, i + CHUNK) });
  for (let i = 0; i < listening.length; i += CHUNK) batches.push({ listening: listening.slice(i, i + CHUNK) });
  if (sessions.length) batches.push({ sessions: sessions.slice(0, 50) });

  try {
    for (const batch of batches) {
      const res = await fetch(apiUrl("/api/progress/import"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(batch),
      });
      if (!res.ok) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Makes the practice data in this browser the signed-in user's.
 * `fromGuest` is true for an explicit sign-in, when unowned data was made as a
 * guest and is sent to the account. On a page load with a saved token it is
 * false: unowned data then predates this tracking and was already synced.
 */
export async function adoptLocalData(userId: string, token: string, { fromGuest }: { fromGuest: boolean }) {
  const owner = localStorage.getItem(OWNER_KEY);
  if (owner === userId) {
    if (localStorage.getItem(PENDING_IMPORT_KEY) === userId && (await importGuestData(token))) {
      localStorage.removeItem(PENDING_IMPORT_KEY);
    }
    return;
  }

  if (owner) {
    // Left behind by another account: never show or upload it.
    clearAccountData();
  } else if (fromGuest && !(await importGuestData(token))) {
    // Offline or server error: try again on the next page load.
    localStorage.setItem(PENDING_IMPORT_KEY, userId);
  }

  localStorage.setItem(OWNER_KEY, userId);
}
