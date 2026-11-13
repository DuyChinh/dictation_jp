import { describe, expect, it } from "vitest";
import {
  AIM_SPEED,
  EMPTY_RETRACT_BOOST,
  EXTEND_SPEED,
  H,
  MAX_ANGLE,
  MIN_LEN,
  PIVOT,
  RETRACT_SPEED,
  SCENES,
  SKINS,
  W,
  aimAt,
  angleTo,
  centerOf,
  dropCatch,
  hits,
  igniteDynamite,
  isBlocked,
  launch,
  layoutNuggets,
  levelCleared,
  levelSeconds,
  levelTarget,
  maxLen,
  minerOver,
  minerRight,
  minerStars,
  minerWrong,
  newClaw,
  nextLevel,
  MAX_DYNAMITE,
  MAX_LIVES,
  EXTRA_SECONDS,
  boosted,
  buy,
  priceOf,
  shopBlock,
  shopDue,
  payout,
  pickSkin,
  startMiner,
  stepClaw,
  swingAngle,
  timeBonus,
  timeForAngle,
  tipOf,
  type Box,
  type Claw,
  type Scene,
} from "./miner";

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
  it("finds the angle to a point, and the swing time that has the claw at an angle", () => {
    expect(angleTo({ x: PIVOT.x, y: 40 })).toBeCloseTo(0);
    expect(angleTo({ x: PIVOT.x + 10, y: PIVOT.y + 10 })).toBeCloseTo(45);
    expect(angleTo({ x: PIVOT.x - 10, y: PIVOT.y + 10 })).toBeCloseTo(-45);
    for (const a of [-60, -20, 0, 33, 66]) expect(swingAngle(timeForAngle(a))).toBeCloseTo(a, 5);
  });
  it("stops the rope at the walls and floor of either field", () => {
    for (const scene of [SCENES.wide, SCENES.tall] as Scene[]) {
      for (const a of [-66, -30, 0, 30, 66]) {
        const p = tipOf(a, maxLen(a, scene));
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(W);
        expect(p.y).toBeLessThanOrEqual(scene.H);
      }
    }
    expect(maxLen(0)).toBeCloseTo(H - 2 - PIVOT.y);
    expect(maxLen(0, SCENES.tall)).toBeGreaterThan(maxLen(0));
  });
  it("hits a box with a little reach around it", () => {
    const b = { x: 40, y: 30, w: 20, h: 10 };
    expect(hits({ x: 50, y: 35 }, b)).toBe(true);
    expect(hits({ x: 38.5, y: 35 }, b)).toBe(true);
    expect(hits({ x: 30, y: 35 }, b)).toBe(false);
  });
});

describe("a dropped claw", () => {
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

  it("catches the first thing it touches, brings it back, and reports it on arrival", () => {
    const { claw, events } = run(launch(newClaw()), [box], 400);
    expect(events).toEqual([{ type: "caught", index: 0 }, { type: "arrived", index: 0 }]);
    expect(claw.phase).toBe("swing");
    expect(claw.len).toBe(MIN_LEN);
  });

  it("brings nothing back when it misses everything, and an empty claw is quicker than a loaded one", () => {
    const away: Box = { x: 0, y: 40, w: 10, h: 10 };
    const { events } = run(launch(newClaw()), [away], 800);
    expect(events).toEqual([{ type: "arrived", index: null }]);
    expect(RETRACT_SPEED * EMPTY_RETRACT_BOOST).toBeGreaterThan(RETRACT_SPEED);
    const empty = stepClaw({ ...newClaw(), phase: "retract", len: 30 }, 100, []).claw.len;
    const loaded = stepClaw({ ...newClaw(), phase: "retract", len: 30, caught: 0 }, 100, [box]).claw.len;
    expect(30 - empty).toBeCloseTo(100 * RETRACT_SPEED * EMPTY_RETRACT_BOOST);
    expect(30 - loaded).toBeCloseTo(100 * RETRACT_SPEED);
  });

  it("ignores boxes that were already taken, and will not launch again while out", () => {
    expect(run(launch(newClaw()), [null], 800).events).toEqual([{ type: "arrived", index: null }]);
    const out = launch(newClaw());
    expect(launch(out)).toBe(out);
  });

  it("can let go of what it hauls: it comes back empty and fast", () => {
    const hauling = run(launch(newClaw()), [box], 25).claw;
    expect(hauling).toMatchObject({ phase: "retract", caught: 0 });
    const freed = dropCatch(hauling);
    expect(freed.caught).toBeNull();
    const { events } = run(freed, [box], 200);
    expect(events).toEqual([{ type: "arrived", index: null }]);
    expect(dropCatch(newClaw())).toEqual(newClaw());
  });
});

