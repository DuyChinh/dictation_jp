import type { Rng } from "./quiz";

/**
 * The gold miner. The field is 100 wide and `H` tall in its own units (the page scales it), with a winch at a
 * pivot near the top. The claw swings like a pendulum, is launched along its angle or aimed straight at one
 * nugget, and is pulled back with whatever it touched. Nothing here touches the page, so it can be tested.
 */
export const W = 100;
/** The wide field (tablet and desktop); a phone held upright gets the taller one, `SCENES.tall`. */
export const H = 62;
export const PIVOT = { x: 50, y: 7 };
export const MIN_LEN = 6;
export const MAX_ANGLE = 66;
export const SWING_PERIOD_MS = 2800;
/** Field units per millisecond. */
export const EXTEND_SPEED = 0.052;
export const RETRACT_SPEED = 0.042;
/** An empty claw comes back faster than a loaded one. */
export const EMPTY_RETRACT_BOOST = 2.2;
/** Degrees per millisecond while the claw turns to a nugget that was tapped. */
export const AIM_SPEED = 0.4;
const WALL = 2;
const CLAW_REACH = 2.2;

export type Scene = {
  H: number;
  /** Where nuggets may sit: their top-left corner within x0..x1 and y0..y1 (before subtracting their size). */
  zone: { x0: number; x1: number; y0: number; y1: number };
  nugget: { w: number; h: number };
};

export const SCENES = {
  wide: { H: 62, zone: { x0: 3, x1: 97, y0: 23, y1: 58 }, nugget: { w: 25, h: 11 } },
  tall: { H: 100, zone: { x0: 3, x1: 97, y0: 26, y1: 96 }, nugget: { w: 30, h: 16 } },
} as const satisfies Record<string, Scene>;

export type Box = { x: number; y: number; w: number; h: number };
export type Phase = "swing" | "aim" | "extend" | "retract";
export type Claw = {
  phase: Phase;
  /** Time into the swing, in ms; the swing angle follows from it. */
  t: number;
  angle: number;
  len: number;
  caught: number | null;
  /** While aiming or going out for one nugget: the angle to turn to, and which nugget it is. */
  aim?: { angle: number; index: number };
};
export type ClawEvent = { type: "caught"; index: number } | { type: "arrived"; index: number | null } | null;

export const swingAngle = (t: number): number => MAX_ANGLE * Math.sin((2 * Math.PI * t) / SWING_PERIOD_MS);

/** The swing time at which the claw is at this angle, moving to the right. */
export const timeForAngle = (angle: number): number =>
  (SWING_PERIOD_MS / (2 * Math.PI)) * Math.asin(Math.max(-1, Math.min(1, angle / MAX_ANGLE)));

export const newClaw = (): Claw => ({ phase: "swing", t: 0, angle: 0, len: MIN_LEN, caught: null });

/** Where the claw's tip is: straight down at 0 degrees, to the right for a positive angle. */
export function tipOf(angle: number, len: number): { x: number; y: number } {
  const a = (angle * Math.PI) / 180;
  return { x: PIVOT.x + len * Math.sin(a), y: PIVOT.y + len * Math.cos(a) };
}

export function hits(p: { x: number; y: number }, b: Box, reach = CLAW_REACH): boolean {
  return p.x >= b.x - reach && p.x <= b.x + b.w + reach && p.y >= b.y - reach && p.y <= b.y + b.h + reach;
}

/** How far the rope can go along this angle before the claw leaves the field. */
export function maxLen(angle: number, scene: Scene = SCENES.wide): number {
  const a = (angle * Math.PI) / 180;
  const sin = Math.sin(a);
  const cos = Math.cos(a);
  const toWall = sin > 1e-6 ? (W - WALL - PIVOT.x) / sin : sin < -1e-6 ? (WALL - PIVOT.x) / sin : Infinity;
  const toFloor = cos > 1e-6 ? (scene.H - 2 - PIVOT.y) / cos : Infinity;
  return Math.min(toWall, toFloor);
}

export const centerOf = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** The angle (degrees, 0 straight down, positive to the right) from the pivot to a point. */
export const angleTo = (p: { x: number; y: number }): number => (Math.atan2(p.x - PIVOT.x, p.y - PIVOT.y) * 180) / Math.PI;

/** Drops the claw along its current swing angle. */
export const launch = (c: Claw): Claw => (c.phase === "swing" ? { ...c, phase: "extend" } : c);

