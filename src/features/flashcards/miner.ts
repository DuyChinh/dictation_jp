import { shuffle, type Rng } from "./quiz";

/**
 * The gold miner's claw. The scene is 100 wide and 62 tall in its own units (the page scales it), with the
 * claw hanging from a pivot near the top. It swings like a pendulum, is launched along its current angle, and
 * is pulled back with whatever it touched. Nothing here touches the page, so it can be tested directly.
 */
export const W = 100;
export const H = 62;
export const PIVOT = { x: 50, y: 7 };
export const MIN_LEN = 6;
export const MAX_ANGLE = 66;
export const SWING_PERIOD_MS = 2800;
/** Scene units per millisecond. */
export const EXTEND_SPEED = 0.052;
export const RETRACT_SPEED = 0.042;
const WALL = 2;
const FLOOR = H - 2;
const CLAW_REACH = 2.2;

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
export function maxLen(angle: number): number {
  const a = (angle * Math.PI) / 180;
  const sin = Math.sin(a);
  const cos = Math.cos(a);
  const toWall = sin > 1e-6 ? (W - WALL - PIVOT.x) / sin : sin < -1e-6 ? (WALL - PIVOT.x) / sin : Infinity;
  const toFloor = cos > 1e-6 ? (FLOOR - PIVOT.y) / cos : Infinity;
  return Math.min(toWall, toFloor);
}

export const launch = (c: Claw): Claw => (c.phase === "swing" ? { ...c, phase: "extend" } : c);

/** Advances the claw by `dt` ms. `boxes` are the things that can be caught (null once taken). */
export function stepClaw(c: Claw, dt: number, boxes: ReadonlyArray<Box | null>): { claw: Claw; event: ClawEvent } {
  if (c.phase === "swing") {
    const t = c.t + dt;
    return { claw: { ...c, t, angle: swingAngle(t) }, event: null };
  }
  if (c.phase === "extend") {
    const len = c.len + EXTEND_SPEED * dt;
    const index = boxes.findIndex((b) => b !== null && hits(tipOf(c.angle, len), b));
    if (index >= 0) return { claw: { ...c, len, phase: "retract", caught: index }, event: { type: "caught", index } };
    if (len >= maxLen(c.angle)) return { claw: { ...c, len: maxLen(c.angle), phase: "retract" }, event: null };
    return { claw: { ...c, len }, event: null };
  }
  const len = c.len - RETRACT_SPEED * dt;
  if (len <= MIN_LEN) {
    return { claw: { ...c, len: MIN_LEN, phase: "swing", caught: null }, event: { type: "arrived", index: c.caught } };
  }
  return { claw: { ...c, len }, event: null };
}

export const NUGGET = { w: 25, h: 11 };
const COLS = [19, 50, 81];
const ROWS = [30, 45];

/** Places `count` nuggets in separate spots of the digging area, nudged a little so no round looks the same. */
export function layoutNuggets(count: number, rng: Rng = Math.random): Box[] {
  const slots = shuffle(COLS.flatMap((cx) => ROWS.map((cy) => ({ cx, cy }))), rng).slice(0, count);
  return slots.map(({ cx, cy }) => ({
    x: cx - NUGGET.w / 2 + (rng() - 0.5) * 6,
    y: cy - NUGGET.h / 2 + (rng() - 0.5) * 6,
    w: NUGGET.w,
    h: NUGGET.h,
  }));
}
