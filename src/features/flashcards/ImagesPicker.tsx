import { useImgText } from "./imageText";

/** Whether a card's picture is shown with the question during study, tests and games: shown, or hidden. */
export function ImagesPicker({ value, onChange }: { value: boolean; onChange: (on: boolean) => void }) {
  const it = useImgText();
  return (
    <div className="fc-dir" role="radiogroup" aria-label={it("img.toggle")}>
      <span className="fc-dir__label">{it("img.toggle")}</span>
      {[true, false].map((on) => (
        <button key={String(on)} type="button" role="radio" aria-checked={value === on} className={`fc-dir__item${value === on ? " is-on" : ""}`} onClick={() => onChange(on)}>
          {it(on ? "img.on" : "img.off")}
        </button>
      ))}
    </div>
  );
}
