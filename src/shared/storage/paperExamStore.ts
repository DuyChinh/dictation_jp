import type { ExamResult, ExamScope } from "../api/paper";

/**
 * A timed sitting of a lesson's written part ("phòng thi"). The deadline is a timestamp, so a
 * reload or a closed tab does not stop the clock; answers are kept as they are picked.
 */
export const PAPER_EXAM_KEY = "jd.paper_exam.v1";
const LAST_MINUTES_KEY = "jd.paper_exam_minutes.v1";

export const PRESET_MINUTES = [20, 25, 35, 40, 60] as const;
export const MIN_MINUTES = 1;
export const MAX_MINUTES = 180;
export const DEFAULT_MINUTES = 40;

export type ExamSession = {
  lessonId: string;
  scope: ExamScope;
  minutes: number;
  startedAt: number;
  endsAt: number;
  answers: Record<string, string>;
  flagged: Record<string, true>;
  submittedAt?: number;
  result?: ExamResult;
};

/** Whole minutes within the allowed range, or null when the text is not a usable number. */
export function parseMinutes(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  return n >= MIN_MINUTES && n <= MAX_MINUTES ? n : null;
}

/** 5:07, or 1:05:07 from one hour up. Never negative. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

type Store = Record<string, ExamSession>;

function read(): Store {
  try {
    const raw = localStorage.getItem(PAPER_EXAM_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store): void {
  try {
    localStorage.setItem(PAPER_EXAM_KEY, JSON.stringify(store));
  } catch {
    /* storage full or blocked: the sitting just won't survive a reload */
  }
}

export function getExam(lessonId: string): ExamSession | null {
  return read()[lessonId] ?? null;
}

export function startExam(lessonId: string, scope: ExamScope, minutes: number, now = Date.now()): ExamSession {
  const session: ExamSession = {
    lessonId,
    scope,
    minutes,
    startedAt: now,
    endsAt: now + minutes * 60_000,
    answers: {},
    flagged: {},
  };
  const store = read();
  store[lessonId] = session;
  write(store);
  rememberMinutes(minutes);
  return session;
}

function update(lessonId: string, fn: (s: ExamSession) => void): ExamSession | null {
  const store = read();
  const s = store[lessonId];
  if (!s) return null;
  fn(s);
  write(store);
  return s;
}

export function setExamAnswer(lessonId: string, itemId: string, choiceId: string): ExamSession | null {
  return update(lessonId, (s) => {
    s.answers[itemId] = choiceId;
  });
}

export function clearExamAnswer(lessonId: string, itemId: string): ExamSession | null {
  return update(lessonId, (s) => {
    delete s.answers[itemId];
  });
}

export function toggleExamFlag(lessonId: string, itemId: string): ExamSession | null {
  return update(lessonId, (s) => {
    if (s.flagged[itemId]) delete s.flagged[itemId];
    else s.flagged[itemId] = true;
  });
}

export function finishExam(lessonId: string, result: ExamResult, now = Date.now()): ExamSession | null {
  return update(lessonId, (s) => {
    s.submittedAt = now;
    s.result = result;
  });
}

export function clearExam(lessonId: string): void {
  const store = read();
  delete store[lessonId];
  write(store);
}

export function rememberMinutes(minutes: number): void {
  try {
    localStorage.setItem(LAST_MINUTES_KEY, String(minutes));
  } catch {
    /* ignore */
  }
}

export function lastMinutes(): number {
  try {
    return parseMinutes(localStorage.getItem(LAST_MINUTES_KEY) ?? "") ?? DEFAULT_MINUTES;
  } catch {
    return DEFAULT_MINUTES;
  }
}