describe("a claw aimed at one nugget", () => {
  const boxes: Box[] = [
    { x: 40, y: 28, w: 20, h: 10 }, // straight below the winch
    { x: 70, y: 40, w: 20, h: 10 },
    { x: 5, y: 40, w: 20, h: 10 },
  ];

  it("turns to the nugget, goes straight to it and brings it back, whichever one is tapped", () => {
    for (const index of [0, 1, 2]) {
      const { events } = run(aimAt(newClaw(), index, boxes[index]!), boxes, 600);
      expect(events).toEqual([{ type: "caught", index }, { type: "arrived", index }]);
    }
  });

  it("is not stopped by a nugget in the way: it reaches the one it was sent to", () => {
    const front: Box = { x: 40, y: 20, w: 20, h: 8 };
    const behind: Box = { x: 40, y: 45, w: 20, h: 8 };
    expect(isBlocked([front, behind], 1)).toBe(true);
    // dropped, the claw meets the front one first
    expect(run(launch(newClaw()), [front, behind], 400).events[0]).toEqual({ type: "caught", index: 0 });
    // aimed, it goes through to the one behind
    expect(run(aimAt(newClaw(), 1, behind), [front, behind], 600).events).toEqual([{ type: "caught", index: 1 }, { type: "arrived", index: 1 }]);
  });

  it("turns at a steady rate and carries the swing on from the new angle afterwards", () => {
    const aimed = aimAt(newClaw(), 1, boxes[1]!);
    const target = aimed.aim!.angle;
    const part = stepClaw(aimed, 50, boxes).claw;
    expect(part.phase).toBe("aim");
    expect(part.angle).toBeCloseTo(AIM_SPEED * 50);
    // step until the claw is back with the nugget, then look at where the swing picks up
    let claw: Claw = aimed;
    for (let i = 0; i < 2000; i++) {
      const r = stepClaw(claw, 16, boxes);
      claw = r.claw;
      if (r.event?.type === "arrived") break;
    }
    expect(claw.phase).toBe("swing");
    expect(claw.aim).toBeUndefined();
    expect(swingAngle(claw.t)).toBeCloseTo(target, 3);
  });

  it("only starts from the swing", () => {
    const out = launch(newClaw());
    expect(aimAt(out, 0, boxes[0]!)).toBe(out);
  });

  it("works in the tall field too", () => {
    const tall: Box[] = [{ x: 10, y: 60, w: 30, h: 16 }, { x: 60, y: 80, w: 30, h: 16 }];
    for (const index of [0, 1]) {
      const { events } = run(aimAt(newClaw(), index, tall[index]!), tall, 900, 16, SCENES.tall);
      expect(events).toEqual([{ type: "caught", index }, { type: "arrived", index }]);
    }
  });
});

describe("layoutNuggets", () => {
  it("never leaves one nugget in the way of another, on either field, for two to four nuggets", () => {
    for (const scene of [SCENES.wide, SCENES.tall] as Scene[]) {
      for (let n = 2; n <= 4; n++) {
        for (let round = 0; round < 60; round++) {
          const boxes = layoutNuggets(n, Math.random, scene);
          expect(boxes).toHaveLength(n);
          boxes.forEach((_, i) => expect(isBlocked(boxes, i)).toBe(false));
        }
      }
    }
  });

  it("keeps nuggets apart, inside the field and below the winch", () => {
    for (const scene of [SCENES.wide, SCENES.tall] as Scene[]) {
      for (let round = 0; round < 80; round++) {
        const boxes = layoutNuggets(4, Math.random, scene);
        for (const b of boxes) {
          expect(b.x).toBeGreaterThan(0);
          expect(b.x + b.w).toBeLessThan(W);
          expect(b.y).toBeGreaterThan(PIVOT.y + MIN_LEN);
          expect(b.y + b.h).toBeLessThan(scene.H);
          expect(angleTo(centerOf(b))).toBeLessThan(75);
          expect(angleTo(centerOf(b))).toBeGreaterThan(-75);
        }
        boxes.forEach((a, i) =>
          boxes.slice(i + 1).forEach((b) => {
            expect(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y).toBe(true);
          }),
        );
      }
    }
  });

  it("knows what blocking is", () => {
    const a: Box = { x: 40, y: 20, w: 20, h: 8 };
    const b: Box = { x: 40, y: 45, w: 20, h: 8 };
    const c: Box = { x: 2, y: 26, w: 18, h: 8 };
    expect(isBlocked([a, b], 1)).toBe(true);
    expect(isBlocked([a, b], 0)).toBe(false);
    expect(isBlocked([a, c], 1)).toBe(false);
  });
});

