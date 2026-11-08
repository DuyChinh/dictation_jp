import type { Card, Direction, Side } from "./types";

export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * The two sides of a card; `flip` asks for the definition and answers with the term.
 *
 * A Japanese word's reading is not drawn above it when the word is the question (that would give the
 * reading away). It is shown with the answer instead: in front of the meaning ("こうにゅう: mua"), or above
 * the Japanese answer when the meaning was the question.
 */
export function sidesOf(card: Card, flip = false): { prompt: Side; answer: Side } {
  const reading = card.reading?.trim() || undefined;
  const term: Side = { text: card.term, lang: card.termLang, reading: card.termLang === "ja" ? reading : undefined };
  const def: Side = { text: card.definition, lang: card.definitionLang, reading: card.definitionLang === "ja" ? reading : undefined };
  const { prompt, answer: bare } = flip ? { prompt: def, answer: term } : { prompt: term, answer: def };
  // the Sino-Vietnamese reading goes at the end of the answer, whichever way round the card is asked
  const hanViet = card.hanViet?.trim() || undefined;
  const answer: Side = hanViet && (term.lang === "ja" || def.lang === "ja") ? { ...bare, trail: hanViet } : bare;
  if (prompt.lang === "ja" && prompt.reading && answer.lang !== "ja") {
    const lead = prompt.reading !== prompt.text ? prompt.reading : undefined;
    return { prompt: { ...prompt, showReading: false }, answer: lead ? { ...answer, lead } : answer };
  }
  return { prompt, answer };
}

/** A side as one of several choices to pick from (a button, a tile): no reading shown, so it hints at nothing. */
export const choiceSide = (side: Side): Side => ({ ...side, showReading: false, lead: undefined, trail: undefined });

export const pickFlip = (direction: Direction, rng: Rng = Math.random): boolean =>
  direction === "definition" ? true : direction === "term" ? false : rng() < 0.5;

// ---------- answer checking ----------

/** Katakana to hiragana, so ラーメン and らーめん compare equal. */
export function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

const SPLIT = /[;；,，、/／]/;
const PAREN = /[（(][^）)]*[）)]/g;

