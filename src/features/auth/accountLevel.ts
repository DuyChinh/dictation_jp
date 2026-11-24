import { useEffect, useRef } from "react";
import { apiUrl } from "../../shared/env";
import { useLevel, type JlptLevel } from "../../shared/context/LevelContext";

const LEVELS: JlptLevel[] = ["ALL", "N1", "N2", "N3", "N4", "N5"];
export const parseLevel = (v: unknown): JlptLevel | null => (typeof v === "string" && (LEVELS as string[]).includes(v) ? (v as JlptLevel) : null);

/** Keeps the chosen level on the account; false when it could not be saved (offline, signed out). */
export async function saveAccountLevel(level: JlptLevel): Promise<boolean> {
  let token: string | null = null;
  try {
    token = localStorage.getItem("token");
  } catch {
    /* no storage */
  }
  if (!token) return false;
  try {
    const res = await fetch(apiUrl("/api/auth/level"), {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ level }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * The level a learner picked belongs to the account, not to one browser: on sign-in the account's level is
 * taken over (so a new device starts from it instead of "all levels"); an account with none yet takes this
 * device's choice; and later changes are saved to the account.
 */
export function useAccountLevelSync(user: { _id: string; jlptLevel?: string } | null): void {
  const { level, setLevel, chosen } = useLevel();
  const reconciledFor = useRef<string | null>(null);
  /** The level known to be on the account, so only a real change is sent. */
  const onAccount = useRef<JlptLevel | null>(null);

  useEffect(() => {
    if (!user) {
      reconciledFor.current = null;
      onAccount.current = null;
      return;
    }
    if (reconciledFor.current !== user._id) {
      reconciledFor.current = user._id;
      const server = parseLevel(user.jlptLevel);
      if (server) {
        onAccount.current = server;
        if (server !== level) setLevel(server);
      } else if (chosen) {
        onAccount.current = level;
        void saveAccountLevel(level).then((ok) => {
          if (!ok) onAccount.current = null;
        });
      }
      return;
    }
    if (chosen && level !== onAccount.current) {
      onAccount.current = level;
      void saveAccountLevel(level).then((ok) => {
        if (!ok) onAccount.current = null;
      });
    }
  }, [user, level, chosen, setLevel]);
}