/** Turns the claw to nugget `index` and sends it straight there; only that nugget can catch it. */
export function aimAt(c: Claw, index: number, box: Box): Claw {
  if (c.phase !== "swing") return c;
  return { ...c, phase: "aim", aim: { angle: angleTo(centerOf(box)), index } };
}

/** Advances the claw by `dt` ms. `boxes` are the things that can be caught (null once taken). */
export function stepClaw(
  c: Claw,
  dt: number,
  boxes: ReadonlyArray<Box | null>,
  scene: Scene = SCENES.wide,
): { claw: Claw; event: ClawEvent } {
  if (c.phase === "swing") {
    const t = c.t + dt;
    return { claw: { ...c, t, angle: swingAngle(t) }, event: null };
  }
  if (c.phase === "aim") {
    const target = c.aim!.angle;
    const step = AIM_SPEED * dt;
    if (Math.abs(target - c.angle) <= step) {
      // the swing carries on from here once the claw is back
      return { claw: { ...c, phase: "extend", angle: target, t: timeForAngle(target) }, event: null };
    }
    return { claw: { ...c, angle: c.angle + Math.sign(target - c.angle) * step }, event: null };
  }
  if (c.phase === "extend") {
    const len = c.len + EXTEND_SPEED * dt;
    const tip = tipOf(c.angle, len);
    // an aimed claw only touches the nugget it was sent to; a dropped one touches the first it meets
    const index = c.aim
      ? (boxes[c.aim.index] && hits(tip, boxes[c.aim.index]!) ? c.aim.index : -1)
      : boxes.findIndex((b) => b !== null && hits(tip, b));
    if (index >= 0) return { claw: { ...c, len, phase: "retract", caught: index }, event: { type: "caught", index } };
    if (len >= maxLen(c.angle, scene)) return { claw: { ...c, len: maxLen(c.angle, scene), phase: "retract" }, event: null };
    return { claw: { ...c, len }, event: null };
  }
  const speed = RETRACT_SPEED * (c.caught === null ? EMPTY_RETRACT_BOOST : 1);
  const len = c.len - speed * dt;
  if (len <= MIN_LEN) {
    return { claw: { ...c, len: MIN_LEN, phase: "swing", caught: null, aim: undefined }, event: { type: "arrived", index: c.caught } };
  }
  return { claw: { ...c, len }, event: null };
}

/** Lets go of whatever is being hauled (a stick of dynamite): the claw comes back empty and fast. */
export const dropCatch = (c: Claw): Claw => (c.phase === "retract" ? { ...c, caught: null } : c);

// ---------- layout ----------

/** Does the straight line from the winch to the middle of box `i` pass through another box first? */
export function isBlocked(boxes: readonly Box[], i: number, reach = CLAW_REACH): boolean {
  const end = centerOf(boxes[i]!);
  return boxes.some((b, j) => j !== i && segmentHitsBox(PIVOT, end, b, reach));
}

/** True when the segment a→b comes within `pad` of the box (slab test on the box grown by `pad`). */
function segmentHitsBox(a: { x: number; y: number }, b: { x: number; y: number }, box: Box, pad: number): boolean {
  let t0 = 0;
  let t1 = 1;
  const d = { x: b.x - a.x, y: b.y - a.y };
  const axes: Array<[number, number, number, number]> = [
    [d.x, a.x, box.x - pad, box.x + box.w + pad],
    [d.y, a.y, box.y - pad, box.y + box.h + pad],
  ];
  for (const [delta, start, lo, hi] of axes) {
    if (Math.abs(delta) < 1e-9) {
      if (start < lo || start > hi) return false;
      continue;
    }
    let near = (lo - start) / delta;
    let far = (hi - start) / delta;
    if (near > far) [near, far] = [far, near];
    t0 = Math.max(t0, near);
    t1 = Math.min(t1, far);
    if (t0 > t1) return false;
  }
  return true;
}

const apart = (a: Box, b: Box, gap: number) => a.x + a.w + gap <= b.x || b.x + b.w + gap <= a.x || a.y + a.h + gap <= b.y || b.y + b.h + gap <= a.y;

const MAX_AIM_ANGLE = 74;
const MIN_DISTANCE = MIN_LEN + 14;
const RESTARTS = 1200;
const CANDIDATES = 80;
const GAP = 3;
/** Extra room kept around each nugget when checking that the way to another is clear. */
const CLEAR_PAD = 3.2;

