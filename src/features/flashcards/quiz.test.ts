import { describe, expect, it } from "vitest";
import {
  buildDropRound,
  buildMatchRound,
  buildTest,
  checkAnswer,
  dropNext,
  fallSeconds,
  gradeTest,
  isAnswered,
  matchGroupSizes,
  sidesOf,
  startDrop,
  toHiragana,
  type Question,
  type TestOptions,
} from "./quiz";
import type { Card } from "./types";

const card = (id: string, term: string, definition: string, extra: Partial<Card> = {}): Card => ({
  id,
  deckId: "d",
  term,
  termLang: "ja",
  definition,
  definitionLang: "vi",
  box: 0,
  due: 0,
  right: 0,
  wrong: 0,
  createdAt: 1,
  updatedAt: 1,
  ...extra,
});

const WORDS: Card[] = [
  card("1", "食べる", "ăn", { reading: "たべる" }),
  card("2", "飲む", "uống", { reading: "のむ" }),
  card("3", "学校", "trường học", { reading: "がっこう" }),
  card("4", "先生", "giáo viên; thầy cô", { reading: "せんせい" }),
  card("5", "犬", "con chó (động vật)", { reading: "いぬ" }),
  card("6", "猫", "con mèo", { reading: "ねこ" }),
];

// a fixed "random" so shuffles are repeatable
const seeded = (seed = 7) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const ALL: TestOptions["kinds"] = { mc: true, tf: true, write: true, match: true };

describe("checkAnswer", () => {
  it("accepts the kanji, the reading or the katakana spelling of a Japanese answer", () => {
    const side = sidesOf(WORDS[0]!, true).answer; // 食べる / たべる
    expect(checkAnswer("食べる", side)).toBe("exact");
    expect(checkAnswer("たべる", side)).toBe("exact");
    expect(checkAnswer("タベル", side)).toBe("exact");
    expect(checkAnswer("のむ", side)).toBe("wrong");
    expect(toHiragana("ラーメン")).toBe("らーめん");
  });
  it("accepts any one meaning of several, and the text without its note", () => {
    const side = sidesOf(WORDS[3]!).answer; // giáo viên; thầy cô
    expect(checkAnswer("thầy cô", side)).toBe("exact");
    expect(checkAnswer("Giáo viên", side)).toBe("exact");
    expect(checkAnswer("con chó", sidesOf(WORDS[4]!).answer)).toBe("exact");
  });
  it("calls a missing accent close, still correct, and a different word wrong", () => {
    const side = sidesOf(WORDS[0]!).answer; // ăn
    expect(checkAnswer("an", side)).toBe("close");
    expect(checkAnswer("uong", side)).toBe("wrong");
    expect(checkAnswer("   ", side)).toBe("wrong");
  });
  it("does not blur Japanese voiced marks into plain kana", () => {
    const side = { text: "がっこう", lang: "ja" as const };
    expect(checkAnswer("かっこう", side)).toBe("wrong");
  });
});

describe("matchGroupSizes", () => {
  it("makes groups of at most 5 and never a lone card", () => {
    expect(matchGroupSizes(1)).toEqual([]);
    expect(matchGroupSizes(2)).toEqual([2]);
    expect(matchGroupSizes(5)).toEqual([5]);
    expect(matchGroupSizes(6)).toEqual([3, 3]);
    expect(matchGroupSizes(11)).toEqual([4, 4, 3]);
  });
});

describe("buildTest", () => {
  it("asks about each chosen card exactly once and sorts questions by type", () => {
    const qs = buildTest(WORDS, { count: 6, direction: "term", kinds: ALL }, seeded());
    const ids = qs.flatMap((q) => (q.kind === "match" ? q.pairs.map((p) => p.cardId) : [q.cardId]));
    expect(new Set(ids).size).toBe(6);
    expect(ids).toHaveLength(6);
    const order = ["mc", "tf", "match", "write"];
    const kinds = qs.map((q) => order.indexOf(q.kind));
    expect(kinds).toEqual([...kinds].sort((a, b) => a - b));
  });

  it("gives a multiple choice question one right option and distinct wrong ones", () => {
    const qs = buildTest(WORDS, { count: 6, direction: "term", kinds: { mc: true, tf: false, write: false, match: false } }, seeded(3));
    expect(qs).toHaveLength(6);
    for (const q of qs) {
      if (q.kind !== "mc") throw new Error("expected mc");
      expect(q.options).toHaveLength(4);
      expect(q.options.filter((o) => o.cardId === q.cardId)).toHaveLength(1);
      expect(new Set(q.options.map((o) => o.side.text)).size).toBe(4);
    }
  });

  it("does not offer two options with the same text as the answer", () => {
    const twins = [card("1", "犬", "chó"), card("2", "イヌ", "chó"), card("3", "猫", "mèo")];
    const qs = buildTest(twins, { count: 3, direction: "term", kinds: { mc: true, tf: false, write: false, match: false } }, seeded());
    for (const q of qs) {
      if (q.kind !== "mc") continue;
      const same = q.options.filter((o) => o.side.text === q.answer.text);
      expect(same).toHaveLength(1);
    }
  });

  it("falls back to written questions when there is nothing to choose between", () => {
    const qs = buildTest([card("1", "犬", "chó")], { count: 5, direction: "term", kinds: ALL }, seeded());
    expect(qs).toHaveLength(1);
    expect(qs[0]!.kind).toBe("write");
  });

  it("asks the definition when the direction says so", () => {
    const qs = buildTest(WORDS, { count: 6, direction: "definition", kinds: { mc: false, tf: false, write: true, match: false } }, seeded());
    for (const q of qs) {
      if (q.kind !== "write") throw new Error("expected write");
      expect(q.prompt.lang).toBe("vi");
      expect(q.answer.lang).toBe("ja");
    }
  });

  it("returns nothing when no kind is enabled", () => {
    expect(buildTest(WORDS, { count: 3, direction: "term", kinds: { mc: false, tf: false, write: false, match: false } })).toEqual([]);
  });
});

