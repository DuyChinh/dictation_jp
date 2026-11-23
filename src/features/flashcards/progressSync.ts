import { useSyncExternalStore } from "react";
import { apiUrl } from "../../shared/env";
import { exportGames, importGames, setProgressChangeHandler } from "./gameProgress";
import { exportLearn, importLearn, learnFromWire, learnToWire, type SavedLearn } from "./learnProgress";

/**
 * Keeps the games and study rounds left half way on the account, so signing in on another device offers
 * "Continue" there too. Locally they live in gameProgress.ts and learnProgress.ts; this copies them up and down.
 * Keys on the wire: "g:<deckId>:<game>" and "l:<deckId>". Each entry is { at, data }, `data` null once it is over,
 * and for every key the newer `at` wins on both sides.
 */
type Entry = { at: number; data: Record<string, unknown> | null };
type Wire = Record<string, Entry>;

/** What was last known to be on the account, per key, so only what changed since is sent. */
export const PROGRESS_SYNC_KEY = "jd.flash_progress_sync.v1";
const DEBOUNCE_MS = 3000;
/** Stay under the server's request size limit (1 MB) and its per-entry limit. */
const MAX_BODY_CHARS = 600_000;
const MAX_ENTRY_CHARS = 250_000;

const token = (): string | null => {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
};

function readSent(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(PROGRESS_SYNC_KEY) ?? "{}") as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, number>) : {};
  } catch {
    return {};
  }
}
function writeSent(sent: Record<string, number>): void {
  try {
    if (Object.keys(sent).length === 0) localStorage.removeItem(PROGRESS_SYNC_KEY);
    else localStorage.setItem(PROGRESS_SYNC_KEY, JSON.stringify(sent));
  } catch {
    /* the next sync just sends a little more */
  }
}

/** Everything saved on this device, as it goes to the account. */
export function collectProgress(): Wire {
  const wire: Wire = {};
  for (const [k, e] of Object.entries(exportGames())) wire[`g:${k}`] = { at: e.at, data: e.data as Entry["data"] };
  for (const [id, s] of Object.entries(exportLearn())) wire[`l:${id}`] = { at: s.at, data: learnToWire(s) };
  return wire;
}

// a counter that moves whenever the account's copy changed what this device holds, so pages showing "Continue" redraw
let version = 0;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
/** Re-renders the component when progress from the account arrives. */
export function useProgressVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => 0);
}

/** Takes in the account's copy; returns whether this device's saved progress changed. */
export function applyRemoteProgress(remote: Wire): boolean {
  const games: Record<string, unknown> = {};
  const learn: Record<string, SavedLearn> = {};
  for (const [k, e] of Object.entries(remote)) {
    if (!e || typeof e.at !== "number") continue;
    if (k.startsWith("g:")) games[k.slice(2)] = e;
    else if (k.startsWith("l:")) {
      const s = learnFromWire(e.at, e.data);
      if (s) learn[k.slice(2)] = s;
    }
  }
  const changed = importGames(games) || importLearn(learn);
  if (changed) {
    version++;
    for (const l of listeners) l();
  }
  return changed;
}

async function call(method: "GET" | "PUT", t: string, body?: Wire): Promise<Wire | null> {
  try {
    const res = await fetch(apiUrl("/api/flashcards/progress"), {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: body ? JSON.stringify({ progress: body }) : undefined,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { progress?: Wire };
    return json.progress && typeof json.progress === "object" ? json.progress : {};
  } catch {
    return null;
  }
}

/** Splits entries into requests that each fit under the size limit. */
function batches(entries: Array<[string, Entry]>): Array<Array<[string, Entry]>> {
  const out: Array<Array<[string, Entry]>> = [];
  let cur: Array<[string, Entry]> = [];
  let size = 0;
  for (const item of entries) {
    const n = JSON.stringify(item[1]).length + item[0].length + 10;
    if (cur.length && size + n > MAX_BODY_CHARS) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(item);
    size += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let running: Promise<boolean> | null = null;

/**
 * Sends what changed on this device, takes in what the account holds, and keeps the newer of each.
 * Does nothing when signed out. Returns whether the account copy is now up to date.
 */
export function syncProgress(): Promise<boolean> {
  if (running) return running;
  const t = token();
  if (!t) return Promise.resolve(false);
  running = (async () => {
    try {
      const sent = readSent();
      const dirty = Object.entries(collectProgress()).filter(([k, e]) => sent[k] !== e.at && JSON.stringify(e).length <= MAX_ENTRY_CHARS);
      const justSent: Record<string, number> = {};
      let remote: Wire | null = null;
      if (dirty.length === 0) remote = await call("GET", t);
      else {
        for (const batch of batches(dirty)) {
          remote = await call("PUT", t, Object.fromEntries(batch));
          if (!remote) return false;
          for (const [k, e] of batch) justSent[k] = e.at;
          applyRemoteProgress(remote);
        }
      }
      if (!remote) return false;
      applyRemoteProgress(remote);
      // an entry is settled when the account holds this very copy; anything saved while the request was out goes next time
      const next: Record<string, number> = {};
      for (const [k, e] of Object.entries(collectProgress())) {
        if (remote[k]?.at === e.at || justSent[k] === e.at || sent[k] === e.at) next[k] = e.at;
      }
      writeSent(next);
      const stillDirty = Object.entries(collectProgress()).some(([k, e]) => next[k] !== e.at && JSON.stringify(e).length <= MAX_ENTRY_CHARS);
      if (stillDirty) scheduleProgressSync();
      return true;
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Soon, and once for a burst of saves. */
export function scheduleProgressSync(): void {
  if (!token() || timer) return;
  timer = setTimeout(() => {
    timer = null;
    void syncProgress();
  }, DEBOUNCE_MS);
}

setProgressChangeHandler(scheduleProgressSync);