function randomBox(scene: Scene, rng: Rng): Box {
  const { zone, nugget } = scene;
  return {
    x: zone.x0 + rng() * (zone.x1 - zone.x0 - nugget.w),
    y: zone.y0 + rng() * (zone.y1 - zone.y0 - nugget.h),
    w: nugget.w,
    h: nugget.h,
  };
}

const usable = (b: Box) => {
  const c = centerOf(b);
  return Math.hypot(c.x - PIVOT.x, c.y - PIVOT.y) >= MIN_DISTANCE && Math.abs(angleTo(c)) <= MAX_AIM_ANGLE;
};

/**
 * Places `count` nuggets in the digging area one after another, keeping each only if it leaves the line from
 * the winch to every nugget's middle clear. That way a dropped claw can reach any of them without being
 * stopped by another. If nothing fits after many restarts it falls back to a plain scattering (tapping a
 * nugget sends the claw straight to it either way).
 */
export function layoutNuggets(count: number, rng: Rng = Math.random, scene: Scene = SCENES.wide): Box[] {
  for (let restart = 0; restart < RESTARTS; restart++) {
    const boxes: Box[] = [];
    while (boxes.length < count) {
      let placed = false;
      for (let t = 0; t < CANDIDATES && !placed; t++) {
        const box = randomBox(scene, rng);
        if (!usable(box) || !boxes.every((o) => apart(o, box, GAP))) continue;
        const next = [...boxes, box];
        if (next.some((_, i) => isBlocked(next, i, CLEAR_PAD))) continue;
        boxes.push(box);
        placed = true;
      }
      if (!placed) break;
    }
    if (boxes.length === count) return boxes;
  }
  return scatter(count, rng, scene);
}

/** Separate boxes wherever they fit, whether or not one stands in front of another. */
function scatter(count: number, rng: Rng, scene: Scene): Box[] {
  const boxes: Box[] = [];
  for (let guard = 0; boxes.length < count && guard < 5000; guard++) {
    const box = randomBox(scene, rng);
    if (usable(box) && boxes.every((o) => apart(o, box, GAP))) boxes.push(box);
  }
  return boxes;
}

// ---------- items: skins and points ----------

export type SkinId = "gold" | "silver" | "emerald" | "ruby" | "chest" | "diamond";

/** What a haul is worth if it is the right answer, and how often each kind turns up. */
export const SKINS: ReadonlyArray<{ id: SkinId; points: number; weight: number }> = [
  { id: "gold", points: 10, weight: 38 },
  { id: "silver", points: 12, weight: 20 },
  { id: "emerald", points: 16, weight: 14 },
  { id: "ruby", points: 20, weight: 12 },
  { id: "chest", points: 25, weight: 10 },
  { id: "diamond", points: 30, weight: 6 },
];

export const skinPoints = (id: SkinId): number => SKINS.find((s) => s.id === id)!.points;

export function pickSkin(rng: Rng = Math.random): SkinId {
  const total = SKINS.reduce((n, s) => n + s.weight, 0);
  let r = rng() * total;
  for (const s of SKINS) {
    r -= s.weight;
    if (r < 0) return s.id;
  }
  return "gold";
}

// ---------- levels and scoring ----------

export const MINER_LIVES = 3;
/** The shop can sell hearts up to here, above the three a game starts with. */
export const MAX_LIVES = 5;
export const MAX_DYNAMITE = 8;
export const START_DYNAMITE = 3;
/** Time added to the clock for each right answer. */
export const TIME_PER_RIGHT_MS = 2000;

/** Points to earn in a level, and the seconds it starts with. */
export const levelTarget = (level: number): number => 100 + 80 * (level - 1);
export const levelSeconds = (level: number): number => Math.min(70, 50 + 3 * (level - 1));
/** Points for the seconds left on the clock when a level is cleared. */
export const timeBonus = (msLeft: number): number => Math.floor(Math.max(0, msLeft) / 1000) * 5;

export type Payout = { points: number; base: number; combo: number; speed: number };

/**
 * What a right answer earns: the item's worth, 5 more for each right answer in a row before it (up to 25),
 * and a bonus for a quick haul (10 within 4s, 5 within 7s).
 */
export function payout(skin: SkinId, streakBefore: number, elapsedMs: number): Payout {
  const base = skinPoints(skin);
  const combo = Math.min(5, Math.max(0, streakBefore)) * 5;
  const speed = elapsedMs <= 4000 ? 10 : elapsedMs <= 7000 ? 5 : 0;
  return { points: base + combo + speed, base, combo, speed };
}