describe("gradeTest", () => {
  const questions: Question[] = [
    { kind: "mc", id: "a", cardId: "1", prompt: { text: "食べる", lang: "ja" }, answer: { text: "ăn", lang: "vi" }, options: [] },
    { kind: "tf", id: "b", cardId: "2", prompt: { text: "飲む", lang: "ja" }, answer: { text: "uống", lang: "vi" }, shown: { text: "ăn", lang: "vi" }, isTrue: false },
    { kind: "write", id: "c", cardId: "3", prompt: { text: "学校", lang: "ja" }, answer: { text: "trường học", lang: "vi" } },
    {
      kind: "match",
      id: "d",
      pairs: [
        { cardId: "4", prompt: { text: "先生", lang: "ja" }, answer: { text: "giáo viên", lang: "vi" } },
        { cardId: "5", prompt: { text: "犬", lang: "ja" }, answer: { text: "chó", lang: "vi" } },
      ],
      choices: [],
    },
  ];

  it("scores each kind and counts a matching block per pair", () => {
    const g = gradeTest(questions, { a: "1", b: "false", c: "truong hoc", d: { "4": "4", "5": "4" } });
    expect(g.total).toBe(5);
    expect(g.right).toBe(4);
    expect(g.results[2]!.cards[0]).toMatchObject({ correct: true, close: true });
    expect(g.results[3]!.cards.map((c) => c.correct)).toEqual([true, false]);
  });
  it("counts an unanswered question as wrong", () => {
    const g = gradeTest(questions, {});
    expect(g.right).toBe(0);
    expect(g.total).toBe(5);
  });
  it("knows when a question is answered", () => {
    expect(isAnswered(questions[2]!, "  ")).toBe(false);
    expect(isAnswered(questions[2]!, "x")).toBe(true);
    expect(isAnswered(questions[3]!, { "4": "4" })).toBe(false);
    expect(isAnswered(questions[3]!, { "4": "4", "5": "5" })).toBe(true);
  });
});

describe("match game", () => {
  it("makes one prompt tile and one answer tile for each card", () => {
    const tiles = buildMatchRound(WORDS, 4, "term", seeded());
    expect(tiles).toHaveLength(8);
    const byCard = new Map<string, string[]>();
    for (const t of tiles) byCard.set(t.cardId, [...(byCard.get(t.cardId) ?? []), t.kind]);
    expect(byCard.size).toBe(4);
    for (const kinds of byCard.values()) expect(kinds.sort()).toEqual(["answer", "prompt"]);
  });
});

describe("drop game", () => {
  it("offers the right answer among distinct choices", () => {
    const items = buildDropRound(WORDS, 6, "term", seeded());
    expect(items).toHaveLength(6);
    for (const item of items) {
      expect(item.options.filter((o) => o.cardId === item.cardId)).toHaveLength(1);
      expect(item.options).toHaveLength(4);
    }
  });
  it("speeds up with right answers but not past the floor", () => {
    expect(fallSeconds(0)).toBe(9);
    expect(fallSeconds(5)).toBeLessThan(fallSeconds(0));
    expect(fallSeconds(500)).toBe(3.5);
  });
  it("loses a life on a miss, scores streaks, and ends when lives run out or the words do", () => {
    let s = startDrop(5);
    s = dropNext(s, true);
    s = dropNext(s, true);
    expect(s).toMatchObject({ score: 22, streak: 2, right: 2, lives: 3 });
    s = dropNext(s, false);
    expect(s).toMatchObject({ lives: 2, streak: 0, bestStreak: 2 });
    s = dropNext(s, false);
    s = dropNext(s, false);
    expect(s.status).toBe("lost");
    expect(dropNext(s, true)).toBe(s);

    let w = startDrop(2);
    w = dropNext(dropNext(w, true), true);
    expect(w.status).toBe("won");
  });
});

