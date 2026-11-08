import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../shared/ui/Icon";
import { SpeakButton } from "../../shared/ui/SpeakButton";
import { fmt } from "../../shared/i18n/format";
import { useFt } from "./flashText";
import { pickFlip, shuffle, sidesOf } from "./quiz";
import { AUTO_FLIP_CHOICES, loadAutoFlip, saveAutoFlip, type AutoFlip } from "./prefs";
import { clearLearn, resumeLearn, saveLearn } from "./learnProgress";
import { recordAnswer } from "./store";
import { SideView } from "./SideView";
import type { Card, Direction } from "./types";

type Props = { deckId: string; cards: Card[]; direction: Direction };
type Scope = "all" | "due";

type Item = { card: Card; flip: boolean };

/** How far (px) a card must be dragged sideways to count as an answer, and how far a press may move and still be a tap. */
const SWIPE_MIN = 70;
const SWIPE_MAX = 120;
const TAP_SLOP = 8;
const LEAVE_MS = 220;
/** The back face stays drawn this long after turning to the front, so the turn can finish. */
const TURN_MS = 600;

/** Flip-through study: see one side, think, flip, then say whether you knew it. Answers move cards between boxes. */
export function LearnMode({ deckId, cards, direction }: Props) {
  const ft = useFt();
  const now = Date.now();
  const due = useMemo(() => cards.filter((c) => c.due <= now), [cards, now]);
  const [scope, setScope] = useState<Scope>(due.length > 0 && due.length < cards.length ? "due" : "all");
  const [mix, setMix] = useState(true);
  // a round left half way is picked up again where it stopped
  const [resumed] = useState(() => resumeLearn(deckId, cards));
  const [session, setSession] = useState<Item[] | null>(resumed?.items ?? null);
  const [index, setIndex] = useState(resumed?.index ?? 0);
  const [flipped, setFlipped] = useState(false);
  const [unknown, setUnknown] = useState<string[]>(resumed?.unknown ?? []);
  const [showResumed, setShowResumed] = useState(resumed !== null);
  const [auto, setAutoState] = useState<AutoFlip>(loadAutoFlip);
  const [linger, setLinger] = useState<string | null>(null);
  const setAuto = (next: AutoFlip) => {
    saveAutoFlip(next);
    setAutoState(next);
  };
  // dragging the card: how far it is from the middle, whether a finger or mouse is down, and which way it is leaving
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<-1 | 1 | null>(null);
  const press = useRef<{ x: number; y: number; id: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(leaveTimer.current), []);

  function start(from: Card[]) {
    const ordered = mix ? shuffle(from) : [...from].sort((a, b) => a.createdAt - b.createdAt);
    setSession(ordered.map((card) => ({ card, flip: pickFlip(direction) })));
    setIndex(0);
    setFlipped(false);
    setUnknown([]);
  }

  // remember the round after every answer, and forget it once it is finished
  useEffect(() => {
    if (!session) return;
    if (index >= session.length) clearLearn(deckId);
    else saveLearn(deckId, { order: session.map((x) => x.card.id), flips: session.map((x) => x.flip), index, unknown, at: Date.now() });
  }, [deckId, session, index, unknown]);

  function restart() {
    clearLearn(deckId);
    setSession(null);
    setIndex(0);
    setFlipped(false);
    setUnknown([]);
    setShowResumed(false);
  }

  const done = session !== null && index >= session.length;
  const item = session && !done ? session[index]! : null;

  function answer(known: boolean) {
    if (!item) return;
    recordAnswer(item.card.id, known);
    setShowResumed(false);
    if (!known) setUnknown((u) => [...u, item.card.id]);
    setIndex((i) => i + 1);
    setFlipped(false);
    setDx(0);
    setDragging(false);
    setLeaving(null);
  }

  // the card turns over by itself after a while, unless it is being dragged
  useEffect(() => {
    if (!item || flipped || dragging || leaving || !auto.on) return;
    const id = setTimeout(() => setFlipped(true), auto.seconds * 1000);
    return () => clearTimeout(id);
  }, [item, flipped, dragging, leaving, auto.on, auto.seconds, index]);

  // keep the back face drawn while the card turns back to the front
  const currentId = item?.card.id ?? null;
  useEffect(() => {
    if (flipped) {
      setLinger(currentId);
      return;
    }
    const id = setTimeout(() => setLinger(null), TURN_MS);
    return () => clearTimeout(id);
  }, [flipped, currentId]);

  const threshold = () => Math.min(SWIPE_MAX, Math.max(SWIPE_MIN, (dragRef.current?.offsetWidth ?? 0) * 0.28));

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (leaving || (e.pointerType === "mouse" && e.button !== 0)) return;
    // the speaker is its own control
    if ((e.target as Element).closest(".speak-btn")) return;
    press.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
    suppressClick.current = false;
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    const moveX = e.clientX - p.x;
    if (!p.moved) {
      if (Math.abs(moveX) < TAP_SLOP) return;
      // mostly up or down is a scroll, not a swipe
      if (Math.abs(e.clientY - p.y) > Math.abs(moveX)) {
        press.current = null;
        return;
      }
      p.moved = true;
      setDragging(true);
      dragRef.current?.setPointerCapture?.(e.pointerId);
    }
    setDx(moveX);
  }

  function endPress(e: PointerEvent<HTMLDivElement>, cancelled = false) {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    press.current = null;
    if (!p.moved) return;
    suppressClick.current = true;
    setDragging(false);
    const moved = e.clientX - p.x;
    if (!cancelled && Math.abs(moved) >= threshold()) {
      const dir = moved > 0 ? 1 : -1;
      setLeaving(dir);
      setDx(dir * 700);
      leaveTimer.current = setTimeout(() => answer(dir > 0), LEAVE_MS);
    } else setDx(0);
  }

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === " " || e.key === "ArrowUp" || e.key === "ArrowDown") {
        if (el?.tagName === "BUTTON" && e.key === " ") return;
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowLeft") answer(false);
      else if (e.key === "ArrowRight") answer(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // answer closes over the current item
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, index]);

  if (!session) {
    const pool = scope === "due" ? due : cards;
    return (
      <section className="fc-panel fc-start">
        <h2>{ft("learn.title")}</h2>
        <p>{ft("learn.intro")}</p>
        <div className="fc-choice" role="radiogroup" aria-label={ft("learn.scope")}>
          <button type="button" role="radio" aria-checked={scope === "all"} className={`fc-choice__item${scope === "all" ? " is-on" : ""}`} onClick={() => setScope("all")}>
            {fmt(ft("learn.scopeAll"), { n: cards.length })}
          </button>
          <button type="button" role="radio" aria-checked={scope === "due"} className={`fc-choice__item${scope === "due" ? " is-on" : ""}`} onClick={() => setScope("due")} disabled={due.length === 0}>
            {fmt(ft("learn.scopeDue"), { n: due.length })}
          </button>
        </div>
        <label className="fc-check">
          <input type="checkbox" checked={mix} onChange={(e) => setMix(e.target.checked)} />
          {ft("learn.shuffle")}
        </label>
        <div className="fc-auto">
          <label className="fc-check">
            <input type="checkbox" checked={auto.on} onChange={(e) => setAuto({ ...auto, on: e.target.checked })} />
            {ft("learn.auto")}
          </label>
          <label className="fc-auto__secs">
            <span className="visually-hidden">{ft("learn.autoSeconds")}</span>
            <select value={auto.seconds} disabled={!auto.on} onChange={(e) => setAuto({ ...auto, seconds: Number(e.target.value) })} aria-label={ft("learn.autoSeconds")}>
              {[...new Set<number>([...AUTO_FLIP_CHOICES, auto.seconds])].sort((a, b) => a - b).map((n) => (
                <option key={n} value={n}>{fmt(ft("learn.autoSecs"), { n })}</option>
              ))}
            </select>
          </label>
        </div>
        <button type="button" className="btn btn--primary btn--lg" onClick={() => start(pool)} disabled={pool.length === 0}>
          {ft("common.start")}
        </button>
        {due.length === 0 && <p className="fc-note">{ft("learn.noneDue")}</p>}
      </section>
    );
  }

  if (done) {
    const retry = cards.filter((c) => unknown.includes(c.id));
    return (
      <section className="fc-panel fc-result">
        <h2>{ft("learn.doneTitle")}</h2>
        <p className="fc-result__score">
          {fmt(ft("learn.doneScore"), { known: session.length - unknown.length, total: session.length })}
        </p>
        <div className="fc-actions">
          {retry.length > 0 && (
            <button type="button" className="btn btn--primary" onClick={() => start(retry)}>
              {fmt(ft("learn.retryUnknown"), { n: retry.length })}
            </button>
          )}
          <button type="button" className="btn btn--outline" onClick={() => start(cards)}>
            {ft("learn.again")}
          </button>
          <Link className="btn btn--ghost" to={`/flashcards/${deckId}`}>{ft("common.backToDeck")}</Link>
        </div>
      </section>
    );
  }

  const { prompt, answer: back } = sidesOf(item!.card, item!.flip);
  const shown = flipped ? back : prompt;
  return (
    <section className="fc-learn" aria-label={ft("learn.title")}>
      <div className="fc-progress" role="progressbar" aria-valuemin={0} aria-valuemax={session.length} aria-valuenow={index}>
        <span style={{ width: `${(index / session.length) * 100}%` }} />
      </div>
      <div className="fc-learn__meta">
        <p className="fc-learn__count">{index + 1} / {session.length}</p>
        <button
          type="button"
          className={`fc-autochip${auto.on ? " is-on" : ""}`}
          aria-pressed={auto.on}
          onClick={() => setAuto({ ...auto, on: !auto.on })}
          title={ft("learn.auto")}
        >
          <Icon name="clock" size={16} /> {auto.on ? fmt(ft("learn.autoChip"), { n: auto.seconds }) : ft("learn.autoOff")}
        </button>
        <button type="button" className="fc-autochip" onClick={restart}>
          <Icon name="refresh" size={16} /> {ft("learn.restart")}
        </button>
      </div>
      {showResumed && <p className="fc-note fc-learn__resumed" role="status">{fmt(ft("learn.resumed"), { n: index + 1, total: session.length })}</p>}

      <div className={`fc-flash${flipped ? " is-back" : ""}`}>
        <div
          key={index}
          ref={dragRef}
          className={`fc-flash__drag${dragging ? " is-dragging" : ""}${dx > 40 ? " is-right" : dx < -40 ? " is-left" : ""}`}
          style={{ transform: dx ? `translateX(${dx}px) rotate(${Math.max(-18, Math.min(18, dx / 18))}deg)` : undefined }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endPress(e)}
          onPointerCancel={(e) => endPress(e, true)}
          onClickCapture={(e) => {
            if (suppressClick.current) {
              suppressClick.current = false;
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          <span className="fc-flash__stamp fc-flash__stamp--ok" style={{ opacity: Math.min(1, Math.max(0, dx) / threshold()) }} aria-hidden="true">
            <Icon name="check" size={20} strokeWidth={3} /> {ft("learn.know")}
          </span>
          <span className="fc-flash__stamp fc-flash__stamp--bad" style={{ opacity: Math.min(1, Math.max(0, -dx) / threshold()) }} aria-hidden="true">
            <Icon name="close" size={20} strokeWidth={3} /> {ft("learn.dontKnow")}
          </span>
          <button type="button" className="fc-flash__face" onClick={() => setFlipped((f) => !f)} aria-label={ft("learn.flip")}>
            <span className="fc-flash__inner">
              <span className="fc-flash__side fc-flash__side--front" aria-hidden={flipped}>
                {auto.on && !flipped && !dragging && <span key={`t-${index}`} className="fc-flash__timer" style={{ animationDuration: `${auto.seconds}s` }} aria-hidden="true" />}
                <span className="fc-flash__label">{ft("learn.front")}</span>
                <SideView side={prompt} big speak={false} />
                <span className="fc-flash__hint">{ft("learn.flipHint")}</span>
              </span>
              {(flipped || linger === item!.card.id) && (
                <span className="fc-flash__side fc-flash__side--back" aria-hidden={!flipped}>
                  <span className="fc-flash__label">{ft("learn.back")}</span>
                  <SideView side={back} big speak={false} />
                </span>
              )}
            </span>
          </button>
          {shown.lang === "ja" && <SpeakButton className="fc-flash__speak" text={shown.reading || shown.text} />}
        </div>
      </div>

      <div className="fc-learn__answers">
        <button type="button" className="btn btn--outline fc-btn-bad" onClick={() => answer(false)}>
          <Icon name="close" size={18} /> {ft("learn.dontKnow")}
        </button>
        <button type="button" className="btn btn--outline fc-btn-ok" onClick={() => answer(true)}>
          <Icon name="check" size={18} /> {ft("learn.know")}
        </button>
      </div>
      <p className="fc-swipehint">{ft("learn.swipe")}</p>
      <p className="fc-keys">{ft("learn.keys")}</p>
    </section>
  );
}
