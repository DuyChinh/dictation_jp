import type { ExamResult, ExamScope } from "../api/paper";

/**
 * A timed sitting of a lesson's written part ("phòng thi"). The deadline is a timestamp, so a
 * reload or a closed tab does not stop the clock; answers are kept as they are picked.
 */
export const PAPER_EXAM_KEY = "jd.paper_exam.v1";
const LAST_MINUTES_KEY = "jd.paper_exam_minutes.v1";
/** One line per submitted sitting, kept after the lesson's current session is replaced by a new one. */
export const PAPER_EXAM_HISTORY_KEY = "jd.paper_exam_history.v1";
const HISTORY_LIMIT = 200;
/** Only the newest sittings keep their per-question result (to open them again); older ones keep the score line. */
const DETAIL_LIMIT = 30;

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
  /** Written part: item id → choice. Listening: question id → choice. */
  answers: Record<string, string>;
  flagged: Record<string, true>;
  /** Listening: whether a question's audio may be played again (off, as in the real exam). */
  allowReplay?: boolean;
  /** Listening: units whose audio has already started, so reopening one does not play it again. */
  played?: Record<string, true>;
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

export function startExam(
  lessonId: string,
  scope: ExamScope,
  minutes: number,
  now = Date.now(),
  opts: { allowReplay?: boolean } = {},
): ExamSession {
  const session: ExamSession = {
    lessonId,
    scope,
    minutes,
    startedAt: now,
    endsAt: now + minutes * 60_000,
    answers: {},
    flagged: {},
    ...(scope === "listening" ? { allowReplay: opts.allowReplay === true, played: {} } : {}),
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

export function markExamPlayed(lessonId: string, unitId: string): ExamSession | null {
  return update(lessonId, (s) => {
    s.played = { ...(s.played ?? {}), [unitId]: true };
  });
}

export function toggleExamFlag(lessonId: string, itemId: string): ExamSession | null {
  return update(lessonId, (s) => {
    if (s.flagged[itemId]) delete s.flagged[itemId];
    else s.flagged[itemId] = true;
  });
}

export type ExamHistoryEntry = {
  lessonId: string;
  scope: ExamScope;
  minutes: number;
  startedAt: number;
  submittedAt: number;
  total: number;
  answered: number;
  correct: number;
  /** Every question with the pick and the right answer, so the sitting can be reviewed later. */
  result?: ExamResult;
};

export const sittingKey = (e: { lessonId: string; startedAt: number }) => `${e.lessonId}:${e.startedAt}`;

export function getExamHistory(): ExamHistoryEntry[] {
  try {
    const raw = localStorage.getItem(PAPER_EXAM_HISTORY_KEY);
    const list = raw ? (JSON.parse(raw) as ExamHistoryEntry[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function recordExamHistory(entry: ExamHistoryEntry): void {
  const list = getExamHistory().filter((e) => !(e.lessonId === entry.lessonId && e.startedAt === entry.startedAt));
  list.unshift(entry);
  const kept = list.slice(0, HISTORY_LIMIT).map((e, i) => (i < DETAIL_LIMIT || !e.result ? e : { ...e, result: undefined }));
  try {
    localStorage.setItem(PAPER_EXAM_HISTORY_KEY, JSON.stringify(kept));
  } catch {
    // Storage full: keep the score lines (and this sitting's detail) rather than lose the sitting altogether.
    try {
      localStorage.setItem(
        PAPER_EXAM_HISTORY_KEY,
        JSON.stringify(kept.map((e, i) => (i === 0 ? e : { ...e, result: undefined }))),
      );
    } catch {
      /* storage blocked: the sitting just won't appear in the history */
    }
  }
}

export function finishExam(lessonId: string, result: ExamResult, now = Date.now()): ExamSession | null {
  const done = update(lessonId, (s) => {
    s.submittedAt = now;
    s.result = result;
  });
  if (done) {
    recordExamHistory({
      lessonId,
      scope: done.scope,
      minutes: done.minutes,
      startedAt: done.startedAt,
      submittedAt: now,
      total: result.total,
      answered: result.answered,
      correct: result.correct,
      result,
    });
  }
  return done;
}

/** Keys (see sittingKey) of the submitted sittings whose result is still stored, so they can be opened. */
export function reviewableSittings(history: ExamHistoryEntry[] = getExamHistory()): Set<string> {
  const keys = new Set<string>();
  for (const h of history) if (h.result) keys.add(sittingKey(h));
  for (const s of Object.values(read())) if (s.submittedAt && s.result) keys.add(sittingKey(s));
  return keys;
}

/** A submitted sitting of a lesson, the current one or one kept in the history; null when its detail is gone. */
export function getExamSitting(lessonId: string, startedAt: number): ExamSession | null {
  const current = getExam(lessonId);
  if (current?.startedAt === startedAt && current.submittedAt && current.result) return current;
  const h = getExamHistory().find((e) => e.lessonId === lessonId && e.startedAt === startedAt);
  if (!h?.result) return null;
  return {
    lessonId,
    scope: h.scope,
    minutes: h.minutes,
    startedAt,
    endsAt: startedAt + h.minutes * 60_000,
    answers: {},
    flagged: {},
    submittedAt: h.submittedAt,
    result: h.result,
  };
}

/** Every lesson's current sitting (running or just submitted). */
export function listExams(): ExamSession[] {
  return Object.values(read());
}

/** Sittings not yet submitted (even if the clock ran out: opening one submits it), the one that ends soonest first. */
export function listRunningExams(): ExamSession[] {
  return listExams()
    .filter((s) => !s.submittedAt)
    .sort((a, b) => a.endsAt - b.endsAt);
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
