import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fmt } from "../../shared/i18n/format";
import { Icon } from "../../shared/ui/Icon";
import { triggerConfetti } from "../../shared/utils/confetti";
import { Burst, Pops, SoundToggle, Stars, playFx, usePops, useShake } from "./GameBits";
import {
  MINER_LIVES,
  SHOP_ITEMS,
  PIVOT,
  SCENES,
  SKINS,
  TIME_PER_RIGHT_MS,
  W,
  aimAt,
  boosted,
  buy,
  dropCatch,
  igniteDynamite,
  launch,
  layoutNuggets,
  levelCleared,
  levelSeconds,
  levelTarget,
  minerOver,
  minerRight,
  minerStars,
  minerWrong,
  newClaw,
  nextLevel,
  payout,
  pickSkin,
  shopBlock,
  shopDue,
  skinPoints,
  startMiner,
  stepClaw,
  tipOf,
  timeBonus,
  type Box,
  type Claw,
  type MinerState,
  type Scene,
  type SkinId,
} from "./miner";
import { playGameSound } from "./gameSound";
import { SkinArt } from "./MinerSkins";
import { getBest, submitBest } from "./prefs";
import { buildDropRound, type DropItem } from "./quiz";
import { useFt } from "./flashText";
import { useBackTo } from "./StudyContext";
import { SideView } from "./SideView";
import type { Card, Direction } from "./types";

type Props = { deckId: string; cards: Card[]; direction: Direction };

type Nugget = { cardId: string; side: DropItem["options"][number]["side"]; box: Box; skin: SkinId };
type Stage = "idle" | "playing" | "cleared" | "shop" | "over";
type Mood = "idle" | "cheer" | "oops";
type Feedback = { correct: boolean };

const RESULT_MS = 900;
const CHEER_MS = 520;

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

/** The narrowest the field is made when it is shrunk to fit the screen's height. */
const MIN_FIELD_PX = 260;

/**
 * The widest the field may be for the whole of it to be on screen at once. The field keeps its proportions, so
 * on a screen that is wide but not tall (a laptop) it would be taller than the window and the bottom nuggets
 * would be cut off. What is above and below the field (clock, lives, the word, the launch button) is measured
 * and subtracted; the tallest that was seen is kept so the field does not change size from question to question.
 */
