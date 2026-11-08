import { shuffle, type Rng } from "./quiz";

/**
 * The gold miner's claw. The scene is 100 wide and 62 tall in its own units (the page scales it), with the
 * claw hanging from a pivot near the top. It swings like a pendulum, is launched along its current angle, and
 * is pulled back with whatever it touched. Nothing here touches the page, so it can be tested directly.
 */
export const W = 100;
/** The wide scene (tablet and desktop); a phone gets the taller one from `SCENES.tall`. */
export const H = 62;
export const PIVOT = { x: 50, y: 7 };
export const MIN_LEN = 6;
export const MAX_ANGLE = 66;
export const SWING_PERIOD_MS = 2800;
/** Scene units per millisecond. */
export const EXTEND_SPEED = 0.052;
export const RETRACT_SPEED = 0.042;
const WALL = 2;
const CLAW_REACH = 2.2;

/**
 * A scene is the playing field in its own units: always 100 wide, `H` tall. The tall one suits a phone held
 * upright, with two columns of bigger nuggets so their text stays readable.
 */
export type Scene = {
  H: number;
  cols: number[];
  rows: number[];
  nugget: { w: number; h: number };
};

/** Most a nugget is nudged from its slot, kept below the gap between neighbouring slots so they never overlap. */
const JITTER = 3;

export const SCENES = {
  wide: { H: 62, cols: [19, 50, 81], rows: [30, 45], nugget: { w: 25, h: 11 } },
  tall: { H: 100, cols: [26, 74], rows: [36, 56, 76], nugget: { w: 44, h: 14 } },
} as const satisfies Record<string, Scene>;

export type Box = { x: number; y: number; w: number; h: number };
export type Phase = "swing" | "extend" | "retract";
export type Claw = { phase: Phase; t: number; angle: number; len: number; caught: number | null };
export type ClawEvent = { type: "caught"; index: number } | { type: "arrived"; index: number | null } | null;

export const swingAngle = (t: number): number => MAX_ANGLE * Math.sin((2 * Math.PI * t) / SWING_PERIOD_MS);

export const newClaw = (): Claw => ({ phase: "swing", t: 0, angle: 0, len: MIN_LEN, caught: null });

/** Where the claw's tip is: straight down at 0 degrees, to the right for a positive angle. */
export function tipOf(angle: number, len: number): { x: number; y: number } {
  const a = (angle * Math.PI) / 180;
  return { x: PIVOT.x + len * Math.sin(a), y: PIVOT.y + len * Math.cos(a) };
}

export function hits(p: { x: number; y: number }, b: Box, reach = CLAW_REACH): boolean {
  return p.x >= b.x - reach && p.x <= b.x + b.w + reach && p.y >= b.y - reach && p.y <= b.y + b.h + reach;
}

/** How far the rope can go along this angle before the claw leaves the scene. */
export function maxLen(angle: number, scene: Scene = SCENES.wide): number {
  const a = (angle * Math.PI) / 180;
  const sin = Math.sin(a);
  const cos = Math.cos(a);
  const toWall = sin > 1e-6 ? (W - WALL - PIVOT.x) / sin : sin < -1e-6 ? (WALL - PIVOT.x) / sin : Infinity;
  const toFloor = cos > 1e-6 ? (scene.H - 2 - PIVOT.y) / cos : Infinity;
  return Math.min(toWall, toFloor);
}

export const launch = (c: Claw): Claw => (c.phase === "swing" ? { ...c, phase: "extend" } : c);

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
  if (c.phase === "extend") {
    const len = c.len + EXTEND_SPEED * dt;
    const index = boxes.findIndex((b) => b !== null && hits(tipOf(c.angle, len), b));
    if (index >= 0) return { claw: { ...c, len, phase: "retract", caught: index }, event: { type: "caught", index } };
    if (len >= maxLen(c.angle, scene)) return { claw: { ...c, len: maxLen(c.angle, scene), phase: "retract" }, event: null };
    return { claw: { ...c, len }, event: null };
  }
  const len = c.len - RETRACT_SPEED * dt;
  if (len <= MIN_LEN) {
    return { claw: { ...c, len: MIN_LEN, phase: "swing", caught: null }, event: { type: "arrived", index: c.caught } };
  }
  return { claw: { ...c, len }, event: null };
}

/** Places `count` nuggets in separate spots of the digging area, nudged a little so no round looks the same. */
export function layoutNuggets(count: number, rng: Rng = Math.random, scene: Scene = SCENES.wide): Box[] {
  const { cols, rows, nugget } = scene;
  const slots = shuffle(cols.flatMap((cx) => rows.map((cy) => ({ cx, cy }))), rng).slice(0, count);
  return slots.map(({ cx, cy }) => ({
    x: cx - nugget.w / 2 + (rng() - 0.5) * JITTER,
    y: cy - nugget.h / 2 + (rng() - 0.5) * JITTER,
    w: nugget.w,
    h: nugget.h,
  }));
}
