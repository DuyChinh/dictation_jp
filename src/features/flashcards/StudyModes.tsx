import { BlitzMode } from "./BlitzMode";
import { DirectionPicker, HanVietPicker, HiraganaPicker } from "./DirectionPicker";
import { DropMode } from "./DropMode";
import { ImagesPicker } from "./ImagesPicker";
import { LearnMode } from "./LearnMode";
import { MatchMode } from "./MatchMode";
import { MemoryMode } from "./MemoryMode";
import { MinerMode } from "./MinerMode";
import { MillionaireMode } from "./MillionaireMode";
import { TestMode } from "./TestMode";
import { BackToContext } from "./StudyContext";
import type { ModeId } from "./modes";
import { useDirection, useShowHanViet, useShowHiragana, useShowImages } from "./prefs";
import type { Card } from "./types";

/**
 * One way of studying `cards`, with the pickers for which side is asked and the Sino-Vietnamese reading.
 * `deckId` keys the saved place and best scores; `backTo` is where "back to the deck" goes.
 */
export function StudyModes({ deckId, cards, mode, backTo }: { deckId: string; cards: Card[]; mode: ModeId; backTo?: string }) {
  const [direction, setDirection] = useDirection();
  const [hanViet, setHanViet] = useShowHanViet();
  const [hiragana, setHiragana] = useShowHiragana();
  const [images, setImages] = useShowImages();
  // a fresh start when the deck or the asked side changes
  const key = `${deckId}:${direction}`;
  const props = { key, deckId, cards, direction };
  return (
    <BackToContext.Provider value={backTo ?? null}>
      <div className="fc-pickers">
        <DirectionPicker value={direction} onChange={setDirection} />
        <HanVietPicker value={hanViet} onChange={setHanViet} />
        <HiraganaPicker value={hiragana} onChange={setHiragana} />
        <ImagesPicker value={images} onChange={setImages} />
      </div>
      {mode === "learn" && <LearnMode {...props} />}
      {mode === "test" && <TestMode {...props} />}
      {mode === "match" && <MatchMode {...props} />}
      {mode === "memory" && <MemoryMode {...props} />}
      {mode === "blitz" && <BlitzMode {...props} />}
      {mode === "millionaire" && <MillionaireMode {...props} />}
      {mode === "miner" && <MinerMode {...props} />}
      {mode === "drop" && <DropMode {...props} />}
    </BackToContext.Provider>
  );
}
