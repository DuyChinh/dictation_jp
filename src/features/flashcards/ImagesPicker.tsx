import { useImgText } from "./imageText";
import type { ImageSide } from "./prefs";

const SIDES: ImageSide[] = ["definition", "term"];

/**
 * Whether a card's picture is shown during study, tests and games (shown or hidden), and, while shown, which side
 * of the card it goes with: the meaning or the word.
 */
export function ImagesPicker({ value, onChange, side, onSide }: { value: boolean; onChange: (on: boolean) => void; side?: ImageSide; onSide?: (side: ImageSide) => void }) {
  const it = useImgText();
  return (
    <>
      <div className="fc-dir" role="radiogroup" aria-label={it("img.toggle")}>
        <span className="fc-dir__label">{it("img.toggle")}</span>
        {[true, false].map((on) => (
          <button key={String(on)} type="button" role="radio" aria-checked={value === on} className={`fc-dir__item${value === on ? " is-on" : ""}`} onClick={() => onChange(on)}>
            {it(on ? "img.on" : "img.off")}
          </button>
        ))}
      </div>
      {value && side && onSide && (
        <div className="fc-dir" role="radiogroup" aria-label={it("img.side")}>
          <span className="fc-dir__label">{it("img.side")}</span>
          {SIDES.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={side === s} className={`fc-dir__item${side === s ? " is-on" : ""}`} onClick={() => onSide(s)}>
              {it(`img.side.${s}`)}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