describe("ratings and blitz", () => {
  it("rates stars by share right, pace and mistakes", async () => {
    const { starsForRatio, matchStars, memoryStars } = await import("./quiz");
    expect([starsForRatio(0, 5), starsForRatio(1, 5), starsForRatio(3, 5), starsForRatio(9, 10), starsForRatio(0, 0)]).toEqual([0, 1, 2, 3, 0]);
    expect(matchStars(6, 20000, 0)).toBe(3);
    expect(matchStars(6, 40000, 0)).toBe(2);
    expect(matchStars(6, 40000, 6)).toBe(1);
    expect([memoryStars(6, 3), memoryStars(6, 6), memoryStars(6, 7)]).toEqual([3, 2, 1]);
  });
  it("builds a combo multiplier from the streak, capped at x5, and resets it on a miss", async () => {
    const { blitzNext, comboMultiplier, startBlitz } = await import("./quiz");
    expect([0, 2, 3, 6, 12, 99].map(comboMultiplier)).toEqual([1, 1, 2, 3, 5, 5]);
    let s = startBlitz();
    const points: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = blitzNext(s, true);
      s = r.state;
      points.push(r.gained);
    }
    expect(points).toEqual([10, 10, 10, 20]);
    const miss = blitzNext(s, false);
    expect(miss.gained).toBe(0);
    expect(miss.state).toMatchObject({ streak: 0, bestStreak: 4, right: 4, wrong: 1, score: 50 });
  });
});

describe("where a reading is shown", () => {
  const buy = card("b", "購入", "mua; mua sắm", { reading: "こうにゅう" });

  it("keeps the reading off the Japanese question and puts it in front of the meaning", () => {
    const { prompt, answer } = sidesOf(buy);
    expect(prompt).toMatchObject({ text: "購入", reading: "こうにゅう", showReading: false });
    expect(answer).toMatchObject({ text: "mua; mua sắm", lead: "こうにゅう" });
  });

  it("shows it above the Japanese answer when the meaning is the question", () => {
    const { prompt, answer } = sidesOf(buy, true);
    expect(prompt.lead).toBeUndefined();
    expect(answer).toMatchObject({ text: "購入", reading: "こうにゅう" });
    expect(answer.showReading).toBeUndefined();
  });

  it("does not repeat a word that is already its own reading", () => {
    expect(sidesOf(card("c", "ありがとう", "cảm ơn", { reading: "ありがとう" })).answer.lead).toBeUndefined();
  });

  it("still accepts typed readings and retains the reading before meaning choices", async () => {
    const { choiceSide } = await import("./quiz");
    expect(checkAnswer("こうにゅう", sidesOf(buy, true).answer)).toBe("exact");
    expect(choiceSide(sidesOf(buy).answer)).toMatchObject({ lead: "こうにゅう", showReading: false });
    const readings = new Map([["b", "こうにゅう"], ["d", "いぬ"]]);
    const opts = buildTest([buy, card("d", "犬", "chó", { reading: "いぬ" })], { count: 2, direction: "term", kinds: { mc: true, tf: false, write: false, match: false } }, seeded());
    for (const q of opts) if (q.kind === "mc") for (const o of q.options) expect(o.side.lead).toBe(readings.get(o.cardId));
    const tiles = buildMatchRound([buy, card("d", "犬", "chó", { reading: "いぬ" })], 2, "term", seeded());
    for (const t of tiles) expect(t.side.lead).toBe(t.kind === "answer" ? readings.get(t.cardId) : undefined);
  });
});

describe("Sino-Vietnamese reading", () => {
  const buy = card("b", "購入", "mua; mua sắm", { reading: "こうにゅう", hanViet: "CẤU NHẬP" });

  it("goes at the end of the answer, whichever way the card is asked", () => {
    expect(sidesOf(buy).answer).toMatchObject({ text: "mua; mua sắm", lead: "こうにゅう", trail: "CẤU NHẬP" });
    expect(sidesOf(buy, true).answer).toMatchObject({ text: "購入", trail: "CẤU NHẬP" });
    expect(sidesOf(buy).prompt.trail).toBeUndefined();
    expect(sidesOf(buy, true).prompt.trail).toBeUndefined();
  });
  it("is left out of choices, and of cards with no Japanese in them", async () => {
    const { choiceSide } = await import("./quiz");
    expect(choiceSide(sidesOf(buy).answer).trail).toBeUndefined();
    expect(sidesOf(card("e", "to eat", "ăn", { termLang: "en", hanViet: "X" })).answer.trail).toBeUndefined();
  });
});