describe("items and points", () => {
  it("has six kinds of item, each worth at least 10, the diamond the most and the rarest", () => {
    expect(SKINS.map((s) => s.id).sort()).toEqual(["chest", "diamond", "emerald", "gold", "ruby", "silver"]);
    expect(Math.min(...SKINS.map((s) => s.points))).toBe(10);
    const diamond = SKINS.find((s) => s.id === "diamond")!;
    expect(diamond.points).toBe(Math.max(...SKINS.map((s) => s.points)));
    expect(diamond.weight).toBe(Math.min(...SKINS.map((s) => s.weight)));
  });
  it("picks kinds by weight", () => {
    const seen = new Set<string>();
    const counts: Record<string, number> = {};
    let seed = 11;
    const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 4000; i++) {
      const id = pickSkin(rng);
      seen.add(id);
      counts[id] = (counts[id] ?? 0) + 1;
    }
    expect(seen.size).toBe(6);
    expect(counts.gold!).toBeGreaterThan(counts.diamond! * 3);
    expect(pickSkin(() => 0)).toBe("gold");
    expect(pickSkin(() => 0.999999)).toBe("diamond");
  });
  it("pays the item's worth plus a combo bonus and a speed bonus", () => {
    expect(payout("gold", 0, 9000)).toEqual({ points: 10, base: 10, combo: 0, speed: 0 });
    expect(payout("diamond", 0, 3000)).toEqual({ points: 40, base: 30, combo: 0, speed: 10 });
    expect(payout("ruby", 3, 5000)).toEqual({ points: 40, base: 20, combo: 15, speed: 5 });
    expect(payout("gold", 99, 99999).combo).toBe(25);
    expect(payout("gold", -2, 1000).combo).toBe(0);
  });
});

describe("levels", () => {
  it("asks for more points each level, and gives a little more time up to a limit", () => {
    expect([1, 2, 3, 5].map(levelTarget)).toEqual([100, 180, 260, 420]);
    expect(levelSeconds(1)).toBe(50);
    expect(levelSeconds(3)).toBe(56);
    expect(levelSeconds(50)).toBe(70);
  });
  it("pays 5 points for every full second left", () => {
    expect(timeBonus(12_900)).toBe(60);
    expect(timeBonus(0)).toBe(0);
    expect(timeBonus(-500)).toBe(0);
  });
  it("counts right answers toward the goal and clears the level when it is reached", () => {
    let s = startMiner();
    expect(s).toMatchObject({ level: 1, lives: 3, dynamite: 3 });
    s = minerRight(s, 40);
    s = minerRight(s, 40);
    expect(levelCleared(s)).toBe(false);
    s = minerRight(s, 30);
    expect(s).toMatchObject({ score: 110, levelScore: 110, streak: 3, bestStreak: 3, right: 3 });
    expect(levelCleared(s)).toBe(true);
  });
  it("loses a life and the streak on a wrong haul, and ends at no lives", () => {
    let s = minerRight(startMiner(), 10);
    s = minerWrong(s);
    expect(s).toMatchObject({ lives: 2, streak: 0, bestStreak: 1, wrong: 1 });
    s = minerWrong(minerWrong(s));
    expect(minerOver(s)).toBe(true);
  });
  it("uses dynamite while there is some", () => {
    let s = startMiner();
    for (let i = 0; i < 3; i++) s = igniteDynamite(s);
    expect(s.dynamite).toBe(0);
    expect(igniteDynamite(s)).toBe(s);
  });
  it("moves on with the time bonus, one more dynamite and a life back, to the caps", () => {
    let s = { ...startMiner(), score: 120, levelScore: 120, lives: 1, dynamite: 4, streak: 5, bestStreak: 5 };
    s = nextLevel(s, 20_000);
    expect(s).toMatchObject({ level: 2, score: 220, levelScore: 0, lives: 2, dynamite: 5, streak: 5 });
    s = nextLevel(s, 0);
    expect(s).toMatchObject({ level: 3, score: 220, lives: 3, dynamite: 6 });
    expect(nextLevel(s, 0).lives).toBe(3);
    expect(nextLevel({ ...s, dynamite: MAX_DYNAMITE }, 0).dynamite).toBe(MAX_DYNAMITE);
  });
  it("gives stars for how far the miner got", () => {
    expect([minerStars(startMiner(), 0), minerStars({ ...startMiner(), score: 5 }, 0), minerStars(startMiner(), 2), minerStars(startMiner(), 4)]).toEqual([0, 1, 2, 3]);
  });
  it("is reachable: extending at the rate the game uses gets to the far wall in a few seconds", () => {
    expect(maxLen(0, SCENES.tall) / EXTEND_SPEED).toBeLessThan(2500);
  });
});

