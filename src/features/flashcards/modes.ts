import type { IconName } from "../../shared/ui/Icon";

/** The ways to study a deck, with the fewest cards each needs. */
export const MODES = [
  { id: "learn", icon: "card", min: 1 },
  { id: "test", icon: "file", min: 1 },
  { id: "match", icon: "grid", min: 2 },
  { id: "memory", icon: "sparkles", min: 2 },
  { id: "drop", icon: "flag", min: 2 },
  { id: "blitz", icon: "clock", min: 2 },
  { id: "millionaire", icon: "crown", min: 4 },
  { id: "miner", icon: "gem", min: 2 },
] as const satisfies ReadonlyArray<{ id: string; icon: IconName; min: number }>;

export type ModeId = (typeof MODES)[number]["id"];
export const modeById = (id: string) => MODES.find((m) => m.id === id);
