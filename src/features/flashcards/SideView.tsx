import { Furigana } from "../../shared/ui/Furigana";
import { SpeakButton } from "../../shared/ui/SpeakButton";
import { furiganaSegments } from "../../shared/utils/furigana";
import { CardPicture } from "./CardPicture";
import { useShowHanViet, useShowHiragana, useShowImages } from "./prefs";
import type { Side } from "./types";

/**
 * One side of a card: the text, with a speaker beside a Japanese word. The reading goes above a Japanese word
 * (unless the side says not to) or in front of the text as "こうにゅう: mua".
 */
export function SideView({ side, big = false, speak = true }: { side: Side; big?: boolean; speak?: boolean }) {
  const [hanViet] = useShowHanViet();
  const [hiragana] = useShowHiragana();
  const [images] = useShowImages();
  const ja = side.lang === "ja";
  const showReading = ja && side.reading && side.reading !== side.text && side.showReading !== false;
  // The reading sits right above the kanji it belongs to (not above the okurigana); a word with no kanji keeps the line above.
  const withRuby = Boolean(showReading) && furiganaSegments(side.text, side.reading) !== null;
  return (
    <span className={`fc-side${big ? " fc-side--big" : ""}${ja ? " jp" : ""}`} lang={ja ? "ja" : side.lang}>
      {big && images && side.image && <CardPicture image={side.image} />}
      {showReading && !withRuby && <span className="fc-side__reading">{side.reading}</span>}
      <span className={`fc-side__text${withRuby ? " fc-side__text--ruby" : ""}`}>
        {side.lead && hiragana && (
          <>
            <span className="fc-side__lead jp" lang="ja">{side.lead}</span>
            <span className="fc-side__colon">: </span>
          </>
        )}
        {withRuby ? <Furigana word={side.text} reading={side.reading} /> : side.text}
      </span>
      {side.trail && hanViet && <span className="fc-side__trail" title="Âm Hán Việt">{side.trail}</span>}
      {ja && speak && <SpeakButton text={side.reading || side.text} />}
    </span>
  );
}
