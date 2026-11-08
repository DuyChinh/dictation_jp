import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fmt } from "../../shared/i18n/format";
import { Icon } from "../../shared/ui/Icon";
import { triggerConfetti } from "../../shared/utils/confetti";
import { Burst, SoundToggle, Stars, playFx } from "./GameBits";
import { getBest, submitBest } from "./prefs";
import { buildMatchRound, memoryStars, type MatchTile } from "./quiz";
import { useFt } from "./flashText";
import { formatSeconds } from "./MatchMode";
import { SideView } from "./SideView";
import type { Card, Direction } from "./types";

type Props = { deckId: string; cards: Card[]; direction: Direction };

const PAIRS = 6;
const REVEAL_MS = 900;

/** Memory: every tile starts face down; turn two at a time and keep the pairs where a word meets its meaning. */
export function MemoryMode({ deckId, cards, direction }: Props) {
  const ft = useFt();
  const [tiles, setTiles] = useState<MatchTile[] | null>(null);
  const [up, setUp] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [mistakes, setMistakes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [record, setRecord] = useState<{ best: number | null; improved: boolean } | null>(null);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pairs = tiles ? tiles.length / 2 : 0;
  const finished = tiles !== null && matched.size === pairs;

  useEffect(() => () => clearTimeout(timer.current), []);

  const play = useCallback(() => {
    clearTimeout(timer.current);
    setTiles(buildMatchRound(cards, PAIRS, direction));
    setUp([]);
    setMatched(new Set());
    setMistakes(0);
    setElapsed(0);
    setRecord(null);
    startedAt.current = Date.now();
  }, [cards, direction]);

  useEffect(() => {
    if (!tiles || finished) return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt.current), 200);
    return () => clearInterval(id);
  }, [tiles, finished]);

  useEffect(() => {
    if (!finished) return;
    const time = Date.now() - startedAt.current;
    setElapsed(time);
    const full = pairs >= Math.min(PAIRS, cards.length);
    const improved = full ? submitBest(deckId, "memory", time, "low") : false;
    setRecord({ best: getBest(deckId, "memory"), improved });
    playFx("win");
    triggerConfetti({ particleCount: 70 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  function flip(tile: MatchTile) {
    if (!tiles || up.length >= 2 || up.includes(tile.tileId) || matched.has(tile.cardId)) return;
    playFx("flip");
    const next = [...up, tile.tileId];
    setUp(next);
    if (next.length < 2) return;
    const [a, b] = next.map((id) => tiles.find((t) => t.tileId === id)!);
    if (a!.cardId === b!.cardId) {
      timer.current = setTimeout(() => {
        playFx("correct");
        setMatched((m) => new Set(m).add(a!.cardId));
        setUp([]);
      }, 350);
    } else {
      setMistakes((n) => n + 1);
      timer.current = setTimeout(() => {
        playFx("wrong");
        setUp([]);
      }, REVEAL_MS);
    }
  }

  if (!tiles) {
    const best = getBest(deckId, "memory");
    return (
      <section className="fc-panel fc-start">
        <h2>{ft("memory.title")}</h2>
        <p>{ft("memory.intro")}</p>
        {best !== null && <p className="fc-note">{fmt(ft("memory.best"), { time: formatSeconds(best) })}</p>}
        <button type="button" className="btn btn--primary btn--lg" onClick={play}>{ft("common.start")}</button>
      </section>
    );
  }

  if (finished) {
    return (
      <section className="fc-panel fc-result" aria-live="polite">
        <Stars count={memoryStars(pairs, mistakes)} />
        <h2>{ft("memory.doneTitle")}</h2>
        <p className="fc-result__big tabular">{formatSeconds(elapsed)}</p>
        <p className="fc-result__score">{fmt(ft("memory.mistakes"), { n: mistakes })}</p>
        {record?.improved && <p className="fc-badge">{ft("memory.newBest")}</p>}
        {record && !record.improved && record.best !== null && <p className="fc-note">{fmt(ft("memory.best"), { time: formatSeconds(record.best) })}</p>}
        <div className="fc-actions">
          <button type="button" className="btn btn--primary" onClick={play}>{ft("common.playAgain")}</button>
          <Link className="btn btn--ghost" to={`/flashcards/${deckId}`}>{ft("common.backToDeck")}</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="fc-memory" aria-label={ft("memory.title")}>
      <div className="fc-match__bar">
        <span className="fc-match__time tabular">{formatSeconds(elapsed)}</span>
        <span className="fc-note">{fmt(ft("memory.mistakes"), { n: mistakes })}</span>
        <SoundToggle />
        <button type="button" className="btn btn--ghost btn--sm" onClick={play}>{ft("match.restart")}</button>
      </div>
      <div className="fc-memory__grid">
        {tiles.map((t, i) => {
          const done = matched.has(t.cardId);
          const faceUp = done || up.includes(t.tileId);
          const wrongPair = up.length === 2 && up.includes(t.tileId) && !done && tiles.find((x) => x.tileId === up[0])!.cardId !== tiles.find((x) => x.tileId === up[1])!.cardId;
          return (
            <button
              key={t.tileId}
              type="button"
              className={`fc-mem${faceUp ? " is-up" : ""}${done ? " is-done" : ""}${wrongPair ? " is-wrong" : ""}`}
              aria-label={faceUp ? undefined : fmt(ft("memory.faceDown"), { n: i + 1 })}
              aria-pressed={faceUp}
              onClick={() => flip(t)}
            >
              <span className="fc-mem__inner">
                <span className="fc-mem__face fc-mem__front" aria-hidden="true"><Icon name="sparkles" size={26} /></span>
                <span className="fc-mem__face fc-mem__back" aria-hidden={!faceUp}>
                  <SideView side={t.side} speak={false} />
                </span>
              </span>
              {done && <Burst />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
