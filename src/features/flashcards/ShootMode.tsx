import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { fmt } from "../../shared/i18n/format";
import { Icon } from "../../shared/ui/Icon";
import { triggerConfetti } from "../../shared/utils/confetti";
import { Burst, Pops, SoundToggle, Stars, playFx, usePops, useShake } from "./GameBits";
import { getBest, submitBest } from "./prefs";
import { DROP_LIVES, buildDropRound, comboMultiplier, dropNext, starsForRatio, startDrop, type DropItem, type DropState } from "./quiz";
import { useFt } from "./flashText";
import { useBackTo } from "./StudyContext";
import { SideView } from "./SideView";
import type { Card, Direction } from "./types";

type Props = { deckId: string; cards: Card[]; direction: Direction };

const ROUND = 15;
const LANES = [14, 36, 58, 80];

/** How each bubble moves: the lane it floats in, which way, and how many seconds it takes to cross. */
type Drift = { lane: number; rtl: boolean; seconds: number; delay: number };

/** Seconds the right bubble takes to cross: quicker as the round goes on, never faster than 4. */
const crossSeconds = (right: number) => Math.max(4, 10 - 0.4 * right);

function driftsFor(count: number, right: number): Drift[] {
  const lanes = [...LANES].sort(() => Math.random() - 0.5).slice(0, count);
  const start = Math.random() < 0.5;
  return lanes.map((lane, i) => ({
    lane,
    rtl: i % 2 === 0 ? start : !start,
    seconds: crossSeconds(right) * (0.85 + Math.random() * 0.4),
    delay: i * 0.25,
  }));
}

type Hole = { id: number; x: number; y: number };
type Feedback = { chosen: string | null; correct: boolean };

