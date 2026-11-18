import { useImgText } from "./imageText";
import type { ImageSide } from "./prefs";

type Choice = ImageSide | "hide";
const CHOICES: Choice[] = ["front", "back", "hide"];

/** Where a card's picture goes during study, tests and games: on the front, on the back, or hidden. */
export function ImagesPicker({ value, onChange, side, onSide }: { value: boolean; onChange: (on: boolean) => void; side: ImageSide; onSide: (side: ImageSide) => void }) {
  const it = useImgText();
  const current: Choice = value ? side : "hide";
  function pick(c: Choice) {
    if (c === "hide") {
      onChange(false);
      return;
    }
    onSide(c);
    onChange(true);
  }
  return (
    <div className="fc-dir" role="radiogroup" aria-label={it("img.toggle")}>
      <span className="fc-dir__label">{it("img.toggle")}</span>
      {CHOICES.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={current === c} className={`fc-dir__item${current === c ? " is-on" : ""}`} onClick={() => pick(c)}>
          {it(c === "hide" ? "img.off" : `img.${c}`)}
        </button>
      ))}
    </div>
  );
}