describe("the shop between levels", () => {
  const rich = { ...startMiner(), coins: 1000 };

  it("opens after every second level", () => {
    expect([1, 2, 3, 4, 6].map(shopDue)).toEqual([false, true, false, true, true]);
    expect(shopDue(0)).toBe(false);
  });

  it("pays for what is earned and the time bonus, so the points are the money", () => {
    let s = minerRight(startMiner(), 25);
    expect(s).toMatchObject({ score: 25, coins: 25 });
    s = nextLevel({ ...s, coins: 40 }, 10_000);
    expect(s.coins).toBe(40 + 50);
    expect(s.score).toBe(25 + 50);
  });

  it("sells a stick of dynamite, a heart, double points and extra time, each for its price", () => {
    expect(buy(rich, "dynamite")).toMatchObject({ dynamite: rich.dynamite + 1, coins: 1000 - priceOf("dynamite") });
    expect(buy(rich, "heart")).toMatchObject({ lives: rich.lives + 1, coins: 1000 - priceOf("heart") });
    expect(buy(rich, "double")).toMatchObject({ double: true, coins: 1000 - priceOf("double") });
    expect(buy(rich, "time")).toMatchObject({ extraSeconds: EXTRA_SECONDS, coins: 1000 - priceOf("time") });
  });

  it("refuses what cannot be afforded or would add nothing, and charges nothing then", () => {
    const poor = { ...startMiner(), coins: priceOf("dynamite") - 1 };
    expect(shopBlock(poor, "dynamite")).toBe("coins");
    expect(buy(poor, "dynamite")).toBe(poor);
    expect(shopBlock({ ...rich, dynamite: MAX_DYNAMITE }, "dynamite")).toBe("full");
    expect(shopBlock({ ...rich, lives: MAX_LIVES }, "heart")).toBe("full");
    expect(shopBlock({ ...rich, double: true }, "double")).toBe("full");
    expect(shopBlock({ ...rich, extraSeconds: 15 }, "time")).toBe("full");
    expect(buy({ ...rich, lives: MAX_LIVES }, "heart").coins).toBe(1000);
  });

  it("lets hearts go above the usual three and keeps them when the next level comes", () => {
    const s = buy({ ...rich, lives: 3 }, "heart");
    expect(s.lives).toBe(4);
    expect(nextLevel(s, 0).lives).toBe(4);
  });

  it("doubles what is earned while the boost is on, and uses the boost up with the level", () => {
    const on = buy(rich, "double");
    expect(boosted(on, 30)).toBe(60);
    expect(boosted(startMiner(), 30)).toBe(30);
    expect(nextLevel(on, 0).double).toBe(false);
    expect(nextLevel(buy(rich, "time"), 0).extraSeconds).toBe(0);
  });
});

