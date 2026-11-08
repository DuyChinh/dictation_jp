import type { Rng } from "./quiz";

/**
 * "Who wants to be a millionaire": fifteen questions up a ladder of prizes, with two safe levels to fall back
 * to and four lifelines. The rules and the numbers live here, apart from the screen, so they can be tested.
 */
export const PRIZES = [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 1000000] as const;
export const QUESTIONS = PRIZES.length;
/** Answering this many questions right makes that prize safe: a wrong answer afterwards falls back to it. */
export const SAFE_COUNTS = [5, 10] as const;
export const QUESTION_SECONDS = 30;

/** What is in hand after `correct` right answers (also what walking away pays). */
export const prizeAfter = (correct: number): number => (correct <= 0 ? 0 : PRIZES[Math.min(correct, QUESTIONS) - 1]!);

/** What a wrong answer or a run-out clock leaves: the last safe prize reached, or nothing. */
export function fallbackPrize(correct: number): number {
  const safe = [...SAFE_COUNTS].reverse().find((c) => correct >= c);
  return safe ? prizeAfter(safe) : 0;
}

export const isSafeLevel = (questionNumber: number): boolean => (SAFE_COUNTS as readonly number[]).includes(questionNumber);

/** 0 to 3 stars for how far up the ladder the player got. */
export const millionaireStars = (correct: number): number => (correct >= QUESTIONS ? 3 : correct >= 10 ? 2 : correct >= 5 ? 1 : 0);

export type Lifeline = "fifty" | "audience" | "phone" | "swap";
export const LIFELINES: readonly Lifeline[] = ["fifty", "audience", "phone", "swap"];

/** 50:50 takes away two wrong answers (or as many as can go while one wrong answer stays). Returns their indexes. */
export function fiftyFifty(optionCount: number, correctIndex: number, rng: Rng = Math.random): number[] {
  const wrong = Array.from({ length: optionCount }, (_, i) => i).filter((i) => i !== correctIndex);
  const take = Math.min(2, wrong.length - 1);
  if (take <= 0) return [];
  const out: number[] = [];
  const pool = [...wrong];
  while (out.length < take) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
  return out.sort((a, b) => a - b);
}

/**
 * How the audience votes, in whole percent adding up to 100. The right answer leads by a margin that shrinks
 * on harder (higher) questions; answers already taken away by 50:50 get nothing.
 */
export function audienceVotes(optionCount: number, correctIndex: number, questionNumber: number, removed: readonly number[] = [], rng: Rng = Math.random): number[] {
  const alive = Array.from({ length: optionCount }, (_, i) => i).filter((i) => !removed.includes(i));
  const share = Math.max(0.4, Math.min(0.88, 0.9 - 0.03 * (questionNumber - 1))) + (rng() - 0.5) * 0.12;
  const rightShare = Math.max(0.3, Math.min(0.95, share));
  const others = alive.filter((i) => i !== correctIndex);
  const weights = others.map(() => 0.2 + rng());
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const votes = new Array<number>(optionCount).fill(0);
  if (others.length === 0) {
    votes[correctIndex] = 100;
    return votes;
  }
  votes[correctIndex] = Math.round(rightShare * 100);
  others.forEach((i, k) => (votes[i] = Math.floor(((100 - votes[correctIndex]!) * weights[k]!) / total)));
  // hand out what rounding left over to the right answer's neighbours so the sum is exactly 100
  let left = 100 - votes.reduce((a, b) => a + b, 0);
  for (let k = 0; left > 0; k = (k + 1) % others.length) {
    votes[others[k]!]!++;
    left--;
  }
  return votes;
}

export type Advice = {
  /** The answer the friend names, and how sure they sound (0-100). */
  pick: number;
  confidence: number;
  tone: "sure" | "maybe" | "unsure";
};

/**
 * What a friend on the phone says. They know the answer more often on easy questions; on hard ones they may
 * point at a wrong answer, and then sound less sure.
 */
export function friendAdvice(optionCount: number, correctIndex: number, questionNumber: number, removed: readonly number[] = [], rng: Rng = Math.random): Advice {
  const knows = Math.max(0.55, Math.min(0.95, 1 - 0.035 * questionNumber));
  const alive = Array.from({ length: optionCount }, (_, i) => i).filter((i) => !removed.includes(i));
  const wrong = alive.filter((i) => i !== correctIndex);
  const right = rng() < knows || wrong.length === 0;
  const pick = right ? correctIndex : wrong[Math.floor(rng() * wrong.length)]!;
  const confidence = Math.round(Math.max(35, Math.min(98, (right ? knows : 0.45) * 100 + (rng() - 0.5) * 16)));
  return { pick, confidence, tone: confidence >= 80 ? "sure" : confidence >= 55 ? "maybe" : "unsure" };
}
