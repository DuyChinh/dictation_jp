import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { triggerConfetti } from "../../shared/utils/confetti";
import { fmt } from "../../shared/i18n/format";
import { Icon } from "../../shared/ui/Icon";
import { Burst, Pops, SoundToggle, Stars, playFx, usePops, useShake } from "./GameBits";
import { getBest, submitBest } from "./prefs";
import { DROP_LIVES, buildDropRound, comboMultiplier, dropNext, fallSeconds, starsForRatio, startDrop, type DropItem, type DropState } from "./quiz";
import { useFt } from "./flashText";
import { useBackTo } from "./StudyContext";
import { SideView } from "./SideView";
import type { Card, Direction } from "./types";

type Props = { deckId: string; cards: Card[]; direction: Direction };

const ROUND = 20;
const FEEDBACK_MS = 1000;

type Feedback = { chosen: string | null; correct: boolean };

/** Falling words: a word drops from the top; pick its meaning before it hits the ground. Three lives. */
export function DropMode({ deckId, cards, direction }: Props) {
  const ft = useFt();
  const backTo = useBackTo(deckId);
  const [items, setItems] = useState<DropItem[] | null>(null);
  const [game, setGame] = useState<DropState | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [highScore, setHighScore] = useState<{ best: number | null; improved: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { pops, pop } = usePops();
  const { shaking, shake } = useShake();

  const item = items && game && game.status === "playing" ? items[game.index] : null;
  const seconds = useMemo(() => fallSeconds(game?.right ?? 0), [game?.right]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function play() {
    const round = buildDropRound(cards, ROUND, direction);
    setItems(round);
    setGame(startDrop(round.length));
    setFeedback(null);
    setHighScore(null);
  }

  /** Shows the right answer for a moment, then moves on to the next word. */
  function settle(chosen: string | null) {
    if (!item || !game || feedback) return;
    const correct = chosen === item.cardId;
    setFeedback({ chosen, correct });
    playFx(correct ? "correct" : "wrong");
    if (correct) {
      const gained = 10 + Math.min(game.streak, 5) * 2;
      pop(`+${gained}`, "good");
      if (game.streak + 1 >= 3) pop(fmt(ft("game.combo"), { n: comboMultiplier(game.streak + 1) }), "info", 70);
    } else shake();
    timer.current = setTimeout(() => {
      const next = dropNext(game, correct);
      setGame(next);
      setFeedback(null);
      if (next.status !== "playing") {
        const improved = submitBest(deckId, "drop", next.score, "high");
        setHighScore({ best: getBest(deckId, "drop"), improved });
        if (next.status === "won") {
          playFx("win");
          triggerConfetti({ particleCount: 80 });
        }
      }
    }, correct ? 350 : FEEDBACK_MS);
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
    const best = getBest(deckId, "drop");
    return (
      <section className="fc-panel fc-start">
        <h2>{ft("drop.title")}</h2>
        <p>{ft("drop.intro")}</p>
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
        <p className="fc-result__score">
          {fmt(ft("drop.summary"), { right: game.right, total: game.total, streak: game.bestStreak })}
        </p>
        {highScore?.improved && <p className="fc-badge">{ft("drop.newBest")}</p>}
        {highScore && !highScore.improved && highScore.best !== null && (
          <p className="fc-note">{fmt(ft("drop.best"), { score: highScore.best })}</p>
        )}
        <div className="fc-actions">
          <button type="button" className="btn btn--primary" onClick={play}>{ft("common.playAgain")}</button>
          <Link className="btn btn--ghost" to={backTo}>{ft("common.backToDeck")}</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="fc-drop" aria-label={ft("drop.title")}>
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

      <div className={`fc-drop__sky${shaking ? " is-shaking" : ""}${feedback && !feedback.correct ? " is-flash" : ""}`} aria-live="polite">
        {game.streak >= 3 && <span key={`combo-${game.streak}`} className="fc-combo">{fmt(ft("game.combo"), { n: comboMultiplier(game.streak) })}</span>}
        <Pops pops={pops} />
        <div
          key={`w-${game.index}`}
          className={`fc-drop__word${feedback ? (feedback.correct ? " is-hit" : " is-miss") : ""}`}
          style={{ animationDuration: `${seconds}s`, animationPlayState: feedback ? "paused" : "running" }}
          onAnimationEnd={() => settle(null)}
        >
          <SideView side={item!.prompt} big />
          {feedback?.correct && <Burst />}
        </div>
        <div className="fc-drop__ground" aria-hidden="true" />
      </div>

      <div className="fc-drop__options">
        {item!.options.map((o, i) => {
          const mark = feedback ? (o.cardId === item!.cardId ? " is-right" : feedback.chosen === o.cardId ? " is-wrong" : "") : "";
          return (
            <button key={o.cardId} type="button" className={`fc-q__option${mark}`} disabled={!!feedback} onClick={() => settle(o.cardId)}>
              <kbd className="fc-kbd">{i + 1}</kbd>
              <SideView side={o.side} speak={false} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
