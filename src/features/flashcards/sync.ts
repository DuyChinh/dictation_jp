import { apiUrl } from "../../shared/env";
import { hasUnsynced } from "./merge";
import { mergeIntoLocal, readState, setChangeHandler } from "./store";
import type { FlashState } from "./types";

const DEBOUNCE_MS = 2000;
let timer: ReturnType<typeof setTimeout> | null = null;
let running: Promise<boolean> | null = null;

const token = () => {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
};

/**
 * Sends this device's decks and cards to the account and keeps what comes back (the server merges the
 * two copies). Does nothing when signed out. Returns whether the account copy is now up to date.
 */
export function syncFlashcards(): Promise<boolean> {
  if (running) return running;
  const t = token();
  if (!t) return Promise.resolve(false);
  running = (async () => {
    try {
      const sent = readState();
      const res = await fetch(apiUrl("/api/flashcards"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify(sent),
      });
      if (!res.ok) return false;
      const remote = (await res.json()) as FlashState;
      const merged = mergeIntoLocal({ decks: remote.decks ?? [], cards: remote.cards ?? [] });
      // Edits made while the request was in flight go up in the next round.
      if (hasUnsynced(merged, remote)) scheduleSync();
      return true;
    } catch {
      return false;
    } finally {
      running = null;
    }
  })();
  return running;
}

export function scheduleSync(): void {
  if (!token()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncFlashcards();
  }, DEBOUNCE_MS);
}

setChangeHandler(scheduleSync);
