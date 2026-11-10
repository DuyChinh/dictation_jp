import { describe, expect, it } from "vitest";
import {
  PRIZES,
  QUESTIONS,
  audienceVotes,
  fallbackPrize,
  fiftyFifty,
  friendAdvice,
  isMilestone,
  isSafeLevel,
  millionaireStars,
  nextMilestonePrize,
  prizeAfter,
} from "./millionaire";

/** A small, well-spread generator (mulberry32), so different seeds give different streams. */
const seeded = (seed = 5) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe("the prize ladder", () => {
  it("has fifteen rungs, from 200,000 up to 250,000,000", () => {
    expect(QUESTIONS).toBe(15);
    expect(PRIZES[0]).toBe(200_000);
    expect(PRIZES[14]).toBe(250_000_000);
    expect([...PRIZES]).toEqual([200_000, 400_000, 600_000, 1_000_000, 2_000_000, 3_000_000, 6_000_000, 10_000_000, 14_000_000, 22_000_000, 30_000_000, 40_000_000, 80_000_000, 150_000_000, 250_000_000]);
    for (let i = 1; i < PRIZES.length; i++) expect(PRIZES[i]!).toBeGreaterThan(PRIZES[i - 1]!);
  });
  it("pays the rung just reached, and nothing before the first", () => {
    expect([0, 1, 5, 14, 15, 99].map(prizeAfter)).toEqual([0, 200_000, 2_000_000, 150_000_000, 250_000_000, 250_000_000]);
  });
  it("falls back to the last safe prize when an answer is wrong", () => {
    expect([0, 4, 5, 9, 10, 14].map(fallbackPrize)).toEqual([0, 0, 2_000_000, 2_000_000, 22_000_000, 22_000_000]);
    expect(isSafeLevel(5)).toBe(true);
    expect(isSafeLevel(10)).toBe(true);
    expect(isSafeLevel(6)).toBe(false);
  });
  it("stops at the two safe levels, not on the last question, which ends the game", () => {
    expect([4, 5, 6, 9, 10, 11, 14, 15].map(isMilestone)).toEqual([false, true, false, false, true, false, false, false]);
  });
  it("names the next safe prize, then the top one", () => {
    expect([0, 4, 5, 9, 10, 14].map(nextMilestonePrize)).toEqual([2_000_000, 2_000_000, 22_000_000, 22_000_000, 250_000_000, 250_000_000]);
  });
  it("gives stars for how far the player got", () => {
    expect([0, 4, 5, 9, 10, 14, 15].map(millionaireStars)).toEqual([0, 0, 1, 1, 2, 2, 3]);
  });
});

describe("50:50", () => {
  it("takes away two wrong answers and never the right one", () => {
    for (let i = 0; i < 200; i++) {
      const correct = i % 4;
      const gone = fiftyFifty(4, correct, seeded(i + 1));
      expect(gone).toHaveLength(2);
      expect(gone).not.toContain(correct);
      expect(new Set(gone).size).toBe(2);
    }
  });
  it("leaves one wrong answer standing when there are few to start with", () => {
    expect(fiftyFifty(3, 0, seeded())).toHaveLength(1);
    expect(fiftyFifty(2, 1)).toEqual([]);
  });
});

describe("ask the audience", () => {
  it("always adds up to 100 and gives nothing to removed answers", () => {
    for (let q = 1; q <= 15; q++) {
      for (let seed = 1; seed < 40; seed++) {
        const removed = seed % 2 ? [] : [1, 3];
        const votes = audienceVotes(4, 2, q, removed, seeded(seed));
        expect(votes.reduce((a, b) => a + b, 0)).toBe(100);
        for (const r of removed) expect(votes[r]).toBe(0);
        votes.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
      }
    }
  });
  it("backs the right answer, strongly on easy questions and less so on hard ones", () => {
    const avg = (q: number) => {
      let sum = 0;
      for (let seed = 1; seed <= 100; seed++) sum += audienceVotes(4, 1, q, [], seeded(seed))[1]!;
      return sum / 100;
    };
    expect(avg(1)).toBeGreaterThan(75);
    expect(avg(15)).toBeLessThan(avg(1));
    expect(avg(15)).toBeGreaterThan(30);
  });
  it("puts it all on the right answer when it is the only one left", () => {
    expect(audienceVotes(4, 2, 7, [0, 1, 3], seeded())).toEqual([0, 0, 100, 0]);
  });
});

describe("phone a friend", () => {
  it("usually names the right answer on an easy question, sounding sure", () => {
    let right = 0;
    for (let seed = 1; seed <= 200; seed++) if (friendAdvice(4, 3, 1, [], seeded(seed)).pick === 3) right++;
    expect(right).toBeGreaterThan(170);
    expect(friendAdvice(4, 3, 1, [], () => 0.1).tone).toBe("sure");
  });
  it("is wrong more often, and less sure, on a hard one", () => {
    let right = 0;
    for (let seed = 1; seed <= 200; seed++) if (friendAdvice(4, 3, 15, [], seeded(seed)).pick === 3) right++;
    expect(right).toBeLessThan(170);
    expect(right).toBeGreaterThan(80);
    const wrong = friendAdvice(4, 3, 15, [], (() => { const r = [0.99, 0.2, 0.5]; let i = 0; return () => r[i++ % r.length]!; })());
    expect(wrong.pick).not.toBe(3);
    expect(wrong.tone).not.toBe("sure");
  });
  it("never points at an answer 50:50 took away", () => {
    for (let seed = 1; seed <= 100; seed++) expect([0, 2]).toContain(friendAdvice(4, 0, 14, [1, 3], seeded(seed)).pick);
  });
});