/** Shooting range: four bubbles float across; shoot the one with the right meaning before it escapes. */
export function ShootMode({ deckId, cards, direction }: Props) {
  const ft = useFt();
  const backTo = useBackTo(deckId);
  const [items, setItems] = useState<DropItem[] | null>(null);
  const [game, setGame] = useState<DropState | null>(null);
  const [drifts, setDrifts] = useState<Drift[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [flash, setFlash] = useState(0);
  const [highScore, setHighScore] = useState<{ best: number | null; improved: boolean } | null>(null);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const seq = useRef(0);
  const { pops, pop } = usePops();
  const { shaking, shake } = useShake();

  const item = items && game && game.status === "playing" ? items[game.index] : null;
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  function play() {
    const round = buildDropRound(cards, ROUND, direction);
    setItems(round);
    setGame(startDrop(round.length));
    setDrifts(driftsFor(round[0]!.options.length, 0));
    setFeedback(null);
    setHighScore(null);
    setHoles([]);
  }

  /** `chosen` is the bubble shot, or null when the right one floated away. */
  function settle(chosen: string | null, at?: { x: number; y: number }) {
    if (!item || !game || feedback) return;
    const correct = chosen === item.cardId;
    setFeedback({ chosen, correct });
    setFlash((n) => n + 1);
    playFx(correct ? "correct" : "wrong");
    if (at) {
      const id = ++seq.current;
      setHoles((h) => [...h.slice(-5), { id, ...at }]);
      later(() => setHoles((h) => h.filter((x) => x.id !== id)), 1400);
    }
    if (correct) {
      pop(`+${10 + Math.min(game.streak, 5) * 2}`, "good", at ? at.x : 50);
      if (game.streak + 1 >= 3) pop(fmt(ft("game.combo"), { n: comboMultiplier(game.streak + 1) }), "info", 70);
    } else shake();
    later(() => {
      const next = dropNext(game, correct);
      setGame(next);
      setFeedback(null);
      if (next.status !== "playing") {
        setHighScore({ best: getBest(deckId, "shoot"), improved: submitBest(deckId, "shoot", next.score, "high") });
        if (next.status === "won") {
          playFx("win");
          triggerConfetti({ particleCount: 80 });
        }
      } else setDrifts(driftsFor(items![next.index]!.options.length, next.right));
    }, correct ? 450 : 1000);
  }

  function shoot(cardId: string, e: MouseEvent<HTMLElement>) {
    e.stopPropagation();
    const sky = (e.currentTarget.closest(".fc-shoot__range") as HTMLElement | null)?.getBoundingClientRect();
    const x = sky && sky.width ? ((e.clientX - sky.left) / sky.width) * 100 : 50;
    const y = sky && sky.height ? ((e.clientY - sky.top) / sky.height) * 100 : 50;
    settle(cardId, { x, y });
  }

  // a shot at empty water only leaves a mark
  function missShot(e: MouseEvent<HTMLElement>) {
    if (feedback) return;
    const r = e.currentTarget.getBoundingClientRect();
    const id = ++seq.current;
    const x = r.width ? ((e.clientX - r.left) / r.width) * 100 : 50;
    const y = r.height ? ((e.clientY - r.top) / r.height) * 100 : 50;
    setHoles((h) => [...h.slice(-5), { id, x, y }]);
    setFlash((n) => n + 1);
    playFx("flip");
    later(() => setHoles((h) => h.filter((v) => v.id !== id)), 1400);
  }

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= item.options.length) settle(item.options[n - 1]!.cardId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // settle reads the current item and feedback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, feedback]);

  if (!items || !game) {
    const best = getBest(deckId, "shoot");
    return (
      <section className="fc-panel fc-start">
        <h2>{ft("shoot.title")}</h2>
        <p>{ft("shoot.intro")}</p>
        {best !== null && <p className="fc-note">{fmt(ft("drop.best"), { score: best })}</p>}
        <button type="button" className="btn btn--primary btn--lg" onClick={play}>{ft("common.start")}</button>
      </section>
    );
  }

  if (game.status !== "playing") {
    return (
      <section className="fc-panel fc-result" aria-live="polite">
        <Stars count={game.status === "won" ? Math.max(1, starsForRatio(game.right, game.total)) : starsForRatio(game.right, game.total) >= 2 ? 1 : 0} />
        <h2>{game.status === "won" ? ft("drop.won") : ft("drop.lost")}</h2>
        <p className="fc-result__big tabular">{game.score}</p>
        <p className="fc-result__score">{fmt(ft("drop.summary"), { right: game.right, total: game.total, streak: game.bestStreak })}</p>
        {highScore?.improved && <p className="fc-badge">{ft("drop.newBest")}</p>}
        {highScore && !highScore.improved && highScore.best !== null && <p className="fc-note">{fmt(ft("drop.best"), { score: highScore.best })}</p>}
        <div className="fc-actions">
          <button type="button" className="btn btn--primary" onClick={play}>{ft("common.playAgain")}</button>
          <Link className="btn btn--ghost" to={backTo}>{ft("common.backToDeck")}</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="fc-shoot" aria-label={ft("shoot.title")}>
      <div className="fc-drop__bar">
        <span className="fc-drop__lives" aria-label={fmt(ft("drop.lives"), { n: game.lives })}>
          {Array.from({ length: DROP_LIVES }, (_, i) => (
            <Icon key={i} name="heart" size={20} className={i < game.lives ? "is-full" : "is-empty"} />
          ))}
        </span>
        <span className="fc-drop__score tabular">{fmt(ft("drop.score"), { score: game.score })}</span>
        <span className="fc-note tabular">{game.index + 1} / {game.total}</span>
        <SoundToggle />
      </div>

      <div className={`fc-shoot__prompt${feedback ? (feedback.correct ? " is-hit" : " is-miss") : ""}`} key={`p-${game.index}`}>
        <SideView side={item!.prompt} big />
        <span className="fc-note">{ft("shoot.hint")}</span>
      </div>

      <div className={`fc-shoot__range${shaking ? " is-shaking" : ""}`} onClick={missShot}>
        {flash > 0 && <span key={flash} className="fc-shoot__flash" aria-hidden="true" />}
        {game.streak >= 3 && <span key={`combo-${game.streak}`} className="fc-combo">{fmt(ft("game.combo"), { n: comboMultiplier(game.streak) })}</span>}
        <Pops pops={pops} />
        {holes.map((h) => (
          <span key={h.id} className="fc-shoot__hole" style={{ left: `${h.x}%`, top: `${h.y}%` }} aria-hidden="true" />
        ))}
        {item!.options.map((o, i) => {
          const d = drifts[i];
          if (!d) return null;
          const isRight = o.cardId === item!.cardId;
          const shot = feedback?.chosen === o.cardId;
          const mark = feedback ? (isRight ? " is-right" : shot ? " is-wrong" : " is-away") : "";
          return (
            <button
              key={`${game.index}-${o.cardId}`}
              type="button"
              className={`fc-bubble fc-bubble--${i % 4}${d.rtl ? " is-rtl" : ""}${mark}`}
              style={{ top: `${d.lane}%`, animationDuration: `${d.seconds}s`, animationDelay: `${d.delay}s`, animationPlayState: feedback ? "paused" : "running" }}
              aria-label={fmt(ft("shoot.shot"), { n: i + 1, text: o.side.text })}
              disabled={!!feedback && !shot}
              onClick={(e) => shoot(o.cardId, e)}
              onAnimationEnd={() => isRight && settle(null)}
            >
              <kbd className="fc-kbd">{i + 1}</kbd>
              <SideView side={o.side} speak={false} />
              {shot && <Burst tone={isRight ? "good" : "bad"} />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
