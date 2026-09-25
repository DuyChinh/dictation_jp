/**
 * Listening (multiple-choice) answers per lesson, kept in this browser.
 * Only the first answer to a question counts, as in the real exam; clearing
 * answers (all, or only the wrong ones) is how a learner retries.
 */
const KEY = "jd.listening.v1";

export type ListeningAnswer = {
  choiceId: string;
  correct: boolean;
  correctChoiceId: string | null;
  answeredAt: number;
};

type Store = Record<string, Record<string, ListeningAnswer>>;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* storage full or blocked: scores just won't persist */
  }
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
}
