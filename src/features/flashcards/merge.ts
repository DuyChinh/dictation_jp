import type { Card, Deck, FlashState } from "./types";

/** Mirrors the server's merge, so a device and the server agree on what survives. */
export const TOMBSTONE_MS = 60 * 24 * 3600 * 1000;

type Item = { id: string; updatedAt: number; deleted?: true };

/** For each id the newer copy wins; on a tie a deletion wins, so a stale copy never undoes a delete. */
export function mergeById<T extends Item>(a: T[], b: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of [...a, ...b]) {
    const have = byId.get(item.id);
    if (!have || item.updatedAt > have.updatedAt || (item.updatedAt === have.updatedAt && item.deleted && !have.deleted)) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()];
}

const prune = <T extends Item>(items: T[], now: number): T[] =>
  items.filter((i) => !i.deleted || now - i.updatedAt < TOMBSTONE_MS);

export function mergeState(a: FlashState, b: FlashState, now = Date.now()): FlashState {
  return { decks: prune(mergeById<Deck>(a.decks, b.decks), now), cards: prune(mergeById<Card>(a.cards, b.cards), now) };
}

/** True when `local` holds something newer than (or missing from) `remote`, so another upload is needed. */
export function hasUnsynced(local: FlashState, remote: FlashState): boolean {
  const newer = (mine: Item[], theirs: Item[]) => {
    const seen = new Map(theirs.map((i) => [i.id, i.updatedAt]));
    return mine.some((i) => (seen.get(i.id) ?? -1) < i.updatedAt);
  };
  return newer(local.decks, remote.decks) || newer(local.cards, remote.cards);
}
