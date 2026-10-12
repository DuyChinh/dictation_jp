import { useEffect, useState } from "react";
import { fetchMyScore, type MyScore } from "../api/leaderboard";

/** How long a fetched score is reused before another page asks again. */
const FRESH_MS = 10_000;

let current: MyScore | null = null;
let fetchedAt = 0;
let inFlight: Promise<void> | null = null;
const listeners = new Set<(score: MyScore | null) => void>();

function publish(score: MyScore | null) {
  current = score;
  for (const fn of listeners) fn(score);
}

/** Asks the server for the signed-in learner's score; a recent answer is reused unless `force` is set. */
export function refreshMyScore(force = false): Promise<void> {
  if (!localStorage.getItem("token")) {
    if (current) publish(null);
    return Promise.resolve();
  }
  if (inFlight) return inFlight;
  if (!force && current && Date.now() - fetchedAt < FRESH_MS) return Promise.resolve();
  inFlight = fetchMyScore()
    .then((score) => {
      fetchedAt = Date.now();
      publish(score);
    })
    .catch(() => {})
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function clearMyScore() {
  fetchedAt = 0;
  publish(null);
}

/** The signed-in learner's points and rank, kept current as they study. */
export function useMyScore(enabled: boolean): MyScore | null {
  const [score, setScore] = useState<MyScore | null>(enabled ? current : null);
  useEffect(() => {
    if (!enabled) {
      setScore(null);
      return;
    }
    setScore(current);
    listeners.add(setScore);
    void refreshMyScore();
    return () => {
      listeners.delete(setScore);
    };
  }, [enabled]);
  return enabled ? score : null;
}
