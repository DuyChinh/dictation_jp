import { apiUrl } from "../env";

/**
 * Listening (multiple-choice) answers per lesson, kept in this browser and,
 * when signed in, on the account. Only the first answer to a question counts,
 * as in the real exam; clearing answers (all, or only the wrong ones) is how a
 * learner retries.
 */
export const LISTENING_KEY = "jd.listening.v1";

export type ListeningAnswer = {
  choiceId: string;
  correct: boolean;
  correctChoiceId: string | null;
  answeredAt: number;
};

type Store = Record<string, Record<string, ListeningAnswer>>;

/** Clears still on their way to the server; a sync waits for them so it can't bring cleared answers back. */
let pendingClear: Promise<unknown> = Promise.resolve();

function read(): Store {
  try {
    const raw = localStorage.getItem(LISTENING_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store): void {
  try {
    localStorage.setItem(LISTENING_KEY, JSON.stringify(store));
  } catch {
    /* storage full or blocked: scores just won't persist */
  }
}

export function getAllListeningAnswers(): Store {
  return read();
}

export function getListeningAnswers(lessonId: string): Record<string, ListeningAnswer> {
  return read()[lessonId] ?? {};
}

/** Records the answer unless the question was already answered; returns the stored answer. */
export function recordListeningAnswer(
  lessonId: string,
  questionId: string,
  answer: Omit<ListeningAnswer, "answeredAt">,
): ListeningAnswer {
  const store = read();
  const lesson = store[lessonId] ?? {};
  const existing = lesson[questionId];
  if (existing) return existing;
  const saved = { ...answer, answeredAt: Date.now() };
  store[lessonId] = { ...lesson, [questionId]: saved };
  write(store);

  const token = localStorage.getItem("token");
  if (token) {
    void fetch(apiUrl("/api/progress/listening"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        lesson_id: lessonId,
        question_id: questionId,
        choice_id: saved.choiceId,
        correct: saved.correct,
        correct_choice_id: saved.correctChoiceId,
        answered_at: saved.answeredAt,
      }),
    }).catch(() => {});
  }

  return saved;
}

/** Clears the given questions, or the whole lesson when no ids are passed. */
export function clearListeningAnswers(lessonId: string, questionIds?: string[]): void {
  const store = read();
  if (!questionIds) {
    delete store[lessonId];
  } else {
    const lesson = { ...(store[lessonId] ?? {}) };
    for (const id of questionIds) delete lesson[id];
    store[lessonId] = lesson;
  }
  write(store);

  const token = localStorage.getItem("token");
  if (token) {
    const query = questionIds ? `?question_ids=${questionIds.map(encodeURIComponent).join(",")}` : "";
    const request = fetch(apiUrl(`/api/progress/listening/${encodeURIComponent(lessonId)}${query}`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
    pendingClear = Promise.all([pendingClear, request]);
  }
}

/** Fetches the account's answers for a lesson and merges them in; the account wins where both have one. */
export async function syncListeningAnswersFromServer(lessonId: string): Promise<Record<string, ListeningAnswer>> {
  const token = localStorage.getItem("token");
  if (!token) return getListeningAnswers(lessonId);

  try {
    await pendingClear;
    const res = await fetch(apiUrl(`/api/progress/listening/${encodeURIComponent(lessonId)}`), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.answers && typeof data.answers === "object") {
        const store = read();
        store[lessonId] = { ...(store[lessonId] ?? {}), ...data.answers };
        write(store);
      }
    }
  } catch {
    // offline: what this browser has is still usable
  }

  return getListeningAnswers(lessonId);
}
