import { apiFetch } from "../../shared/api/client";
import type { Card } from "./types";
import type { SharedCardData } from "./store";

export type SharedDeck = { name: string; ownerName: string; updatedAt: number; cards: SharedCardData[] };

const token = (): string => {
  try {
    return localStorage.getItem("token") ?? "";
  } catch {
    return "";
  }
};
const auth = () => ({ Authorization: `Bearer ${token()}` });

export const shareUrl = (shareId: string): string => `${window.location.origin}/flashcards/shared/${shareId}`;

/** A public deck by its share id; rejects with an ApiError (404 once it is private or gone). */
export function fetchSharedDeck(shareId: string, signal?: AbortSignal): Promise<SharedDeck> {
  return apiFetch<SharedDeck>(`/api/flashcards/shared/${encodeURIComponent(shareId)}`, { signal, cache: "no-store" });
}

/** Makes one of the signed-in user's decks public; resolves to its share id. */
export async function enableShare(deckId: string): Promise<string> {
  const r = await apiFetch<{ shareId: string }>(`/api/flashcards/decks/${encodeURIComponent(deckId)}/share`, { method: "PUT", headers: auth() });
  return r.shareId;
}

export async function disableShare(deckId: string): Promise<void> {
  await apiFetch<{ ok: true }>(`/api/flashcards/decks/${encodeURIComponent(deckId)}/share`, { method: "DELETE", headers: auth() });
}

/** The cards of a shared deck as study cards: nothing studied yet, all due. */
export function sharedToCards(shared: SharedDeck, deckId: string): Card[] {
  return shared.cards.map((c, i) => ({
    ...c,
    deckId,
    box: 0,
    due: 0,
    right: 0,
    wrong: 0,
    createdAt: i,
    updatedAt: shared.updatedAt,
  }));
}