export type MinerState = {
  level: number;
  /** Everything earned so far, and what was earned in this level (what the target counts). */
  score: number;
  levelScore: number;
  lives: number;
  streak: number;
  bestStreak: number;
  right: number;
  wrong: number;
  dynamite: number;
  /** Money to spend in the shop: every point earned, and the time bonus, less what was bought. */
  coins: number;
  /** Bought for the coming level: every point it earns counts twice. */
  double: boolean;
  /** Bought for the coming level: seconds added to its clock. */
  extraSeconds: number;
};

export const startMiner = (): MinerState => ({
  level: 1,
  score: 0,
  levelScore: 0,
  lives: MINER_LIVES,
  streak: 0,
  bestStreak: 0,
  right: 0,
  wrong: 0,
  dynamite: START_DYNAMITE,
  coins: 0,
  double: false,
  extraSeconds: 0,
});

/** What a haul is worth now: twice as much while the "double points" boost is on. */
export const boosted = (s: MinerState, points: number): number => (s.double ? points * 2 : points);

export function minerRight(s: MinerState, points: number): MinerState {
  const streak = s.streak + 1;
  return { ...s, score: s.score + points, levelScore: s.levelScore + points, coins: s.coins + points, streak, bestStreak: Math.max(s.bestStreak, streak), right: s.right + 1 };
}

export const minerWrong = (s: MinerState): MinerState => ({ ...s, lives: s.lives - 1, streak: 0, wrong: s.wrong + 1 });

export const igniteDynamite = (s: MinerState): MinerState => (s.dynamite > 0 ? { ...s, dynamite: s.dynamite - 1 } : s);

export const levelCleared = (s: MinerState): boolean => s.levelScore >= levelTarget(s.level);
export const minerOver = (s: MinerState): boolean => s.lives <= 0;

/**
 * On to the next level: the time left is paid out, a stick of dynamite is added and a lost life comes back (hearts
 * bought in the shop above the usual three are kept). The boosts of the level just played are used up.
 */
export function nextLevel(s: MinerState, msLeft: number): MinerState {
  const bonus = timeBonus(msLeft);
  return {
    ...s,
    level: s.level + 1,
    score: s.score + bonus,
    coins: s.coins + bonus,
    levelScore: 0,
    lives: s.lives < MINER_LIVES ? s.lives + 1 : s.lives,
    dynamite: Math.min(MAX_DYNAMITE, s.dynamite + 1),
    double: false,
    extraSeconds: 0,
  };
}

// ---------- the shop ----------

/** After clearing every this-many levels the miner passes through the shop. */
export const SHOP_EVERY = 2;
export const shopDue = (clearedLevel: number): boolean => clearedLevel > 0 && clearedLevel % SHOP_EVERY === 0;

export type ShopItemId = "dynamite" | "double" | "heart" | "time";
export const EXTRA_SECONDS = 15;

export const SHOP_ITEMS: ReadonlyArray<{ id: ShopItemId; price: number }> = [
  { id: "dynamite", price: 50 },
  { id: "time", price: 70 },
  { id: "double", price: 110 },
  { id: "heart", price: 130 },
];

export const priceOf = (id: ShopItemId): number => SHOP_ITEMS.find((i) => i.id === id)!.price;

/** Why an item cannot be bought right now: not enough money, or there is nothing to gain from it. */
export function shopBlock(s: MinerState, id: ShopItemId): "coins" | "full" | null {
  if (s.coins < priceOf(id)) return "coins";
  if (id === "dynamite" && s.dynamite >= MAX_DYNAMITE) return "full";
  if (id === "heart" && s.lives >= MAX_LIVES) return "full";
  if (id === "double" && s.double) return "full";
  if (id === "time" && s.extraSeconds > 0) return "full";
  return null;
}

export function buy(s: MinerState, id: ShopItemId): MinerState {
  if (shopBlock(s, id)) return s;
  const paid = { ...s, coins: s.coins - priceOf(id) };
  if (id === "dynamite") return { ...paid, dynamite: s.dynamite + 1 };
  if (id === "heart") return { ...paid, lives: s.lives + 1 };
  if (id === "double") return { ...paid, double: true };
  return { ...paid, extraSeconds: EXTRA_SECONDS };
}

/** 1 to 3 stars for how far the miner got. */
export const minerStars = (s: MinerState, clearedLevels: number): number =>
  clearedLevels >= 4 ? 3 : clearedLevels >= 2 ? 2 : s.score > 0 ? 1 : 0;
