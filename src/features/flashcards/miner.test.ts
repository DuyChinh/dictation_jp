import { describe, expect, it } from "vitest";
import { MAX_ANGLE, MIN_LEN, PIVOT, H, SCENES, W, hits, launch, layoutNuggets, maxLen, newClaw, stepClaw, swingAngle, tipOf, type Box, type Claw, type Scene } from "./miner";

const run = (c: Claw, boxes: Array<Box | null>, steps: number, dt = 16, scene: Scene = SCENES.wide) => {
  let claw = c;
  const events = [];
  for (let i = 0; i < steps; i++) {
    const r = stepClaw(claw, dt, boxes, scene);
    claw = r.claw;
    if (r.event) events.push(r.event);
  }
  return { claw, events };
};

describe("claw geometry", () => {
  it("swings between the two limits", () => {
    const angles = Array.from({ length: 280 }, (_, i) => swingAngle(i * 10));
    expect(Math.max(...angles)).toBeLessThanOrEqual(MAX_ANGLE);
    expect(Math.min(...angles)).toBeGreaterThanOrEqual(-MAX_ANGLE);
    expect(Math.max(...angles)).toBeGreaterThan(MAX_ANGLE - 1);
  });
  it("hangs straight down at 0 degrees and to the right at positive angles", () => {
    expect(tipOf(0, 10)).toEqual({ x: PIVOT.x, y: PIVOT.y + 10 });
    expect(tipOf(45, 10).x).toBeGreaterThan(PIVOT.x);
    expect(tipOf(-45, 10).x).toBeLessThan(PIVOT.x);
  });
  it("stops the rope at the walls and floor", () => {
    for (const a of [-66, -30, 0, 30, 66]) {
      const p = tipOf(a, maxLen(a));
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(W);
      expect(p.y).toBeLessThanOrEqual(H);
    }
    expect(maxLen(0)).toBeCloseTo(H - 2 - PIVOT.y);
  });
  it("hits a box with a little reach around it", () => {
    const b = { x: 40, y: 30, w: 20, h: 10 };
    expect(hits({ x: 50, y: 35 }, b)).toBe(true);
    expect(hits({ x: 38.5, y: 35 }, b)).toBe(true);
    expect(hits({ x: 30, y: 35 }, b)).toBe(false);
  });
});

describe("stepClaw", () => {
  const box: Box = { x: 40, y: 30, w: 20, h: 10 };

  it("keeps swinging until launched, then holds its angle while it goes out", () => {
    const swung = run(newClaw(), [box], 50).claw;
    expect(swung.phase).toBe("swing");
    expect(swung.angle).not.toBe(0);
    const out = run(launch(swung), [], 5).claw;
    expect(out.phase).toBe("extend");
    expect(out.angle).toBe(swung.angle);
    expect(out.len).toBeGreaterThan(MIN_LEN);
  });

  it("catches what it touches, brings it back, and reports it on arrival", () => {
    const { claw, events } = run(launch(newClaw()), [box], 400);
    expect(events).toEqual([{ type: "caught", index: 0 }, { type: "arrived", index: 0 }]);
    expect(claw.phase).toBe("swing");
    expect(claw.len).toBe(MIN_LEN);
  });

  it("brings nothing back when it misses everything", () => {
    const away: Box = { x: 0, y: 40, w: 10, h: 10 };
    const { events } = run(launch(newClaw()), [away], 800);
    expect(events).toEqual([{ type: "arrived", index: null }]);
  });

  it("ignores boxes that were already taken", () => {
    const { events } = run(launch(newClaw()), [null], 800);
    expect(events).toEqual([{ type: "arrived", index: null }]);
  });

  it("will not launch again while the claw is out", () => {
    const out = launch(newClaw());
    expect(launch(out)).toBe(out);
  });
});

describe("scenes", () => {
  it("the tall scene lets the rope go further down than the wide one", () => {
    expect(maxLen(0, SCENES.tall)).toBeCloseTo(SCENES.tall.H - 2 - PIVOT.y);
    expect(maxLen(0, SCENES.tall)).toBeGreaterThan(maxLen(0, SCENES.wide));
  });

  it("catches in the tall scene too, with a box far down the field", () => {
    const deep: Box = { x: 30, y: 70, w: 40, h: 14 };
    const { events } = run(launch(newClaw()), [deep], 900, 16, SCENES.tall);
    expect(events).toEqual([{ type: "caught", index: 0 }, { type: "arrived", index: 0 }]);
  });

  it("lays out separate, in-bounds nuggets on either scene, however the nudges fall", () => {
    for (let round = 0; round < 150; round++) for (const scene of [SCENES.wide, SCENES.tall] as Scene[]) {
      for (let n = 2; n <= 4; n++) {
        const boxes = layoutNuggets(n, Math.random, scene);
        expect(boxes).toHaveLength(n);
        for (const b of boxes) {
          expect(b.x).toBeGreaterThan(0);
          expect(b.x + b.w).toBeLessThan(W);
          expect(b.y).toBeGreaterThan(PIVOT.y + MIN_LEN + 4);
          expect(b.y + b.h).toBeLessThan(scene.H - 2);
        }
        boxes.forEach((a, i) =>
          boxes.slice(i + 1).forEach((b) => {
            expect(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y).toBe(true);
          }),
        );
      }
    }
  });
});

describe("layoutNuggets", () => {
  it("makes separate boxes that stay inside the scene and below the miner", () => {
    for (let n = 2; n <= 6; n++) for (let round = 0; round < 150; round++) {
      const boxes = layoutNuggets(n);
      expect(boxes).toHaveLength(n);
      for (const b of boxes) {
        expect(b.x).toBeGreaterThan(0);
        expect(b.x + b.w).toBeLessThan(W);
        expect(b.y).toBeGreaterThan(PIVOT.y + MIN_LEN + 4);
        expect(b.y + b.h).toBeLessThan(H - 2);
      }
      boxes.forEach((a, i) =>
        boxes.slice(i + 1).forEach((b) => {
          const apart = a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y;
          expect(apart).toBe(true);
        }),
      );
    }
  });
});
