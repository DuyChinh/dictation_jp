import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fmt } from "../../shared/i18n/format";
import { Icon } from "../../shared/ui/Icon";
import { triggerConfetti } from "../../shared/utils/confetti";
import { Burst, Pops, SoundToggle, Stars, playFx, usePops, useShake } from "./GameBits";
import { PIVOT, SCENES, W, layoutNuggets, launch, newClaw, stepClaw, type Box, type Claw, type Scene } from "./miner";
import { getBest, submitBest } from "./prefs";
import { DROP_LIVES, buildDropRound, comboMultiplier, dropNext, starsForRatio, startDrop, type DropItem, type DropState } from "./quiz";
import { useFt } from "./flashText";
import { SideView } from "./SideView";
import type { Card, Direction } from "./types";

type Props = { deckId: string; cards: Card[]; direction: Direction };

const ROUND = 12;
const SECONDS = 90;
const RESULT_MS = 900;

type Nugget = { cardId: string; side: DropItem["options"][number]["side"]; box: Box };
type Feedback = { correct: boolean };

function nuggetsFor(item: DropItem, scene: Scene): Nugget[] {
  const boxes = layoutNuggets(item.options.length, Math.random, scene);
  return item.options.map((o, i) => ({ cardId: o.cardId, side: o.side, box: boxes[i]! }));
}

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

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

