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
