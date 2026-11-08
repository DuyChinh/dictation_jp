import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fmt } from "../../shared/i18n/format";
import { Icon } from "../../shared/ui/Icon";
import { triggerConfetti } from "../../shared/utils/confetti";
import { Pops, SoundToggle, Stars, playFx, usePops, useShake } from "./GameBits";
import { getBest, submitBest } from "./prefs";
import {
  BLITZ_PENALTY,
  BLITZ_SECONDS,
  blitzNext,
  buildDropRound,
  comboMultiplier,
  startBlitz,
  starsForRatio,
  type BlitzState,
  type DropItem,
} from "./quiz";
import { useFt } from "./flashText";
import { SideView } from "./SideView";
import type { Card, Direction } from "./types";

type Props = { deckId: string; cards: Card[]; direction: Direction };

type Feedback = { chosen: string; correct: boolean };

/** Speed round: 60 seconds of multiple choice. Right answers in a row build a combo; a wrong one costs time. */
export function BlitzMode({ deckId, cards, direction }: Props) {
  const ft = useFt();
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [state, setState] = useState<BlitzState>(startBlitz);
  const [item, setItem] = useState<DropItem | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [left, setLeft] = useState(BLITZ_SECONDS * 1000);
  const [record, setRecord] = useState<{ best: number | null; improved: boolean } | null>(null);
  const deadline = useRef(0);
  const queue = useRef<DropItem[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { pops, pop } = usePops();
  const { shaking, shake } = useShake();

  useEffect(() => () => clearTimeout(timer.current), []);

  function nextItem() {
    if (queue.current.length === 0) queue.current = buildDropRound(cards, cards.length, direction);
    setItem(queue.current.shift()!);
    setFeedback(null);
  }

  function start() {
    clearTimeout(timer.current);
    queue.current = [];
    deadline.current = Date.now() + BLITZ_SECONDS * 1000;
    setState(startBlitz());
    setLeft(BLITZ_SECONDS * 1000);
    setOver(false);
    setRecord(null);
    setRunning(true);
    nextItem();
  }

  // the clock
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const remaining = deadline.current - Date.now();
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(id);
        setRunning(false);
        setOver(true);
      }
    }, 100);
    return () => clearInterval(id);
  }, [running]);

  // the end of a round
  useEffect(() => {
    if (!over) return;
    const improved = submitBest(deckId, "blitz", state.score, "high");
    setRecord({ best: getBest(deckId, "blitz"), improved });
    playFx("win");
    if (state.right > 0) triggerConfetti({ particleCount: 70 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);

  function answer(cardId: string) {
    if (!item || feedback || !running) return;
    const correct = cardId === item.cardId;
    const mult = comboMultiplier(state.streak);
    const { state: next, gained } = blitzNext(state, correct);
    setState(next);
    setFeedback({ chosen: cardId, correct });
    if (correct) {
      playFx("correct");
      pop(`+${gained}`, "good", 30 + Math.random() * 40);
      if (mult > 1) pop(fmt(ft("game.combo"), { n: mult }), "info", 62);
    } else {
      playFx("wrong");
      deadline.current -= BLITZ_PENALTY * 1000;
      pop(`-${BLITZ_PENALTY}s`, "bad", 50);
      shake();
    }
    timer.current = setTimeout(nextItem, correct ? 280 : 650);
  }

  useEffect(() => {
    if (!item || !running) return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= item.options.length) answer(item.options[n - 1]!.cardId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // answer reads the current item, feedback and state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, feedback, running, state]);

  if (!running && !over) {
    const best = getBest(deckId, "blitz");
    return (
      <section className="fc-panel fc-start">
        <h2>{ft("blitz.title")}</h2>
        <p>{ft("blitz.intro")}</p>
        {best !== null && <p className="fc-note">{fmt(ft("blitz.best"), { score: best })}</p>}
        <button type="button" className="btn btn--primary btn--lg" onClick={start}>{ft("common.start")}</button>
      </section>
    );
  }

  if (over) {
    return (
      <section className="fc-panel fc-result" aria-live="polite">
        <Stars count={starsForRatio(state.right, state.right + state.wrong)} />
        <h2>{ft("blitz.done")}</h2>
        <p className="fc-result__big tabular">{state.score}</p>
        <p className="fc-result__score">{fmt(ft("blitz.summary"), { right: state.right, wrong: state.wrong, streak: state.bestStreak })}</p>
        {record?.improved && <p className="fc-badge">{ft("blitz.newBest")}</p>}
        {record && !record.improved && record.best !== null && <p className="fc-note">{fmt(ft("blitz.best"), { score: record.best })}</p>}
        <div className="fc-actions">
          <button type="button" className="btn btn--primary" onClick={start}>{ft("common.playAgain")}</button>
          <Link className="btn btn--ghost" to={`/flashcards/${deckId}`}>{ft("common.backToDeck")}</Link>
        </div>
      </section>
    );
  }

  const seconds = Math.ceil(left / 1000);
  const mult = comboMultiplier(state.streak);
  return (
    <section className={`fc-blitz${shaking ? " is-shaking" : ""}`} aria-label={ft("blitz.title")}>
      <div className="fc-blitz__bar">
        <span className={`fc-blitz__time tabular${seconds <= 10 ? " is-low" : ""}`} aria-label={fmt(ft("blitz.time"), { s: seconds })}>
          <Icon name="clock" size={20} /> {seconds}
        </span>
        <span className="fc-blitz__score tabular">{fmt(ft("blitz.score"), { score: state.score })}</span>
        <SoundToggle />
      </div>
      <div className="fc-timebar" aria-hidden="true">
        <span className={seconds <= 10 ? "is-low" : ""} style={{ width: `${(left / (BLITZ_SECONDS * 1000)) * 100}%` }} />
      </div>
      <div className="fc-blitz__stage">
        {mult > 1 && <span key={`combo-${state.streak}`} className="fc-combo">{fmt(ft("game.combo"), { n: mult })}</span>}
        <Pops pops={pops} />
        <div className={`fc-blitz__prompt${feedback ? (feedback.correct ? " is-hit" : " is-miss") : ""}`} key={`q-${state.right + state.wrong}`}>
          <SideView side={item!.prompt} big />
        </div>
      </div>
      <div className="fc-drop__options">
        {item!.options.map((o, i) => {
          const mark = feedback ? (o.cardId === item!.cardId ? " is-right" : feedback.chosen === o.cardId ? " is-wrong" : "") : "";
          return (
            <button key={o.cardId} type="button" className={`fc-q__option${mark}`} disabled={!!feedback} onClick={() => answer(o.cardId)}>
              <kbd className="fc-kbd">{i + 1}</kbd>
              <SideView side={o.side} speak={false} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