/** Gold miner: the claw swings, you drop it, and it hauls up the nugget it touches. Haul up the right answer. */
export function MinerMode({ deckId, cards, direction }: Props) {
  const ft = useFt();
  const [items, setItems] = useState<DropItem[] | null>(null);
  const [game, setGame] = useState<DropState | null>(null);
  const [nuggets, setNuggets] = useState<Nugget[]>([]);
  const [carried, setCarried] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [left, setLeft] = useState(SECONDS * 1000);
  const [timeUp, setTimeUp] = useState(false);
  const [highScore, setHighScore] = useState<{ best: number | null; improved: boolean } | null>(null);

  const clawRef = useRef<Claw>(newClaw());
  const ropeRef = useRef<HTMLDivElement>(null);
  const carryRef = useRef<HTMLDivElement>(null);
  const nuggetsRef = useRef<Nugget[]>([]);
  const gameRef = useRef<DropState | null>(null);
  const itemsRef = useRef<DropItem[] | null>(null);
  const pausedRef = useRef(false);
  const deadline = useRef(0);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const { pops, pop } = usePops();
  const { shaking, shake } = useShake();
  const narrow = useNarrow();
  // the field is chosen when a round starts, so turning the phone mid-round does not move the nuggets
  const [scene, setScene] = useState<Scene>(narrow ? SCENES.tall : SCENES.wide);
  const sceneRef = useRef<Scene>(scene);
  sceneRef.current = scene;

  nuggetsRef.current = nuggets;
  gameRef.current = game;
  itemsRef.current = items;
  const playing = game !== null && game.status === "playing" && !timeUp;
  const item = items && game && game.status === "playing" ? items[game.index] : null;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

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

  function begin() {
    timers.current.forEach(clearTimeout);
    const round = buildDropRound(cards, ROUND, direction);
    setItems(round);
    setGame(startDrop(round.length));
    const field = narrow ? SCENES.tall : SCENES.wide;
    sceneRef.current = field;
    setScene(field);
    setNuggets(nuggetsFor(round[0]!, field));
    setCarried(null);
    setFeedback(null);
    setHighScore(null);
    setTimeUp(false);
    setLeft(SECONDS * 1000);
    deadline.current = Date.now() + SECONDS * 1000;
    clawRef.current = newClaw();
    pausedRef.current = false;
  }

  function finish(state: DropState) {
    setHighScore({ best: getBest(deckId, "miner"), improved: submitBest(deckId, "miner", state.score, "high") });
    if (state.status === "won") {
      playFx("win");
      triggerConfetti({ particleCount: 80 });
    }
  }

  /** The claw is back with `index` (or with nothing). */
  function arrived(index: number | null) {
    const g = gameRef.current;
    const its = itemsRef.current;
    if (!g || !its || g.status !== "playing") return;
    if (index === null) {
      playFx("flip");
      return;
    }
    const picked = nuggetsRef.current[index]!;
    const current = its[g.index]!;
    const correct = picked.cardId === current.cardId;
    pausedRef.current = true;
    setFeedback({ correct });
    playFx(correct ? "correct" : "wrong");
    if (correct) {
      pop(`+${10 + Math.min(g.streak, 5) * 2}`, "good", 50);
      if (g.streak + 1 >= 3) pop(fmt(ft("game.combo"), { n: comboMultiplier(g.streak + 1) }), "info", 72);
    } else shake();
    timers.current.push(
      setTimeout(() => {
        const next = dropNext(g, correct);
        setGame(next);
        setFeedback(null);
        setCarried(null);
        clawRef.current = newClaw();
        pausedRef.current = false;
        if (next.status === "playing") setNuggets(nuggetsFor(its[next.index]!, sceneRef.current));
        else finish(next);
      }, correct ? 500 : RESULT_MS),
    );
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
          playFx("flip");
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
        setTimeUp(true);
        const g = gameRef.current;
        if (g) finish(g);
      }
    }, 200);
    return () => clearInterval(id);
    // finish reads the current game through its argument
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  function drop() {
    if (!playing || pausedRef.current) return;
    clawRef.current = launch(clawRef.current);
  }

  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(el.tagName)) return;
      if (e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        drop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing]);

  if (!items || !game) {
    const best = getBest(deckId, "miner");
    return (
      <section className="fc-panel fc-start">
        <h2>{ft("miner.title")}</h2>
        <p>{ft("miner.intro")}</p>
        {best !== null && <p className="fc-note">{fmt(ft("drop.best"), { score: best })}</p>}
        <button type="button" className="btn btn--primary btn--lg" onClick={begin}>{ft("common.start")}</button>
      </section>
    );
  }

  if (game.status !== "playing" || timeUp) {
    const won = game.status === "won";
    return (
      <section className="fc-panel fc-result" aria-live="polite">
        <Stars count={won ? Math.max(1, starsForRatio(game.right, game.total)) : game.right >= game.index / 2 && game.right > 0 ? 1 : 0} />
        <h2>{won ? ft("drop.won") : timeUp ? ft("blitz.done") : ft("drop.lost")}</h2>
        <p className="fc-result__big tabular">{game.score}</p>
        <p className="fc-result__score">{fmt(ft("drop.summary"), { right: game.right, total: game.total, streak: game.bestStreak })}</p>
        {highScore?.improved && <p className="fc-badge">{ft("drop.newBest")}</p>}
        {highScore && !highScore.improved && highScore.best !== null && <p className="fc-note">{fmt(ft("drop.best"), { score: highScore.best })}</p>}
        <div className="fc-actions">
          <button type="button" className="btn btn--primary" onClick={begin}>{ft("common.playAgain")}</button>
          <Link className="btn btn--ghost" to={`/flashcards/${deckId}`}>{ft("common.backToDeck")}</Link>
        </div>
      </section>
    );
  }

  const seconds = Math.ceil(left / 1000);
  const hold = carried !== null ? nuggets[carried] : null;
  return (
    <section className="fc-miner" aria-label={ft("miner.title")}>
      <div className="fc-drop__bar">
        <span className="fc-drop__lives" aria-label={fmt(ft("drop.lives"), { n: game.lives })}>
          {Array.from({ length: DROP_LIVES }, (_, i) => (
            <Icon key={i} name="heart" size={20} className={i < game.lives ? "is-full" : "is-empty"} />
          ))}
        </span>
        <span className="fc-drop__score tabular">{fmt(ft("drop.score"), { score: game.score })}</span>
        <span className={`fc-blitz__time tabular fc-miner__time${seconds <= 10 ? " is-low" : ""}`} aria-label={fmt(ft("miner.time"), { s: seconds })}>
          <Icon name="clock" size={18} /> {seconds}
        </span>
        <SoundToggle />
      </div>

      <div className={`fc-shoot__prompt${feedback ? (feedback.correct ? " is-hit" : " is-miss") : ""}`} key={`p-${game.index}`}>
        <SideView side={item!.prompt} big />
        <span className="fc-note tabular">{game.index + 1} / {game.total}</span>
      </div>

      <div
        className={`fc-miner__scene${scene === SCENES.tall ? " is-tall" : ""}${shaking ? " is-shaking" : ""}`}
        style={{ aspectRatio: `${W} / ${scene.H}`, ["--nw" as string]: `${scene.nugget.w}cqw`, ["--nh" as string]: `${scene.nugget.h}cqw` }}
        role="application"
        aria-label={ft("miner.scene")}
        onClick={drop}
      >
        <span className="fc-miner__ground" aria-hidden="true" />
        <span className="fc-miner__cart" aria-hidden="true" style={{ left: pct(PIVOT.x, W), top: pct(PIVOT.y, scene.H) }} />
        <div ref={ropeRef} className="fc-miner__rope" style={{ left: pct(PIVOT.x, W), top: pct(PIVOT.y, scene.H), height: pct(clawRef.current.len, scene.H) }} aria-hidden="true">
          <span className="fc-miner__claw" />
          {hold && (
            <div ref={carryRef} className={`fc-miner__nugget fc-miner__carry${feedback ? (feedback.correct ? " is-right" : " is-wrong") : ""}`}>
              <SideView side={hold.side} speak={false} />
              {feedback?.correct && <Burst />}
            </div>
          )}
        </div>
        {nuggets.map((n, i) => (
          <div
            key={`${game.index}-${n.cardId}`}
            className={`fc-miner__nugget${carried === i ? " is-taken" : ""}`}
            style={{ left: pct(n.box.x, W), top: pct(n.box.y, scene.H), width: pct(n.box.w, W), height: pct(n.box.h, scene.H) }}
            aria-label={fmt(ft("miner.nugget"), { text: n.side.text })}
          >
            <SideView side={n.side} speak={false} />
          </div>
        ))}
        <Pops pops={pops} />
        {game.streak >= 3 && <span key={`combo-${game.streak}`} className="fc-combo">{fmt(ft("game.combo"), { n: comboMultiplier(game.streak) })}</span>}
        <span className="fc-miner__hint">{ft("miner.hint")}</span>
      </div>
      <div className="fc-actions fc-actions--end">
        <button type="button" className="btn btn--primary btn--lg fc-miner__drop" onClick={drop}>{ft("miner.launch")}</button>
      </div>
    </section>
  );
}
