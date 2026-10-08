import { apiUrl } from "../env";
import type { ListeningAnswer } from "./listeningScoreStore";

/**
 * Submitted runs through a listening test, newest first per lesson. Submitting clears the live
 * answers (so the test starts fresh), and this is what the result and history views read.
 * Kept in this browser and, when signed in, on the account.
 */
export const LISTENING_ATTEMPTS_KEY = "jd.listening_attempts.v1";

/** Attempts kept per lesson; matches the server. */
const PER_LESSON = 50;

export type AttemptSection = { sectionId: string; total: number; right: number; wrong: number };

export type ListeningAttempt = {
  id: string;
  lessonId: string;
  /** "retry" covered only the questions picked to redo. */
  mode: "full" | "retry";
  startedAt: number | null;
  submittedAt: number;
  /** Questions in scope, answered or not. */
  total: number;
  right: number;
  wrong: number;
  sections: AttemptSection[];
  answers: Record<string, ListeningAnswer>;
};

type Store = Record<string, ListeningAttempt[]>;

function read(): Store {
  try {
    const raw = localStorage.getItem(LISTENING_ATTEMPTS_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store): void {
  try {
    localStorage.setItem(LISTENING_ATTEMPTS_KEY, JSON.stringify(store));
  } catch {
    /* storage full or blocked: history just won't persist here */
  }
}

function sortNewest(list: ListeningAttempt[]): ListeningAttempt[] {
  return [...list].sort((a, b) => b.submittedAt - a.submittedAt).slice(0, PER_LESSON);
}

function token(): string | null {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

export function getAllListeningAttempts(): Store {
  return read();
}

export function getListeningAttempts(lessonId: string): ListeningAttempt[] {
  return read()[lessonId] ?? [];
}

export function getListeningAttempt(lessonId: string, id: string): ListeningAttempt | undefined {
  return getListeningAttempts(lessonId).find((a) => a.id === id);
}

/** Sends one attempt to the account; resolves false when offline or refused. */
export async function uploadListeningAttempt(attempt: ListeningAttempt): Promise<boolean> {
  const t = token();
  if (!t) return true;
  try {
    const res = await fetch(apiUrl("/api/progress/listening-attempts"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify(attempt),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function saveListeningAttempt(attempt: ListeningAttempt): void {
  const store = read();
  const list = (store[attempt.lessonId] ?? []).filter((a) => a.id !== attempt.id);
  store[attempt.lessonId] = sortNewest([attempt, ...list]);
  write(store);
  void uploadListeningAttempt(attempt);
}

export function deleteListeningAttempt(lessonId: string, id: string): void {
  const store = read();
  store[lessonId] = (store[lessonId] ?? []).filter((a) => a.id !== id);
  write(store);
  const t = token();
  if (t) {
    void fetch(apiUrl(`/api/progress/listening-attempts/${encodeURIComponent(lessonId)}/${encodeURIComponent(id)}`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${t}` },
    }).catch(() => {});
  }
}

/** Merges the account's attempts for a lesson into this browser's; returns the merged list. */
export async function syncListeningAttemptsFromServer(lessonId: string): Promise<ListeningAttempt[]> {
  const t = token();
  if (!t) return getListeningAttempts(lessonId);
  try {
    const res = await fetch(apiUrl(`/api/progress/listening-attempts/${encodeURIComponent(lessonId)}`), {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { attempts?: ListeningAttempt[] };
      const store = read();
      const byId = new Map((store[lessonId] ?? []).map((a) => [a.id, a]));
      for (const a of data.attempts ?? []) byId.set(a.id, a);
      store[lessonId] = sortNewest([...byId.values()]);
      write(store);
    }
  } catch {
    // offline: this browser's history is still shown
  }
  return getListeningAttempts(lessonId);
}

/** Latest attempt per lesson from the account (without answers), merged in for the progress page. */
export async function syncLatestListeningAttempts(): Promise<Store> {
  const t = token();
  if (!t) return read();
  try {
    const res = await fetch(apiUrl("/api/progress/listening-attempts"), { headers: { Authorization: `Bearer ${t}` } });
    if (res.ok) {
      const data = (await res.json()) as { latest?: Record<string, ListeningAttempt> };
      const store = read();
      for (const [lessonId, a] of Object.entries(data.latest ?? {})) {
        const list = store[lessonId] ?? [];
        if (!list.some((x) => x.id === a.id)) store[lessonId] = sortNewest([a, ...list]);
      }
      write(store);
    }
  } catch {
    // offline
  }
  return read();
}
