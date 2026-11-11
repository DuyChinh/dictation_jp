import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fmt } from "../../shared/i18n/format";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { Icon } from "../../shared/ui/Icon";
import { triggerConfetti } from "../../shared/utils/confetti";
import { MusicToggle, SoundToggle, Stars, useShake } from "./GameBits";
import { playGameSound, prepareAnswerSounds, startBed, startResultMusic, stopAnswerSound, stopBed, stopResultMusic, tightenBed } from "./gameSound";
import { useMillText } from "./millionaireText";
import {
  LIFELINES,
  PRIZES,
  QUESTIONS,
  QUESTION_SECONDS,
  audienceVotes,
  fallbackPrize,
  fiftyFifty,
  friendAdvice,
  isMilestone,
  isSafeLevel,
  millionaireStars,
  nextMilestonePrize,
  prizeAfter,
  type Advice,
  type Lifeline,
} from "./millionaire";
import { getBest, loadQuizTimer, saveQuizTimer, submitBest } from "./prefs";
import { buildDropRound, type DropItem } from "./quiz";
import { useFt } from "./flashText";
import { useBackTo } from "./StudyContext";
import { SideView } from "./SideView";
import type { Card, Direction } from "./types";

type Props = { deckId: string; cards: Card[]; direction: Direction };

type Phase = "asking" | "locked" | "revealed";
/** The card shown when a safe level has been reached: how many questions are done. */
type Milestone = { n: number };
type Popup = { kind: "audience"; votes: number[] } | { kind: "phone"; advice: Advice; typing: boolean } | { kind: "walk" } | null;
type End = { reason: "wrong" | "time" | "walk" | "win"; prize: number; correct: number };

const LETTERS = ["A", "B", "C", "D"] as const;
const LOCK_MS = 1300;
const REVEAL_MS = 1700;
const FAIL_MS = 2300;
const PHONE_MS = 1500;

/** The ladder of prizes beside the question, the current rung lit and the safe ones marked. */
function Ladder({ index, correct, fmtPrize, label }: { index: number; correct: number; fmtPrize: (n: number) => string; label: string }) {
  return (
    <ol className="fc-mil__ladder" aria-label={label}>
      {Array.from({ length: PRIZES.length }, (_, i) => i)
        .reverse()
        .map((i) => (
          <li key={i} className={`${i === index ? "is-current" : ""}${i < correct ? " is-done" : ""}${isSafeLevel(i + 1) ? " is-safe" : ""}`.trim()} aria-current={i === index ? "step" : undefined}>
            <span className="fc-mil__rung">{i + 1}</span>
            <span className="fc-mil__prize tabular">{fmtPrize(PRIZES[i]!)}</span>
          </li>
        ))}
    </ol>
  );
}

/** Where you are on the ladder as a row of dots, for when there is no room for the ladder itself. */
function Dots({ index, correct }: { index: number; correct: number }) {
  return (
    <ol className="fc-mil__dots" aria-hidden="true">
      {PRIZES.map((_, i) => (
        <li key={i} className={`${i === index ? "is-current" : ""}${i < correct ? " is-done" : ""}${isSafeLevel(i + 1) ? " is-safe" : ""}`.trim()} />
      ))}
    </ol>
  );
}

