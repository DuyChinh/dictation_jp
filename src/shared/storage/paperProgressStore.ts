import { apiUrl } from "../env";

/**
 * Progress through a lesson's written part (vocab / grammar / reading), cached in this browser and synced to the account.
 * Answers store only the pick and whether it was right; the explanations are fetched again from
 * the server when an answered question is reopened.
 */
export const PAPER_PROGRESS_KEY = "jd.paper_progress.v1";
export const PAPER_PROGRESS_SYNC_KEY = "jd.paper_progress_sync.v1";
export const PAPER_PROGRESS_CHANGED = "jd:paper-progress";

export type PaperAnswer = {
  choiceId: string;
  correct: boolean;
  at: number;
  part: "vocab" | "grammar" | "reading";
  /** 問題 number of the question, to reopen it; absent on answers saved before it was kept. */
  mondai?: number;
};
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

/** Every lesson's written-part progress, for the recent-activity views. */
export function getAllPaperProgress(): Store {
  return read();
}

export function getPaperProgress(lessonId: string): PaperProgress {
  const p = read()[lessonId];
  return { answers: p?.answers ?? {}, sentences: p?.sentences ?? {} };
}

function update(lessonId: string, fn: (p: PaperProgress) => void): PaperProgress {
  const store = read();
  const before = store[lessonId] ?? { answers: {}, sentences: {} };
  const p = { answers: { ...before.answers }, sentences: { ...before.sentences } };
  fn(p);
  store[lessonId] = p;
  write(store);
  const state = readSync();
  for (const kind of ["answer", "sentence"] as const) {
    const oldValues = kind === "answer" ? before.answers : before.sentences;
    const values = kind === "answer" ? p.answers : p.sentences;
    for (const itemId of new Set([...Object.keys(oldValues), ...Object.keys(values)])) {
      if (JSON.stringify(oldValues[itemId]) === JSON.stringify(values[itemId])) continue;
      const key = changeKey({ lessonId, kind, itemId });
      state[key] = { lessonId, kind, itemId, value: values[itemId] ?? null,
        at: Math.max(Date.now(), (state[key]?.at ?? 0) + 1), pending: true };
    }
  }
  writeSync(state);
  window.dispatchEvent(new Event(PAPER_PROGRESS_CHANGED));
  void uploadPaperProgress();
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

/**
 * Start a part of the written exam over: forget its answers and, for the parts that have passages to
 * translate (問題9 cloze sits in grammar, 問題10–14 in reading), the translation marks of those passages.
 */
export function resetPaperPart(lessonId: string, part: PaperAnswer["part"]): PaperProgress {
  const marker = part === "reading" ? "-r-p" : part === "grammar" ? "-g-p" : null;
  return update(lessonId, (p) => {
    for (const [id, a] of Object.entries(p.answers)) if (a.part === part) delete p.answers[id];
    if (marker) for (const id of Object.keys(p.sentences)) if (id.includes(marker)) delete p.sentences[id];
  });
}

/** Start some 問題 of the written exam over: forget the answers to these questions and the translation marks of these passages. */
export function resetPaperMondai(lessonId: string, itemIds: string[], passageIds: string[]): PaperProgress {
  return update(lessonId, (p) => {
    for (const id of itemIds) delete p.answers[id];
    for (const id of Object.keys(p.sentences)) {
      if (passageIds.some((pid) => id.startsWith(`${pid}-`))) delete p.sentences[id];
    }
  });
}

type Change = {
  lessonId: string;
  kind: "answer" | "sentence";
  itemId: string;
  value: PaperAnswer | SentenceStatus | null;
  at: number;
};
type SyncState = Record<string, Change & { pending?: boolean }>;
const changeKey = (c: Pick<Change, "lessonId" | "kind" | "itemId">) => JSON.stringify([c.lessonId, c.kind, c.itemId]);

function readSync(): SyncState {
  try { return JSON.parse(localStorage.getItem(PAPER_PROGRESS_SYNC_KEY) ?? "{}"); }
  catch { return {}; }
}

function writeSync(state: SyncState): void {
  try { localStorage.setItem(PAPER_PROGRESS_SYNC_KEY, JSON.stringify(state)); }
  catch { /* Browser storage unavailable. */ }
}

/** Upgrade answers saved by versions that only stored written progress locally. Call after account ownership is checked. */
export function preparePaperProgressSync(): void {
  const state = readSync();
  for (const [lessonId, p] of Object.entries(read())) {
    for (const kind of ["answer", "sentence"] as const) {
      const values = kind === "answer" ? p.answers : p.sentences;
      for (const [itemId, value] of Object.entries(values ?? {})) {
        const key = changeKey({ lessonId, kind, itemId });
        state[key] ??= { lessonId, kind, itemId, value, at: typeof value === "object" ? value.at : Date.now(), pending: true };
      }
    }
  }
  writeSync(state);
}

let upload: Promise<void> = Promise.resolve();

/** Persist a retryable outbox; a refused or interrupted request must not lose the answer. */
export function uploadPaperProgress(): Promise<void> {
  const token = localStorage.getItem("token");
  if (!token) return Promise.resolve();
  upload = upload.catch(() => {}).then(async () => {
    if (localStorage.getItem("token") !== token) return;
    const pending = Object.values(readSync()).filter((c) => c.pending);
    for (let i = 0; i < pending.length; i += 1000) {
      if (localStorage.getItem("token") !== token) return;
      const batch = pending.slice(i, i + 1000);
      try {
        const res = await fetch(apiUrl("/api/progress/paper"), {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ changes: batch.map(({ pending: _pending, ...c }) => c) }),
          keepalive: batch.length <= 20,
        });
        if (!res.ok || localStorage.getItem("token") !== token) return;
        const state = readSync();
        for (const c of batch) {
          const key = changeKey(c);
          if (state[key]?.at === c.at) state[key]!.pending = false;
        }
        writeSync(state);
      } catch { return; }
    }
  });
  return upload;
}

/** Merge per question so work on another device cannot erase this device's newer work. Resets are synced too. */
export async function syncPaperProgressFromServer(lessonId?: string): Promise<void> {
  const token = localStorage.getItem("token");
  if (!token) return;
  await uploadPaperProgress();
  try {
    if (localStorage.getItem("token") !== token) return;
    const suffix = lessonId ? `/${encodeURIComponent(lessonId)}` : "";
    const res = await fetch(apiUrl(`/api/progress/paper${suffix}`), { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await res.json() as { changes?: Change[] };
    if (!Array.isArray(data.changes) || localStorage.getItem("token") !== token) return;
    const state = readSync();
    const store = read();
    for (const c of data.changes) {
      if (lessonId && c.lessonId !== lessonId) continue;
      const key = changeKey(c);
      if (state[key] && state[key]!.at > c.at) continue;
      state[key] = c;
      const p = store[c.lessonId] ??= { answers: {}, sentences: {} };
      if (c.kind === "answer") {
        if (c.value === null) delete p.answers[c.itemId];
        else p.answers[c.itemId] = c.value as PaperAnswer;
      } else {
        if (c.value === null) delete p.sentences[c.itemId];
        else p.sentences[c.itemId] = c.value as SentenceStatus;
      }
    }
    writeSync(state);
    write(store);
    window.dispatchEvent(new Event(PAPER_PROGRESS_CHANGED));
  } catch { /* Offline: cached answers and the outbox remain available. */ }
}
