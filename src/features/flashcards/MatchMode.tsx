import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { triggerConfetti } from "../../shared/utils/confetti";
import { fmt } from "../../shared/i18n/format";
import { Burst, SoundToggle, Stars, playFx } from "./GameBits";
import { getBest, submitBest } from "./prefs";
import { buildMatchRound, matchStars, type MatchTile } from "./quiz";
import { useFt } from "./flashText";
import { useBackTo } from "./StudyContext";
import { SideView } from "./SideView";
import type { Card, Direction } from "./types";

type Props = { deckId: string; cards: Card[]; direction: Direction };

const ROUND = 6;
const WRONG_FLASH_MS = 500;

export const formatSeconds = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;

/** Timed matching: pair every term with its definition as fast as possible. */
export function MatchMode({ deckId, cards, direction }: Props) {
  const ft = useFt();
  const backTo = useBackTo(deckId);
  const [tiles, setTiles] = useState<MatchTile[] | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [wrong, setWrong] = useState<[string, string] | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [record, setRecord] = useState<{ best: number | null; improved: boolean } | null>(null);
  const startedAt = useRef(0);
  const finished = tiles !== null && matched.size === tiles.length / 2;

  const play = useCallback(() => {
    setTiles(buildMatchRound(cards, ROUND, direction));
    setMatched(new Set());
    setSelected(null);
    setWrong(null);
    setMistakes(0);
    setElapsed(0);
    setRecord(null);
    startedAt.current = Date.now();
  }, [cards, direction]);

  useEffect(() => {
    if (!tiles || finished) return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt.current), 100);
    return () => clearInterval(id);
  }, [tiles, finished]);

  useEffect(() => {
    if (!finished) return;
    const time = Date.now() - startedAt.current;
    setElapsed(time);
    // only a full round of the usual size counts toward the best time
    const full = tiles!.length / 2 >= Math.min(ROUND, cards.length);
    const improved = full ? submitBest(deckId, "match", time, "low") : false;
    setRecord({ best: getBest(deckId, "match"), improved });
    playFx("win");
    triggerConfetti({ particleCount: 60 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  function pick(tile: MatchTile) {
    if (!tiles || wrong || matched.has(tile.cardId)) return;
    if (selected === tile.tileId) return setSelected(null);
    if (!selected) return setSelected(tile.tileId);
    const first = tiles.find((t) => t.tileId === selected)!;
    if (first.cardId === tile.cardId && first.kind !== tile.kind) {
      playFx("correct");
      setMatched((m) => new Set(m).add(tile.cardId));
      setSelected(null);
    } else if (first.kind === tile.kind) {
      // two of the same side: just move the selection
      setSelected(tile.tileId);
    } else {
      playFx("wrong");
      setMistakes((n) => n + 1);
      setWrong([first.tileId, tile.tileId]);
      setTimeout(() => {
        setWrong(null);
        setSelected(null);
      }, WRONG_FLASH_MS);
    }
  }

  if (!tiles) {
    const best = getBest(deckId, "match");
    return (
      <section className="fc-panel fc-start">
        <h2>{ft("match.title")}</h2>
        <p>{ft("match.intro")}</p>
        {best !== null && <p className="fc-note">{fmt(ft("match.best"), { time: formatSeconds(best) })}</p>}
        <button type="button" className="btn btn--primary btn--lg" onClick={play}>{ft("common.start")}</button>
      </section>
    );
  }

  return (
    <section className="fc-match" aria-label={ft("match.title")}>
      <div className="fc-match__bar">
        <span className="fc-match__time tabular" aria-live="off">{formatSeconds(elapsed)}</span>
        <span className="fc-note">{fmt(ft("match.mistakes"), { n: mistakes })}</span>
        <SoundToggle />
        <button type="button" className="btn btn--ghost btn--sm" onClick={play}>{ft("match.restart")}</button>
      </div>

      {finished ? (
        <div className="fc-panel fc-result" aria-live="polite">
          <Stars count={matchStars(tiles.length / 2, elapsed, mistakes)} />
          <h2>{ft("match.doneTitle")}</h2>
          <p className="fc-result__big tabular">{formatSeconds(elapsed)}</p>
          <p className="fc-result__score">{fmt(ft("match.mistakes"), { n: mistakes })}</p>
          {record?.improved && <p className="fc-badge">{ft("match.newBest")}</p>}
          {record && !record.improved && record.best !== null && (
            <p className="fc-note">{fmt(ft("match.best"), { time: formatSeconds(record.best) })}</p>
          )}
          <div className="fc-actions">
            <button type="button" className="btn btn--primary" onClick={play}>{ft("common.playAgain")}</button>
            <Link className="btn btn--ghost" to={backTo}>{ft("common.backToDeck")}</Link>
          </div>
        </div>
      ) : (
        <div className="fc-match__grid">
          {tiles.map((t) => {
            const gone = matched.has(t.cardId);
            const isWrong = wrong?.includes(t.tileId);
            return (
              <button
                key={t.tileId}
                type="button"
                className={`fc-tile${selected === t.tileId ? " is-on" : ""}${isWrong ? " is-wrong" : ""}${gone ? " is-gone" : ""}`}
                aria-pressed={selected === t.tileId}
                aria-hidden={gone || undefined}
                tabIndex={gone ? -1 : 0}
                disabled={gone}
                onClick={() => pick(t)}
              >
                <SideView side={t.side} speak={false} />
                {gone && <Burst />}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