function LifelineIcon({ kind }: { kind: Lifeline }) {
  if (kind === "fifty") return <span className="fc-mil__fifty">50:50</span>;
  if (kind === "audience") return <Icon name="users" size={22} />;
  if (kind === "swap") return <Icon name="refresh" size={22} />;
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 4h3.2l1.7 4.3-2 1.3a11 11 0 0 0 5.5 5.5l1.3-2 4.3 1.7V18a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

/**
 * The quiz show: fifteen questions up a ladder of prizes. Answer right to climb; a wrong answer or the clock
 * running out drops you to the last safe prize, or you can walk away with what you have. Four lifelines
 * (50:50, ask the audience, phone a friend, swap the question) can each be used once.
 */
export function MillionaireMode({ deckId, cards, direction }: Props) {
  const ft = useFt();
  const mt = useMillText();
  const { uiLang } = useUiLanguage();
  const backTo = useBackTo(deckId);
  const { shaking, shake } = useShake();
  const money = (n: number) => new Intl.NumberFormat(uiLang === "en" ? "en-US" : uiLang === "ja" ? "ja-JP" : "vi-VN").format(n);

  const [stage, setStage] = useState<"idle" | "playing" | "over">("idle");
  const [timed, setTimed] = useState(loadQuizTimer);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [item, setItem] = useState<DropItem | null>(null);
  const [removed, setRemoved] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("asking");
  const [used, setUsed] = useState<Partial<Record<Lifeline, boolean>>>({});
  const [popup, setPopup] = useState<Popup>(null);
  const [left, setLeft] = useState(QUESTION_SECONDS);
  const [timedOut, setTimedOut] = useState(false);
  const [end, setEnd] = useState<End | null>(null);
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [record, setRecord] = useState<{ best: number | null; improved: boolean } | null>(null);

  const itemRef = useRef<DropItem | null>(null);
  const indexRef = useRef(0);
  const correctRef = useRef(0);
  const queueRef = useRef<DropItem[]>([]);
  const lastCard = useRef("");
  const deadline = useRef(0);
  const pausedAt = useRef(0);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const lastTick = useRef(-1);
  itemRef.current = item;
  indexRef.current = index;
  correctRef.current = correctCount;

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      stopBed();
      stopAnswerSound();
      stopResultMusic();
    },
    [],
  );
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  const options = item?.options ?? [];
  const correctIdx = item ? item.options.findIndex((o) => o.cardId === item.cardId) : -1;

  /** The next question's card: from a shuffled round of the deck, never the same card twice running. */
  function pullItem(): DropItem {
    if (queueRef.current.length === 0) queueRef.current = buildDropRound(cards, cards.length, direction);
    let next = queueRef.current.shift()!;
    if (next.cardId === lastCard.current && queueRef.current.length > 0) {
      const swap = queueRef.current.shift()!;
      queueRef.current.push(next);
      next = swap;
    }
    lastCard.current = next.cardId;
    return next;
  }

  /** Puts up question `number` (1-15), with optional background music. */
  function loadQuestion(number: number) {
    setItem(pullItem());
    setRemoved([]);
    setSelected(null);
    setPhase("asking");
    setPopup(null);
    setTimedOut(false);
    deadline.current = Date.now() + QUESTION_SECONDS * 1000;
    setLeft(QUESTION_SECONDS);
    lastTick.current = -1;
    prepareAnswerSounds();
    playGameSound("question");
    startBed(number);
  }

  function newGame() {
    stopResultMusic();
    stopAnswerSound();
    timers.current.forEach(clearTimeout);
    timers.current = [];
    queueRef.current = [];
    lastCard.current = "";
    setIndex(0);
    setCorrectCount(0);
    setUsed({});
    setEnd(null);
    setRecord(null);
    setMilestone(null);
    setStage("playing");
    loadQuestion(1);
  }

  function finish(reason: End["reason"], correct: number) {
    const prize = reason === "win" ? PRIZES[QUESTIONS - 1]! : reason === "walk" ? prizeAfter(correct) : fallbackPrize(correct);
    setEnd({ reason, prize, correct });
    setStage("over");
    setRecord({ best: getBest(deckId, "millionaire2"), improved: submitBest(deckId, "millionaire2", prize, "high") });
    stopBed();
    startResultMusic();
    if (prize > 0) triggerConfetti({ particleCount: reason === "win" ? 200 : 70 });
  }

  /** Shows whether the answer was right, then climbs or ends. */
  function reveal(choice: number | null) {
    const current = itemRef.current;
    if (!current) return;
    const right = choice !== null && current.options[choice]?.cardId === current.cardId;
    setPhase("revealed");
    stopBed();
    if (right) {
      const n = correctRef.current + 1;
      setCorrectCount(n);
      // Every correct answer uses the supplied clip, including safe levels and the final question.
      playGameSound("correct");
      later(() => {
        if (n >= QUESTIONS) finish("win", n);
        else if (isMilestone(n)) {
          triggerConfetti({ particleCount: 90 });
          setMilestone({ n });
        } else {
          setIndex((i) => i + 1);
          loadQuestion(n + 1);
        }
      }, REVEAL_MS);
    } else {
      playGameSound(choice === null ? "timeup" : "wrong");
      shake();
      later(() => finish(choice === null ? "time" : "wrong", correctRef.current), FAIL_MS);
    }
  }

  function choose(i: number) {
    if (phase !== "asking" || popup || removed.includes(i) || !item) return;
    setSelected(i);
    setPhase("locked");
    stopAnswerSound();
    stopBed();
    playGameSound("lock");
    later(() => reveal(i), LOCK_MS);
  }

  // the clock for the question; it stands still while a lifeline is being shown
  useEffect(() => {
    if (stage !== "playing" || phase !== "asking" || popup || !timed) return;
    const id = setInterval(() => {
      const remaining = deadline.current - Date.now();
      const secs = Math.max(0, Math.ceil(remaining / 1000));
      setLeft(secs);
      // the music picks up and the last seconds tick
      tightenBed(secs <= 10);
      if (secs <= 5 && secs > 0 && secs !== lastTick.current) {
        lastTick.current = secs;
        playGameSound("tick");
      }
      if (remaining <= 0) {
        clearInterval(id);
        setTimedOut(true);
        reveal(null);
      }
    }, 250);
    return () => clearInterval(id);
    // reveal reads refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, phase, popup, timed, index, item]);

  function openPopup(next: NonNullable<Popup>) {
    pausedAt.current = Date.now();
    setPopup(next);
  }
  function closePopup() {
    if (pausedAt.current) deadline.current += Date.now() - pausedAt.current;
    pausedAt.current = 0;
    setPopup(null);
  }

  function applyLifeline(kind: Lifeline) {
    if (phase !== "asking" || popup || used[kind] || !item) return;
    const number = index + 1;
    if (kind === "fifty") {
      const gone = fiftyFifty(options.length, correctIdx);
      if (gone.length === 0) return;
      setRemoved(gone);
      playGameSound("fifty");
    } else if (kind === "audience") {
      playGameSound("audience");
      openPopup({ kind: "audience", votes: audienceVotes(options.length, correctIdx, number, removed) });
    } else if (kind === "phone") {
      playGameSound("phone");
      openPopup({ kind: "phone", advice: friendAdvice(options.length, correctIdx, number, removed), typing: true });
      later(() => setPopup((p) => (p?.kind === "phone" ? { ...p, typing: false } : p)), PHONE_MS);
    } else {
      setItem(pullItem());
      setRemoved([]);
      deadline.current = Date.now() + QUESTION_SECONDS * 1000;
      setLeft(QUESTION_SECONDS);
      lastTick.current = -1;
      playGameSound("swap");
    }
    setUsed((u) => ({ ...u, [kind]: true }));
  }

  /** Leaves the milestone card for the next question. */
  function continueAfterMilestone() {
    if (!milestone) return;
    const n = milestone.n;
    setMilestone(null);
    setIndex((i) => i + 1);
    loadQuestion(n + 1);
  }

  const canUse = (kind: Lifeline) => stage === "playing" && phase === "asking" && !popup && !used[kind] && (kind !== "fifty" || options.length >= 3);

  useEffect(() => {
    if (stage !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      const k = e.key.toLowerCase();
      if (milestone) {
        if (k === "enter" || k === " ") {
          e.preventDefault();
          continueAfterMilestone();
        }
        return;
      }
      const at = ["a", "b", "c", "d"].indexOf(k) >= 0 ? ["a", "b", "c", "d"].indexOf(k) : Number(k) >= 1 && Number(k) <= 4 ? Number(k) - 1 : -1;
      if (at >= 0 && at < options.length) choose(at);
      else if (k === "escape" && popup) closePopup();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // choose reads the latest state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, options.length, phase, popup, removed, item, milestone]);

  // ---------- screens ----------

  if (stage === "idle") {
    const best = getBest(deckId, "millionaire2");
    return (
      <section className="fc-panel fc-start fc-mil-start">
        <h2>{ft("mill.title")}</h2>
        <p>{ft("mill.intro")}</p>
        <ul className="fc-miner-rules">
          {(["mill.rule1", "mill.rule2", "mill.rule3", "mill.rule4"] as const).map((k) => (
            <li key={k}>{ft(k)}</li>
          ))}
        </ul>
        <label className="fc-check">
          <input
            type="checkbox"
            checked={timed}
            onChange={(e) => {
              saveQuizTimer(e.target.checked);
              setTimed(e.target.checked);
            }}
          />
          {fmt(ft("mill.timer"), { n: QUESTION_SECONDS })}
        </label>
        <div className="fc-mil-soundrow" role="group" aria-label={mt("sound.hint")}>
          <SoundToggle />
          <span>{mt("sound.effects")}</span>
          <MusicToggle />
          <span>{mt("sound.music")}</span>
        </div>
        {best !== null && <p className="fc-note">{fmt(ft("mill.best"), { prize: money(best) })}</p>}
        <button type="button" className="btn btn--primary btn--lg" onClick={newGame}>{ft("common.start")}</button>
      </section>
    );
  }

  if (stage === "over" && end) {
    const title = end.reason === "win" ? ft("mill.won") : end.reason === "time" ? ft("mill.timeUp") : end.reason === "walk" ? ft("mill.walked") : ft("mill.lost");
    return (
      <section className={`fc-panel fc-result fc-mil-result${end.reason === "win" ? " is-winner" : ""}`} aria-live="polite">
        <div className="fc-mil-result__top">
          <span><Icon name="sparkles" size={16} /> {ft("mill.title")}</span>
          <div className="fc-mil-result__sound"><span>{mt("result.music")}</span><SoundToggle /></div>
        </div>
        <div className="fc-mil-result__trophy" aria-hidden="true"><Icon name={end.reason === "win" ? "crown" : "trophy"} size={64} /></div>
        <Stars count={millionaireStars(end.correct)} />
        <h2>{title}</h2>
        <p className="fc-mil-result__label">{mt("result.prize")}</p>
        <p className="fc-result__big tabular">{money(end.prize)}</p>
        <p className="fc-result__score">{fmt(ft("mill.takeHome"), { prize: money(end.prize) })}</p>
        <div className="fc-mil-result__progress" aria-hidden="true">
          {PRIZES.map((_, i) => <span key={i} className={i < end.correct ? "is-done" : ""} />)}
        </div>
        <p className="fc-note">{fmt(ft("mill.reached"), { n: end.correct, total: QUESTIONS })}</p>
        {record?.improved && end.prize > 0 && <p className="fc-badge">{ft("mill.newBest")}</p>}
        {record && !record.improved && record.best !== null && <p className="fc-note">{fmt(ft("mill.best"), { prize: money(record.best) })}</p>}
        <div className="fc-actions">
          <button type="button" className="btn btn--primary" onClick={newGame}>{ft("common.playAgain")}</button>
          <Link className="btn btn--ghost" to={backTo}>{ft("common.backToDeck")}</Link>
        </div>
      </section>
    );
  }

  const revealed = phase === "revealed";
  const qNumber = index + 1;
  const wrongPicked = revealed && selected !== null && selected !== correctIdx ? selected : null;
  const walkPrize = prizeAfter(correctCount);

  return (
    <section className={`fc-mil${shaking ? " is-shaking" : ""}`} aria-label={ft("mill.title")}>
      <div className="fc-mil__stage">
        <div className="fc-mil__brand" aria-hidden="true">
          <span className="fc-mil__brand-mark"><Icon name="crown" size={25} /></span>
          <div><strong>{ft("mill.title")}</strong><span>{mt("stage.subtitle")}</span></div>
          <span className="fc-mil__grand-prize">{mt("stage.topPrize")}<b className="tabular">{money(PRIZES[QUESTIONS - 1]!)}</b></span>
        </div>
        <div className="fc-mil__main">
          <Dots index={index} correct={correctCount} />
          <header className="fc-mil__top">
            <div className="fc-mil__lifelines" role="group" aria-label={ft("mill.lifelines")}>
              {LIFELINES.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={`fc-mil__life${used[kind] ? " is-used" : ""}`}
                  disabled={!canUse(kind)}
                  onClick={() => applyLifeline(kind)}
                  aria-label={used[kind] ? `${ft(`mill.life.${kind}`)} (${ft("mill.used")})` : ft(`mill.life.${kind}`)}
                  title={ft(`mill.life.${kind}`)}
                >
                  <LifelineIcon kind={kind} />
                </button>
              ))}
            </div>
            <div className="fc-mil__meta">
              <span className="fc-mil__count">
                {fmt(ft("mill.question"), { n: qNumber, total: QUESTIONS })}
                {(isSafeLevel(qNumber) || qNumber === QUESTIONS) && <em className="fc-mil__tag">{mt("ms.tag")}</em>}
              </span>
              <span className="fc-mil__worth tabular">{money(PRIZES[index]!)}</span>
            </div>
            {timed && (
              <span className={`fc-mil__clock tabular${left <= 10 ? " is-low" : ""}${timedOut ? " is-out" : ""}`} aria-label={fmt(ft("blitz.time"), { s: left })} style={{ ["--p" as string]: `${(left / QUESTION_SECONDS) * 100}%` }}>
                {left}
              </span>
            )}
            <SoundToggle />
            <MusicToggle />
          </header>

          <div className="fc-mil__question" key={`q-${index}-${item!.cardId}`}>
            <SideView side={item!.prompt} big />
          </div>

          <div className="fc-mil__answers" role="group" aria-label={ft("test.chooseAnswer")}>
            {options.map((o, i) => {
              const gone = removed.includes(i);
              const isRight = revealed && i === correctIdx;
              const cls = [
                "fc-mil__ans",
                gone ? "is-removed" : "",
                selected === i && phase === "locked" ? "is-locked" : "",
                selected === i && phase === "revealed" && !isRight ? "is-wrong" : "",
                isRight ? "is-right" : "",
                revealed && !isRight && wrongPicked !== i ? "is-dim" : "",
              ].filter(Boolean).join(" ");
              return (
                <button key={`${index}-${o.cardId}`} type="button" className={cls} disabled={gone || phase !== "asking" || !!popup} aria-hidden={gone || undefined} onClick={() => choose(i)} aria-label={`${LETTERS[i]}: ${o.side.text}`}>
                  <span className="fc-mil__letter" aria-hidden="true">{LETTERS[i]}</span>
                  <span className="fc-mil__text"><SideView side={o.side} speak={false} /></span>
                </button>
              );
            })}
          </div>

          {revealed && (
            <p className={`fc-mil__verdict${selected === correctIdx ? " is-right" : " is-wrong"}`} role="status">
              {selected === correctIdx ? ft("mill.right") : timedOut ? ft("mill.timeUpLine") : fmt(ft("mill.wrongLine"), { letter: LETTERS[correctIdx]! })}
            </p>
          )}
          {phase === "locked" && <p className="fc-mil__verdict is-locked" role="status">{fmt(ft("mill.locking"), { letter: LETTERS[selected ?? 0]! })}</p>}

          <footer className="fc-mil__foot">
            <span className="fc-mil__keyboard"><kbd>A</kbd><kbd>B</kbd><kbd>C</kbd><kbd>D</kbd> {mt("stage.keyboard")}</span>
            <button type="button" className="btn btn--ghost btn--sm" disabled={phase !== "asking" || !!popup || correctCount === 0} onClick={() => openPopup({ kind: "walk" })}>
              {fmt(ft("mill.walk"), { prize: money(walkPrize) })}
            </button>
          </footer>

          {milestone && (
            <div className="fc-mil__milestone" role="dialog" aria-modal="true" aria-label={mt("ms.eyebrow")}>
              <div className="fc-mil__cheque">
                <span className="fc-mil__ribbon">{mt("ms.eyebrow")}</span>
                <h3>{mt("ms.title", { n: milestone.n })}</h3>
                <p className="fc-mil__chequelabel">{mt("ms.amount")}</p>
                <strong className="fc-mil__chequeprize tabular">{money(prizeAfter(milestone.n))}</strong>
                <p>{mt("ms.safe")}</p>
                <p className="fc-mil__chequenext">
                  {mt(nextMilestonePrize(milestone.n) === PRIZES[QUESTIONS - 1] ? "ms.top" : "ms.next", { prize: money(nextMilestonePrize(milestone.n)) })}
                </p>
                <button type="button" className="btn btn--primary btn--lg" onClick={continueAfterMilestone} autoFocus>
                  {mt("ms.go")}
                </button>
              </div>
            </div>
          )}

          {popup && (
            <div className="fc-mil__popup" role="dialog" aria-label={ft(popup.kind === "audience" ? "mill.audienceTitle" : popup.kind === "phone" ? "mill.friendTitle" : "mill.walkAsk")}>
              {popup.kind === "audience" && (
                <>
                  <h3>{ft("mill.audienceTitle")}</h3>
                  <div className="fc-mil__bars">
                    {options.map((_, i) => (
                      <div key={i} className={`fc-mil__bar${popup.votes[i] === 0 ? " is-none" : ""}`}>
                        <b className="tabular">{popup.votes[i]}%</b>
                        <span className="fc-mil__fill"><i style={{ height: `${popup.votes[i]}%`, animationDelay: `${i * 0.08}s` }} /></span>
                        <em>{LETTERS[i]}</em>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="btn btn--primary" onClick={closePopup} autoFocus>{ft("common.close")}</button>
                </>
              )}
              {popup.kind === "phone" && (
                <>
                  <h3>{ft("mill.friendTitle")}</h3>
                  <div className="fc-mil__phone">
                    <span className="fc-mil__avatar" aria-hidden="true"><Icon name="user" size={28} /></span>
                    <p className="fc-mil__speech" aria-live="polite">
                      {popup.typing ? (
                        <span className="fc-mil__typing" aria-label={ft("mill.friendThinking")}><i /><i /><i /></span>
                      ) : (
                        fmt(ft(`mill.friend.${popup.advice.tone}`), { letter: LETTERS[popup.advice.pick]!, pct: popup.advice.confidence })
                      )}
                    </p>
                  </div>
                  <button type="button" className="btn btn--primary" onClick={closePopup} disabled={popup.typing} autoFocus>{ft("common.close")}</button>
                </>
              )}
              {popup.kind === "walk" && (
                <>
                  <h3>{ft("mill.walkAsk")}</h3>
                  <p className="fc-mil__walktext">{fmt(ft("mill.walkText"), { prize: money(walkPrize) })}</p>
                  <div className="fc-actions">
                    <button type="button" className="btn btn--primary" onClick={() => { closePopup(); finish("walk", correctCount); }}>{ft("mill.walkYes")}</button>
                    <button type="button" className="btn btn--outline" onClick={closePopup} autoFocus>{ft("mill.walkNo")}</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <Ladder index={index} correct={correctCount} fmtPrize={money} label={ft("mill.ladder")} />
      </div>
    </section>
  );
}
