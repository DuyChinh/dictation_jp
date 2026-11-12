import { useState } from "react";
import type { DictEntry } from "../../shared/api/dictionary";
import type { ImageHit } from "../../shared/api/images";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { Icon } from "../../shared/ui/Icon";
import { imageKeywordsFromEntry, imageQueryFrom, toCardImage } from "./cardImage";
import { placeEntry, targetDeckId } from "./entryCard";
import { useFt } from "./flashText";
import { ImagePicker } from "./ImagePicker";
import { useImgText } from "./imageText";
import { updateCard, useFlashcards } from "./store";
import { suggestionFromEntry } from "./suggest";
import type { CardLang } from "./types";
import "./sync";

/**
 * Next to the "add to flashcards" button of a dictionary entry: opens a box of pictures for the word (searched
 * by its English meaning). Picking one puts the word into the flashcards with that picture, or gives the card
 * it already has the picture.
 */
export function EntryImageButton({ entry, meaning }: { entry: DictEntry; meaning: "both" | "vi" | "en" }) {
  const it = useImgText();
  const ft = useFt();
  const { uiLang } = useUiLanguage();
  const { decks, cards } = useFlashcards();
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  const lang: CardLang = meaning === "both" ? (uiLang === "vi" ? "vi" : "en") : meaning;
  const targetId = targetDeckId(decks);
  const card = cards.find((c) => c.entryId === entry.id && c.deckId === targetId);
  const suggestion = suggestionFromEntry(entry);

  function pick(hit: ImageHit) {
    const placed = placeEntry({ entry, lang, decks, cards, targetId, defaultDeckName: ft("deck.default"), image: toCardImage(hit) });
    setOpen(false);
    if (placed) setSaid(placed.status === "added" ? it("img.entryAdded", { deck: placed.deckName }) : it("img.entryAttached"));
  }

  const label = said ?? (card?.image ? it("img.entryDone") : it("img.entry"));
  return (
    <>
      <button type="button" className={`fc-add fc-add--image${card?.image || said ? " is-done" : ""}`} onClick={() => setOpen(true)} aria-label={label} title={label} aria-haspopup="dialog">
        <Icon name="image" size={16} />
      </button>
      {open && (
        <ImagePicker
          initialQuery={imageQueryFrom(suggestion.en)}
          word={suggestion.ja}
          suggestions={imageKeywordsFromEntry(entry)}
          current={card?.image}
          onPick={pick}
          onRemove={
            card?.image
              ? () => {
                  updateCard(card.id, { image: undefined });
                  setSaid(null);
                  setOpen(false);
                }
              : undefined
          }
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
