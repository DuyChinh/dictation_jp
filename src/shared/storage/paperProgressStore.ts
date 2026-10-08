/**
 * Progress through a lesson's written part (vocab / grammar / reading), kept in this browser.
 * Answers store only the pick and whether it was right; the explanations are fetched again from
 * the server when an answered question is reopened.
 */
export const PAPER_PROGRESS_KEY = "jd.paper_progress.v1";

export type PaperAnswer = { choiceId: string; correct: boolean; at: number; part: "vocab" | "grammar" | "reading" };
export type SentenceStatus = "good" | "partial" | "weak" | "self";

export type PaperProgress = {
  answers: Record<string, PaperAnswer>;
  sentences: Record<string, SentenceStatus>;
};

type Store = Record<string, PaperProgress>;

function read(): Store {
  try {
    const raw = localStorage.getItem(PAPER_PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store): void {
  try {
    localStorage.setItem(PAPER_PROGRESS_KEY, JSON.stringify(store));
  } catch {
    /* storage full or blocked: progress just won't persist here */
  }
}

export function getPaperProgress(lessonId: string): PaperProgress {
  const p = read()[lessonId];
  return { answers: p?.answers ?? {}, sentences: p?.sentences ?? {} };
}

function update(lessonId: string, fn: (p: PaperProgress) => void): PaperProgress {
  const store = read();
  const p = { answers: store[lessonId]?.answers ?? {}, sentences: store[lessonId]?.sentences ?? {} };
  fn(p);
  store[lessonId] = p;
  write(store);
  return p;
}

export function saveAnswer(lessonId: string, itemId: string, answer: PaperAnswer): PaperProgress {
  return update(lessonId, (p) => {
    p.answers[itemId] = answer;
  });
}

export function saveSentence(lessonId: string, sentenceId: string, status: SentenceStatus): PaperProgress {
  return update(lessonId, (p) => {
    p.sentences[sentenceId] = status;
  });
}

/** Forget the answers to these questions (redo a part). */
export function clearAnswers(lessonId: string, itemIds: string[]): PaperProgress {
  return update(lessonId, (p) => {
    for (const id of itemIds) delete p.answers[id];
  });
}