function useFitField(active: boolean, ratio: number, scrollKey: string) {
  const root = useRef<HTMLElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const [maxWidth, setMaxWidth] = useState<number | null>(null);
  const tallestOther = useRef(0);

  useLayoutEffect(() => {
    if (!active) return;
    tallestOther.current = 0;
    const fit = () => {
      const r = root.current;
      const f = field.current;
      if (!r || !f) return;
      const style = getComputedStyle(r);
      const chrome = (parseFloat(style.getPropertyValue("--header-h")) || 72) + 8;
      const other = r.offsetHeight - f.offsetHeight;
      tallestOther.current = Math.max(tallestOther.current, other);
      const room = window.innerHeight - chrome - tallestOther.current - 16;
      const width = Math.floor(room * ratio);
      const available = r.clientWidth;
      const next = width >= available ? null : Math.max(MIN_FIELD_PX, width);
      setMaxWidth((old) => (old === next || (old !== null && next !== null && Math.abs(old - next) < 2) ? old : next));
    };
    fit();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    if (root.current) observer?.observe(root.current);
    const onResize = () => {
      tallestOther.current = 0;
      fit();
    };
    window.addEventListener("resize", onResize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [active, ratio]);

  // a new game puts the whole field in view, with the clock and the word above it
  useEffect(() => {
    if (active) root.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  }, [active, scrollKey]);

  return { root, field, maxWidth };
}

/** A phone held upright gets the tall field with bigger nuggets; anything wider gets the wide one. */
function useNarrow(): boolean {
  const query = "(max-width: 640px)";
  const [narrow, setNarrow] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

function nuggetsFor(item: DropItem, scene: Scene): Nugget[] {
  const boxes = layoutNuggets(item.options.length, Math.random, scene);
  return item.options.map((o, i) => ({ cardId: o.cardId, side: o.side, box: boxes[i]!, skin: pickSkin() }));
}

/** The picture on a shop item. */
function ShopArt({ id }: { id: (typeof SHOP_ITEMS)[number]["id"] }) {
  if (id === "dynamite") return <Dynamite />;
  if (id === "heart") return <Icon name="heart" size={28} />;
  if (id === "time") return <Icon name="clock" size={28} />;
  return <b>×2</b>;
}

function Dynamite() {
  return (
    <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" focusable="false">
      <path d="M22 5c1 3 3 3 5 3" fill="none" stroke="#a16207" strokeWidth="2" strokeLinecap="round" />
      <circle cx="27.5" cy="8" r="2" fill="#fbbf24" />
      <rect x="6" y="9" width="8" height="18" rx="1.5" transform="rotate(-18 10 18)" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.4" />
      <rect x="12" y="8" width="8" height="19" rx="1.5" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1.4" />
      <rect x="18" y="9" width="8" height="18" rx="1.5" transform="rotate(14 22 18)" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.4" />
      <path d="M5 17l7-2M12 20l8-1" stroke="#fde68a" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

/**
 * Gold miner, a level at a time. Haul up the nugget with the right meaning (tap it and the claw flies straight
 * there, or drop the claw yourself). Reach the target before the clock runs out; richer finds, combos and quick
 * hauls earn more, and dynamite gets rid of a wrong haul.
 */
export function MinerMode({ deckId, cards, direction }: Props) {
  const ft = useFt();
  const backTo = useBackTo(deckId);
  const narrow = useNarrow();
  const [stage, setStage] = useState<Stage>("idle");
  const [miner, setMiner] = useState<MinerState>(startMiner);
  const [item, setItem] = useState<DropItem | null>(null);
  const [nuggets, setNuggets] = useState<Nugget[]>([]);
  const [carried, setCarried] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [mood, setMood] = useState<Mood>("idle");
  const [left, setLeft] = useState(0);
  const [clearInfo, setClearInfo] = useState<{ bonus: number } | null>(null);
  const [endedBy, setEndedBy] = useState<"time" | "lives">("lives");
  const [highScore, setHighScore] = useState<{ best: number | null; improved: boolean } | null>(null);
  const [boom, setBoom] = useState<{ key: number; x: number; y: number } | null>(null);
  // the field is chosen when a game starts, so turning the phone mid-game does not move the nuggets
  const [scene, setScene] = useState<Scene>(narrow ? SCENES.tall : SCENES.wide);

  const clawRef = useRef<Claw>(newClaw());
  const ropeRef = useRef<HTMLDivElement>(null);
  const carryRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene>(scene);
  const nuggetsRef = useRef<Nugget[]>([]);
  const minerRef = useRef<MinerState>(miner);
  const itemRef = useRef<DropItem | null>(null);
  const queueRef = useRef<DropItem[]>([]);
  const pausedRef = useRef(false);
  const deadline = useRef(0);
  const askedAt = useRef(0);
  const clearedAt = useRef(0);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const boomKey = useRef(0);
  const { pops, pop } = usePops();
  const { shaking, shake } = useShake();

  nuggetsRef.current = nuggets;
  minerRef.current = miner;
  itemRef.current = item;
  sceneRef.current = scene;
  const playing = stage === "playing";
  const { root, field, maxWidth } = useFitField(playing || stage === "cleared", W / scene.H, `${scene.H}`);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  /** Puts the rope and what hangs from it where the claw is. */
  const paint = useCallback(() => {
    const c = clawRef.current;
    const rope = ropeRef.current;
    if (rope) {
      rope.style.height = pct(c.len, sceneRef.current.H);
      rope.style.transform = `rotate(${-c.angle}deg)`;
    }
    const carry = carryRef.current;
    if (carry) carry.style.transform = `translate(-50%, 0) rotate(${c.angle}deg)`;
  }, []);

  function cheer(next: Mood) {
    setMood(next);
    later(() => setMood("idle"), next === "cheer" ? CHEER_MS : 700);
  }

  function ask() {
    if (queueRef.current.length === 0) queueRef.current = buildDropRound(cards, cards.length, direction);
    const next = queueRef.current.shift()!;
    setItem(next);
    setNuggets(nuggetsFor(next, sceneRef.current));
    setCarried(null);
    setFeedback(null);
    askedAt.current = Date.now();
    clawRef.current = newClaw();
    pausedRef.current = false;
    paint();
  }

  function beginLevel(state: MinerState) {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    // the time bought in the shop is for this level only
    const seconds = levelSeconds(state.level) + state.extraSeconds;
    setMiner({ ...state, extraSeconds: 0 });
    setClearInfo(null);
    setMood("idle");
    deadline.current = Date.now() + seconds * 1000;
    setLeft(seconds * 1000);
    setStage("playing");
    ask();
  }

  function newGame() {
    const field = narrow ? SCENES.tall : SCENES.wide;
    sceneRef.current = field;
    setScene(field);
    setHighScore(null);
    queueRef.current = [];
    beginLevel(startMiner());
  }

  function finish(by: "time" | "lives", state: MinerState) {
    setEndedBy(by);
    setStage("over");
    setHighScore({ best: getBest(deckId, "miner"), improved: submitBest(deckId, "miner", state.score, "high") });
    if (state.right > 0) {
      playFx("win");
      triggerConfetti({ particleCount: 70 });
    }
  }

  /** The claw is back, with nugget `index` or with nothing. */
  function arrived(index: number | null) {
    if (index === null) return;
    const picked = nuggetsRef.current[index];
    const current = itemRef.current;
    if (!picked || !current) return;
    const state = minerRef.current;
    const correct = picked.cardId === current.cardId;
    pausedRef.current = true;
    setFeedback({ correct });
    playFx(correct ? "correct" : "wrong");

    if (correct) {
      const pay = payout(picked.skin, state.streak, Date.now() - askedAt.current);
      const earned = boosted(state, pay.points);
      const next = minerRight(state, earned);
      setMiner(next);
      pop(`+${earned}`, "good", 50);
      if (state.double) pop(ft("miner.pop.double"), "info", 64);
      if (pay.combo > 0) pop(fmt(ft("miner.pop.combo"), { n: pay.combo }), "info", 24);
      if (pay.speed > 0) pop(fmt(ft("miner.pop.fast"), { n: pay.speed }), "info", 76);
      deadline.current += TIME_PER_RIGHT_MS;
      cheer("cheer");
      later(() => {
        if (levelCleared(next)) {
          clearedAt.current = Date.now();
          setClearInfo({ bonus: timeBonus(deadline.current - clearedAt.current) });
          setStage("cleared");
          playGameSound("levelClear");
          triggerConfetti({ particleCount: 90 });
        } else ask();
      }, 650);
    } else {
      const next = minerWrong(state);
      setMiner(next);
      shake();
      cheer("oops");
      later(() => {
        if (minerOver(next)) finish("lives", next);
        else ask();
      }, RESULT_MS);
    }
  }

  // the claw's animation loop
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      if (!pausedRef.current) {
        const { claw, event } = stepClaw(clawRef.current, dt, nuggetsRef.current.map((n) => n.box), sceneRef.current);
        clawRef.current = claw;
        paint();
        if (event?.type === "caught") {
          playGameSound("grab");
          setCarried(event.index);
        } else if (event?.type === "arrived") arrived(event.index);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // arrived reads refs only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, paint]);

  // the clock
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const remaining = deadline.current - Date.now();
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(id);
        finish("time", minerRef.current);
      }
    }, 200);
    return () => clearInterval(id);
    // finish takes the state it needs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  /** After a cleared level: straight on, or through the shop first when it is due. */
  function leaveLevel() {
    const next = nextLevel(miner, deadline.current - clearedAt.current);
    if (shopDue(miner.level)) {
      setMiner(next);
      setStage("shop");
    } else beginLevel(next);
  }

  const idle = () => clawRef.current.phase === "swing" && !pausedRef.current;

  function drop() {
    if (playing && idle()) {
      clawRef.current = launch(clawRef.current);
      playGameSound("launch");
    }
  }

  /** Tapping a nugget sends the claw straight to it. */
  function aim(index: number) {
    const target = nuggetsRef.current[index];
    if (playing && target && idle()) {
      clawRef.current = aimAt(clawRef.current, index, target.box);
      playGameSound("launch");
    }
  }

  const canBoom = playing && carried !== null && clawRef.current.phase === "retract" && !feedback && miner.dynamite > 0;

  /** Blows up what the claw is hauling: no answer is given, so no life is lost, and the claw comes back empty. */
  function blast() {
    const c = clawRef.current;
    if (!playing || feedback || carried === null || c.phase !== "retract" || minerRef.current.dynamite <= 0) return;
    const tip = tipOf(c.angle, c.len);
    setMiner(igniteDynamite(minerRef.current));
    clawRef.current = dropCatch(c);
    setCarried(null);
    setBoom({ key: ++boomKey.current, x: tip.x, y: tip.y });
    playGameSound("boom");
    shake();
    pop(ft("miner.pop.boom"), "bad", pctX(tip.x));
    later(() => setBoom(null), 700);
  }
  const pctX = (x: number) => Math.max(10, Math.min(90, x));

  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(el.tagName)) return;
      if (e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        drop();
      } else if (e.key === "d" || e.key === "D") blast();
      else if (item && Number(e.key) >= 1 && Number(e.key) <= nuggets.length) aim(Number(e.key) - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // drop, blast and aim read refs and the latest state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, item, nuggets.length, carried, feedback, miner.dynamite]);

  // ---------- screens ----------

  if (stage === "idle") {
    const best = getBest(deckId, "miner");
    return (
      <section className="fc-panel fc-start fc-miner-start">
        <h2>{ft("miner.title")}</h2>
        <p>{ft("miner.intro")}</p>
        <ul className="fc-miner-rules">
          {(["miner.rule1", "miner.rule2", "miner.rule3", "miner.rule4", "miner.rule5"] as const).map((k) => (
            <li key={k}>{ft(k)}</li>
          ))}
        </ul>
        <ul className="fc-skinlegend" aria-label={ft("miner.legend")}>
          {SKINS.map((s) => (
            <li key={s.id} title={ft(`miner.skin.${s.id}`)}>
              <span className={`fc-skinlegend__art fc-skin--${s.id}`}><SkinArt skin={s.id} /></span>
              <span>{ft(`miner.skin.${s.id}`)}</span>
              <strong>+{s.points}</strong>
            </li>
          ))}
        </ul>
        {best !== null && <p className="fc-note">{fmt(ft("drop.best"), { score: best })}</p>}
        <button type="button" className="btn btn--primary btn--lg" onClick={newGame}>{ft("common.start")}</button>
      </section>
    );
  }

  if (stage === "over") {
    const clearedLevels = miner.level - 1;
    return (
      <section className="fc-panel fc-result" aria-live="polite">
        <Stars count={minerStars(miner, clearedLevels)} />
        <h2>{endedBy === "time" ? ft("blitz.done") : ft("drop.lost")}</h2>
        <p className="fc-result__big tabular">{miner.score}</p>
        <p className="fc-result__score">
          {fmt(ft("miner.summary"), { level: miner.level, right: miner.right, wrong: miner.wrong, streak: miner.bestStreak })}
        </p>
        {highScore?.improved && <p className="fc-badge">{ft("drop.newBest")}</p>}
        {highScore && !highScore.improved && highScore.best !== null && <p className="fc-note">{fmt(ft("drop.best"), { score: highScore.best })}</p>}
        <div className="fc-actions">
          <button type="button" className="btn btn--primary" onClick={newGame}>{ft("common.playAgain")}</button>
          <Link className="btn btn--ghost" to={backTo}>{ft("common.backToDeck")}</Link>
        </div>
      </section>
    );
  }

  if (stage === "shop") {
    return (
      <section className="fc-panel fc-miner-shop" aria-label={ft("miner.shop.title")}>
        <h2>{ft("miner.shop.title")}</h2>
        <p className="fc-miner-shop__coins" aria-live="polite">
          {ft("miner.shop.coins")} <strong className="tabular">{miner.coins}</strong>
        </p>
        <p className="fc-note">{fmt(ft("miner.shop.sub"), { n: miner.level })}</p>
        <ul className="fc-miner-shop__list">
          {SHOP_ITEMS.map((it) => {
            const block = shopBlock(miner, it.id);
            return (
              <li key={it.id} className="fc-shopitem">
                <span className={`fc-shopitem__art fc-shopitem__art--${it.id}`} aria-hidden="true"><ShopArt id={it.id} /></span>
                <span className="fc-shopitem__text">
                  <strong>{ft(`miner.shop.${it.id}`)}</strong>
                  <small>{ft(`miner.shop.${it.id}.desc`)}</small>
                </span>
                <button
                  type="button"
                  className="btn btn--outline fc-shopitem__buy"
                  disabled={block !== null}
                  onClick={() => {
                    setMiner((m) => buy(m, it.id));
                    playGameSound("grab");
                  }}
                  aria-label={fmt(ft("miner.shop.buyLabel"), { item: ft(`miner.shop.${it.id}`), price: it.price })}
                >
                  {block === "full" ? ft("miner.shop.have") : <><Icon name="gem" size={16} /> {it.price}</>}
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className="btn btn--primary btn--lg" onClick={() => beginLevel(miner)} autoFocus>
          {fmt(ft("miner.shop.play"), { n: miner.level })}
        </button>
      </section>
    );
  }

  const target = levelTarget(miner.level);
  const seconds = Math.ceil(left / 1000);
  const hold = carried !== null ? nuggets[carried] : null;
  const manH = scene.H > 80 ? 14 : 11;
  const manW = manH * 0.66;
  const potential = (n: Nugget) => skinPoints(n.skin);

  return (
    <section ref={root} className="fc-miner" aria-label={ft("miner.title")}>
      <div className="fc-mhud">
        <div className="fc-mhud__sign">
          <span className="fc-mhud__signlabel">{ft("miner.target")}</span>
          <strong className="tabular">
            {Math.min(miner.levelScore, target)}<small>/{target}</small>
          </strong>
          <span className="fc-mhud__meter" aria-hidden="true">
            <i style={{ width: `${Math.min(100, (miner.levelScore / target) * 100)}%` }} />
          </span>
        </div>
        <span className="fc-mhud__level">{fmt(ft("miner.level"), { n: miner.level })}</span>
        <span className={`fc-mhud__time tabular${seconds <= 10 ? " is-low" : ""}`} aria-label={fmt(ft("miner.time"), { s: seconds })}>
          <Icon name="clock" size={20} /> {seconds}
        </span>
        <button
          type="button"
          className={`fc-mhud__tnt${canBoom ? " is-ready" : ""}`}
          onClick={blast}
          disabled={!canBoom}
          aria-label={fmt(ft("miner.dynamite"), { n: miner.dynamite })}
          title={fmt(ft("miner.dynamiteHint"), { n: miner.dynamite })}
        >
          <Dynamite /> <b>×{miner.dynamite}</b>
        </button>
      </div>
      <div className="fc-mhud fc-mhud--sub">
        <span className="fc-drop__lives" aria-label={fmt(ft("drop.lives"), { n: miner.lives })}>
          {Array.from({ length: Math.max(MINER_LIVES, miner.lives) }, (_, i) => (
            <Icon key={i} name="heart" size={20} className={i < miner.lives ? "is-full" : "is-empty"} />
          ))}
        </span>
        <span className="fc-drop__score tabular">{fmt(ft("drop.score"), { score: miner.score })}</span>
        {miner.double && <span className="fc-mhud__boost" title={ft("miner.shop.double")}>×2</span>}
        <span className="fc-mhud__coins tabular" aria-label={fmt(ft("miner.shop.coinsLabel"), { n: miner.coins })}>
          <Icon name="gem" size={15} /> {miner.coins}
        </span>
        <SoundToggle />
      </div>

      <div className={`fc-shoot__prompt${feedback ? (feedback.correct ? " is-hit" : " is-miss") : ""}`} key={`p-${miner.right}-${miner.wrong}`}>
        <SideView side={item!.prompt} big />
        <span className="fc-note">{ft("miner.hint")}</span>
      </div>

      <div
        ref={field}
        className={`fc-miner__scene${scene === SCENES.tall ? " is-tall" : ""}${shaking ? " is-shaking" : ""}`}
        style={{
          aspectRatio: `${W} / ${scene.H}`,
          maxWidth: maxWidth ?? undefined,
          marginInline: maxWidth ? "auto" : undefined,
          ["--nw" as string]: `${scene.nugget.w}cqw`,
          ["--nh" as string]: `${scene.nugget.h}cqw`,
          ["--ground" as string]: pct(8, scene.H),
          ["--grass" as string]: pct(3, scene.H),
        }}
        role="application"
        aria-label={ft("miner.scene")}
        onClick={drop}
      >
        <span className="fc-miner__soil" aria-hidden="true" />
        <div
          className={`fc-miner__man is-${mood}`}
          style={{ left: pct(PIVOT.x - 22 - manW / 2, W), top: pct(11 - manH, scene.H), height: pct(manH, scene.H) }}
          aria-hidden="true"
        >
          <img src="/miner/old-miner.webp" alt="" draggable={false} />
        </div>
        <div ref={ropeRef} className="fc-miner__rope" style={{ left: pct(PIVOT.x, W), top: pct(PIVOT.y, scene.H), height: pct(clawRef.current.len, scene.H) }} aria-hidden="true">
          <span className="fc-miner__claw" />
          {hold && (
            <div ref={carryRef} className={`fc-miner__nugget fc-miner__carry fc-skin--${hold.skin}${feedback ? (feedback.correct ? " is-right" : " is-wrong") : ""}`}>
              <SkinArt skin={hold.skin} />
              <span className="fc-miner__label"><SideView side={hold.side} speak={false} /></span>
              {feedback?.correct && <Burst />}
            </div>
          )}
        </div>
        <span className="fc-miner__winch" style={{ left: pct(PIVOT.x - 6, W), top: pct(PIVOT.y - 4.8, scene.H), width: pct(12, W), height: pct(6.4, scene.H) }} aria-hidden="true">
          <i className="fc-miner__drum" />
        </span>
        {nuggets.map((n, i) => (
          <button
            key={`${miner.right + miner.wrong}-${miner.level}-${n.cardId}`}
            type="button"
            className={`fc-miner__nugget fc-skin--${n.skin}${carried === i ? " is-taken" : ""}`}
            style={{ left: pct(n.box.x, W), top: pct(n.box.y, scene.H), width: pct(n.box.w, W), height: pct(n.box.h, scene.H) }}
            aria-label={fmt(ft("miner.nugget"), { text: n.side.text, n: potential(n) })}
            onClick={(e) => {
              e.stopPropagation();
              aim(i);
            }}
          >
            <SkinArt skin={n.skin} />
            <span className="fc-miner__label"><SideView side={n.side} speak={false} /></span>
            <span className="fc-miner__value" aria-hidden="true">+{potential(n)}</span>
          </button>
        ))}
        {boom && (
          <span key={boom.key} className="fc-miner__boom" style={{ left: pct(boom.x, W), top: pct(boom.y, scene.H) }} aria-hidden="true">
            <Burst tone="bad" />
          </span>
        )}
        <Pops pops={pops} />
        {miner.streak >= 2 && <span key={`combo-${miner.streak}`} className="fc-combo">{fmt(ft("game.combo"), { n: miner.streak })}</span>}

        {stage === "cleared" && clearInfo && (
          <div className="fc-miner__overlay" role="dialog" aria-label={fmt(ft("miner.cleared"), { n: miner.level })} onClick={(e) => e.stopPropagation()}>
            <div className="fc-miner__levelcard">
              <Stars count={3} />
              <h3>{fmt(ft("miner.cleared"), { n: miner.level })}</h3>
              <p>{fmt(ft("miner.clearScore"), { score: miner.levelScore })}</p>
              <p className="fc-miner__bonus">{fmt(ft("miner.clearBonus"), { n: clearInfo.bonus })}</p>
              <p className="fc-note">{ft("miner.clearPerks")}</p>
              <button type="button" className="btn btn--primary btn--lg" onClick={leaveLevel} autoFocus>
                {shopDue(miner.level) ? ft("miner.toShop") : fmt(ft("miner.next"), { n: miner.level + 1 })}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="fc-actions fc-actions--end">
        <button type="button" className="btn btn--primary btn--lg fc-miner__drop" onClick={drop}>{ft("miner.launch")}</button>
      </div>
    </section>
  );
}
