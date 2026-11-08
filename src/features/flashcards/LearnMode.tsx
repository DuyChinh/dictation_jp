import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../shared/ui/Icon";
import { SpeakButton } from "../../shared/ui/SpeakButton";
import { fmt } from "../../shared/i18n/format";
import { useFt } from "./flashText";
import { pickFlip, shuffle, sidesOf } from "./quiz";
import { recordAnswer } from "./store";
import { SideView } from "./SideView";
import type { Card, Direction } from "./types";

type Props = { deckId: string; cards: Card[]; direction: Direction };
type Scope = "all" | "due";

type Item = { card: Card; flip: boolean };

/** Flip-through study: see one side, think, flip, then say whether you knew it. Answers move cards between boxes. */
export function LearnMode({ deckId, cards, direction }: Props) {
  const ft = useFt();
  const now = Date.now();
  const due = useMemo(() => cards.filter((c) => c.due <= now), [cards, now]);
  const [scope, setScope] = useState<Scope>(due.length > 0 && due.length < cards.length ? "due" : "all");
  const [mix, setMix] = useState(true);
  const [session, setSession] = useState<Item[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [unknown, setUnknown] = useState<string[]>([]);

  function start(from: Card[]) {
    const ordered = mix ? shuffle(from) : [...from].sort((a, b) => a.createdAt - b.createdAt);
    setSession(ordered.map((card) => ({ card, flip: pickFlip(direction) })));
    setIndex(0);
    setFlipped(false);
    setUnknown([]);
  }

  const done = session !== null && index >= session.length;
  const item = session && !done ? session[index]! : null;

  function answer(known: boolean) {
    if (!item) return;
    recordAnswer(item.card.id, known);
    if (!known) setUnknown((u) => [...u, item.card.id]);
    setIndex((i) => i + 1);
    setFlipped(false);
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
      <p className="fc-learn__count">{index + 1} / {session.length}</p>

      <div className={`fc-flash${flipped ? " is-back" : ""}`}>
        <button type="button" className="fc-flash__face" onClick={() => setFlipped((f) => !f)} aria-label={ft("learn.flip")}>
          <span className="fc-flash__label">{flipped ? ft("learn.back") : ft("learn.front")}</span>
          <SideView key={`${item!.card.id}:${flipped}`} side={shown} big speak={false} />
          {!flipped && <span className="fc-flash__hint">{ft("learn.flipHint")}</span>}
        </button>
        {shown.lang === "ja" && <SpeakButton className="fc-flash__speak" text={shown.reading || shown.text} />}
      </div>

      <div className="fc-learn__answers">
        <button type="button" className="btn btn--outline fc-btn-bad" onClick={() => answer(false)}>
          <Icon name="close" size={18} /> {ft("learn.dontKnow")}
        </button>
        <button type="button" className="btn btn--outline fc-btn-ok" onClick={() => answer(true)}>
          <Icon name="check" size={18} /> {ft("learn.know")}
        </button>
      </div>
      <p className="fc-keys">{ft("learn.keys")}</p>
    </section>
  );
}
