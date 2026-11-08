import { SpeakButton } from "../../shared/ui/SpeakButton";
import type { Side } from "./types";

/** One side of a card: the text, with the reading above a Japanese word that has one and a speaker beside it. */
export function SideView({ side, big = false, speak = true }: { side: Side; big?: boolean; speak?: boolean }) {
  const ja = side.lang === "ja";
  const showReading = ja && side.reading && side.reading !== side.text;
  return (
    <span className={`fc-side${big ? " fc-side--big" : ""}${ja ? " jp" : ""}`} lang={ja ? "ja" : side.lang}>
      {showReading && <span className="fc-side__reading">{side.reading}</span>}
      <span className="fc-side__text">{side.text}</span>
      {ja && speak && <SpeakButton text={side.reading || side.text} />}
    </span>
  );
}
