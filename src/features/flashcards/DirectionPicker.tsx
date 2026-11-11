import { useFt } from "./flashText";
import type { Direction } from "./types";

const OPTIONS: Direction[] = ["term", "definition", "mixed"];

/** Which side of a card is asked: the term, the definition or either. */
export function DirectionPicker({ value, onChange }: { value: Direction; onChange: (d: Direction) => void }) {
  const ft = useFt();
  return (
    <div className="fc-dir" role="radiogroup" aria-label={ft("deck.direction")}>
      <span className="fc-dir__label">{ft("deck.direction")}</span>
      {OPTIONS.map((d) => (
        <button key={d} type="button" role="radio" aria-checked={value === d} className={`fc-dir__item${value === d ? " is-on" : ""}`} onClick={() => onChange(d)}>
          {ft(`dir.${d}`)}
        </button>
      ))}
    </div>
  );
}

/** Whether meanings end with their Sino-Vietnamese reading: with it, or without it. */
export function HanVietPicker({ value, onChange }: { value: boolean; onChange: (on: boolean) => void }) {
  const ft = useFt();
  return (
    <div className="fc-dir" role="radiogroup" aria-label={ft("deck.hanViet")}>
      <span className="fc-dir__label">{ft("deck.hanViet")}</span>
      {[true, false].map((on) => (
        <button key={String(on)} type="button" role="radio" aria-checked={value === on} className={`fc-dir__item${value === on ? " is-on" : ""}`} onClick={() => onChange(on)}>
          {ft(on ? "deck.hanViet.on" : "deck.hanViet.off")}
        </button>
      ))}
    </div>
  );
}

/** Whether Japanese readings appear before meanings during study, tests and games. */
export function HiraganaPicker({ value, onChange }: { value: boolean; onChange: (on: boolean) => void }) {
  const ft = useFt();
  return (
    <div className="fc-dir" role="radiogroup" aria-label={ft("deck.hiragana")}>
      <span className="fc-dir__label">{ft("deck.hiragana")}</span>
      {[true, false].map((on) => (
        <button key={String(on)} type="button" role="radio" aria-checked={value === on} className={`fc-dir__item${value === on ? " is-on" : ""}`} onClick={() => onChange(on)}>
          {ft(on ? "deck.hiragana.on" : "deck.hiragana.off")}
        </button>
      ))}
    </div>
  );
}