function squash(s: string, lang: Side["lang"]): string {
  let t = s.normalize("NFKC").toLowerCase();
  if (lang === "ja") t = toHiragana(t);
  return t.replace(/[\s　.,!?;:'"“”‘’「」『』。、！？・~〜\-–—_]+/g, "");
}

/** Marks stripped from Latin text so "an" matches "ăn" as a near miss. Not for Japanese (が is か + a mark). */
const stripMarks = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").normalize("NFC");

/** Every way the learner may write the answer: the whole text, each part between ; , 、 /, each without its (notes), and the reading. */
export function acceptedAnswers(side: Side): string[] {
  const out = new Set<string>();
  const add = (s: string) => {
    const q = squash(s, side.lang);
    if (q) out.add(q);
  };
  add(side.text);
  const noParen = side.text.replace(PAREN, " ");
  add(noParen);
  for (const part of side.text.split(SPLIT)) {
    add(part);
    add(part.replace(PAREN, " "));
  }
  if (side.lang === "ja" && side.reading) add(side.reading);
  return [...out];
}

export type Verdict = "exact" | "close" | "wrong";

/** "close" means right except for accents or tone marks; it still counts as correct. */
export function checkAnswer(input: string, answer: Side): Verdict {
  const given = squash(input, answer.lang);
  if (!given) return "wrong";
  const accepted = acceptedAnswers(answer);
  if (accepted.includes(given)) return "exact";
  if (answer.lang !== "ja") {
    const bare = stripMarks(given);
    if (accepted.some((a) => stripMarks(a) === bare)) return "close";
  }
  return "wrong";
}

// ---------- test ----------

export type QuestionKind = "mc" | "tf" | "write" | "match";
export const QUESTION_KINDS: QuestionKind[] = ["mc", "tf", "write", "match"];

export type TestOptions = {
  count: number;
  direction: Direction;
  kinds: Record<QuestionKind, boolean>;
};

export type Question =
  | { kind: "mc"; id: string; cardId: string; prompt: Side; answer: Side; options: Array<{ cardId: string; side: Side }> }
  | { kind: "tf"; id: string; cardId: string; prompt: Side; answer: Side; shown: Side; isTrue: boolean }
  | { kind: "write"; id: string; cardId: string; prompt: Side; answer: Side }
  | {
      kind: "match";
      id: string;
      pairs: Array<{ cardId: string; prompt: Side; answer: Side }>;
      /** The answers, shuffled, to pick from for each prompt. */
      choices: Array<{ cardId: string; side: Side }>;
    };

export type Answer = string | Record<string, string>;

const MAX_MC_OPTIONS = 4;
const MATCH_GROUP = 5;

/** Splits n cards into the fewest groups of at most 5, as even as possible (each group has at least 2 when n >= 2). */
export function matchGroupSizes(n: number): number[] {
  if (n < 2) return [];
  const groups = Math.ceil(n / MATCH_GROUP);
  const base = Math.floor(n / groups);
  const extra = n % groups;
  return Array.from({ length: groups }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Other cards' answers that cannot be mistaken for the right one (different text). */
function distractors(card: Card, flip: boolean, pool: Card[], n: number, rng: Rng): Card[] {
  const right = acceptedAnswers(sidesOf(card, flip).answer);
  const seen = new Set<string>(right);
  const picked: Card[] = [];
  for (const c of shuffle(pool, rng)) {
    if (c.id === card.id) continue;
    const keys = acceptedAnswers(sidesOf(c, flip).answer);
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    picked.push(c);
    if (picked.length >= n) break;
  }
  return picked;
}

export function buildTest(allCards: Card[], opts: TestOptions, rng: Rng = Math.random): Question[] {
  const count = Math.max(1, Math.min(opts.count, allCards.length));
  const chosen = shuffle(allCards, rng).slice(0, count);
  const enabled = QUESTION_KINDS.filter((k) => opts.kinds[k]);
  if (!enabled.length || !chosen.length) return [];

  const withoutMatch = enabled.filter((k) => k !== "match");
  const canMatch = enabled.includes("match") && chosen.length >= 2;
  let matchCount = 0;
  if (canMatch) {
    matchCount = withoutMatch.length ? Math.min(chosen.length, Math.max(2, Math.round(chosen.length / enabled.length))) : chosen.length;
  }
  const forMatch = chosen.slice(0, matchCount);
  const rest = chosen.slice(matchCount);

  const questions: Question[] = [];
  let seq = 0;
  const nextId = () => `q${seq++}`;

  // matching blocks
  let at = 0;
  for (const size of matchGroupSizes(forMatch.length)) {
    const group = forMatch.slice(at, at + size);
    at += size;
    const pairs = group.map((c) => {
      const flip = pickFlip(opts.direction, rng);
      return { cardId: c.id, ...sidesOf(c, flip) };
    });
    questions.push({
      kind: "match",
      id: nextId(),
      pairs,
      choices: shuffle(pairs.map((p) => ({ cardId: p.cardId, side: p.answer })), rng),
    });
  }

  // the other kinds take turns; a kind that cannot be built for a card gives way to a written question
  const turns: QuestionKind[] = withoutMatch.length ? withoutMatch : ["write"];
  rest.forEach((card, i) => {
    const flip = pickFlip(opts.direction, rng);
    const { prompt, answer } = sidesOf(card, flip);
    let kind = turns[i % turns.length]!;
    if (kind === "mc") {
      const others = distractors(card, flip, allCards, MAX_MC_OPTIONS - 1, rng);
      if (others.length === 0) kind = "write";
      else {
        const options = shuffle([card, ...others], rng).map((c) => ({ cardId: c.id, side: choiceSide(sidesOf(c, flip).answer) }));
        questions.push({ kind: "mc", id: nextId(), cardId: card.id, prompt, answer, options });
        return;
      }
    }
    if (kind === "tf") {
      const others = distractors(card, flip, allCards, 1, rng);
      if (others.length === 0) kind = "write";
      else {
        const isTrue = rng() < 0.5;
        const shown = choiceSide(isTrue ? answer : sidesOf(others[0]!, flip).answer);
        questions.push({ kind: "tf", id: nextId(), cardId: card.id, prompt, answer, shown, isTrue });
        return;
      }
    }
    questions.push({ kind: "write", id: nextId(), cardId: card.id, prompt, answer });
  });

  const order: QuestionKind[] = ["mc", "tf", "match", "write"];
  return questions
    .map((q, i) => ({ q, i }))
    .sort((a, b) => order.indexOf(a.q.kind) - order.indexOf(b.q.kind) || a.i - b.i)
    .map((x) => x.q);
}

export type QuestionResult = {
  id: string;
  /** Points earned and available: one per card, so a matching block of 4 is worth 4. */
  right: number;
  total: number;
  /** For each card asked: whether it was answered right. */
  cards: Array<{ cardId: string; correct: boolean; close?: boolean }>;
};

export function gradeQuestion(q: Question, answer: Answer | undefined): QuestionResult {
  if (q.kind === "match") {
    const given = typeof answer === "object" && answer ? answer : {};
    const cards = q.pairs.map((p) => ({ cardId: p.cardId, correct: given[p.cardId] === p.cardId }));
    return { id: q.id, right: cards.filter((c) => c.correct).length, total: cards.length, cards };
  }
  const text = typeof answer === "string" ? answer : "";
  let correct = false;
  let close = false;
  if (q.kind === "mc") correct = text === q.cardId;
  else if (q.kind === "tf") correct = text === (q.isTrue ? "true" : "false");
  else {
    const v = checkAnswer(text, q.answer);
    correct = v !== "wrong";
    close = v === "close";
  }
  return { id: q.id, right: correct ? 1 : 0, total: 1, cards: [{ cardId: q.cardId, correct, close }] };
}

export function gradeTest(questions: Question[], answers: Record<string, Answer>) {
  const results = questions.map((q) => gradeQuestion(q, answers[q.id]));
  const right = results.reduce((n, r) => n + r.right, 0);
  const total = results.reduce((n, r) => n + r.total, 0);
  return { results, right, total };
}

/** Whether a question has been answered (a matching block counts once every prompt has a pick). */
export function isAnswered(q: Question, answer: Answer | undefined): boolean {
  if (q.kind === "match") return typeof answer === "object" && !!answer && q.pairs.every((p) => !!answer[p.cardId]);
  return typeof answer === "string" && answer.trim() !== "";
}

// ---------- games ----------

export type MatchTile = { tileId: string; cardId: string; side: Side; kind: "prompt" | "answer" };

/** The tiles of one round of the matching game: a term and a definition for each card, shuffled. */
export function buildMatchRound(cards: Card[], size: number, direction: Direction, rng: Rng = Math.random): MatchTile[] {
  const picked = shuffle(cards, rng).slice(0, Math.max(2, size));
  const tiles: MatchTile[] = [];
  for (const c of picked) {
    const { prompt, answer } = sidesOf(c, pickFlip(direction, rng));
    tiles.push({ tileId: `${c.id}:p`, cardId: c.id, side: choiceSide(prompt), kind: "prompt" });
    tiles.push({ tileId: `${c.id}:a`, cardId: c.id, side: choiceSide(answer), kind: "answer" });
  }
  return shuffle(tiles, rng);
}

export type DropItem = {
  cardId: string;
  prompt: Side;
  options: Array<{ cardId: string; side: Side }>;
};

/** One falling word and the choices below it; the pool supplies the wrong choices. */
export function buildDropRound(cards: Card[], count: number, direction: Direction, rng: Rng = Math.random): DropItem[] {
  return shuffle(cards, rng)
    .slice(0, count)
    .map((card) => {
      const flip = pickFlip(direction, rng);
      const { prompt } = sidesOf(card, flip);
      const others = distractors(card, flip, cards, 3, rng);
      const options = shuffle([card, ...others], rng).map((c) => ({ cardId: c.id, side: choiceSide(sidesOf(c, flip).answer) }));
      return { cardId: card.id, prompt, options };
    });
}

export const DROP_LIVES = 3;

export type DropState = {
  index: number;
  total: number;
  lives: number;
  score: number;
  streak: number;
  bestStreak: number;
  right: number;
  status: "playing" | "won" | "lost";
};

export const startDrop = (total: number): DropState => ({
  index: 0,
  total,
  lives: DROP_LIVES,
  score: 0,
  streak: 0,
  bestStreak: 0,
  right: 0,
  status: "playing",
});

/** Seconds a word takes to fall: it speeds up with every right answer, to a floor. */
export const fallSeconds = (right: number): number => Math.max(3.5, 9 - 0.35 * right);

/** The state after the current word is answered right or wrong (or reaches the ground, which is wrong). */
export function dropNext(s: DropState, correct: boolean): DropState {
  if (s.status !== "playing") return s;
  const streak = correct ? s.streak + 1 : 0;
  const next: DropState = {
    ...s,
    index: s.index + 1,
    lives: correct ? s.lives : s.lives - 1,
    score: s.score + (correct ? 10 + Math.min(streak - 1, 5) * 2 : 0),
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
    right: s.right + (correct ? 1 : 0),
  };
  if (next.lives <= 0) next.status = "lost";
  else if (next.index >= next.total) next.status = "won";
  return next;
}

// ---------- more games and ratings ----------

/** 0-3 stars for a share of right answers: 3 from 90%, 2 from 60%, 1 for anything right. */
export function starsForRatio(right: number, total: number): number {
  if (total <= 0 || right <= 0) return 0;
  const r = right / total;
  return r >= 0.9 ? 3 : r >= 0.6 ? 2 : 1;
}

/** Matching: seconds per pair plus a penalty for wrong pairs decide the stars. */
export function matchStars(pairs: number, ms: number, mistakes: number): number {
  const load = ms / 1000 / Math.max(1, pairs) + (2 * mistakes) / Math.max(1, pairs);
  return load <= 4 ? 3 : load <= 8 ? 2 : 1;
}

/** Memory: fewer wrong turns than half the pairs is 3 stars, fewer than the pairs 2. */
export function memoryStars(pairs: number, mistakes: number): number {
  return mistakes <= pairs / 2 ? 3 : mistakes <= pairs ? 2 : 1;
}

export const BLITZ_SECONDS = 60;
/** Seconds taken off the clock by a wrong answer. */
export const BLITZ_PENALTY = 3;

/** x1 at first, x2 after three right answers in a row, and so on up to x5. */
export const comboMultiplier = (streak: number): number => Math.min(5, 1 + Math.floor(streak / 3));

export type BlitzState = { score: number; streak: number; bestStreak: number; right: number; wrong: number };
export const startBlitz = (): BlitzState => ({ score: 0, streak: 0, bestStreak: 0, right: 0, wrong: 0 });

/** The state after an answer, and how many points it earned. */
export function blitzNext(s: BlitzState, correct: boolean): { state: BlitzState; gained: number } {
  const gained = correct ? 10 * comboMultiplier(s.streak) : 0;
  const streak = correct ? s.streak + 1 : 0;
  return {
    gained,
    state: {
      score: s.score + gained,
      streak,
      bestStreak: Math.max(s.bestStreak, streak),
      right: s.right + (correct ? 1 : 0),
      wrong: s.wrong + (correct ? 0 : 1),
    },
  };
}
