import { useState } from "react";
import type { DictEntry } from "../../shared/api/dictionary";
import { fmt } from "../../shared/i18n/format";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { Icon } from "../../shared/ui/Icon";
import { useFt } from "./flashText";
import { placeEntry, targetDeckId } from "./entryCard";
import { useFlashcards } from "./store";
import type { CardLang } from "./types";
import "./sync";

/** One tap to put a dictionary entry into the flashcards: Japanese word and reading, with the meaning in the reader's language. */
export function AddEntryButton({ entry, meaning }: { entry: DictEntry; meaning: "both" | "vi" | "en" }) {
  const ft = useFt();
  const { uiLang } = useUiLanguage();
  const { decks, cards } = useFlashcards();
  const [result, setResult] = useState<"added" | "exists" | null>(null);
  const [deckName, setDeckName] = useState("");

  const lang: CardLang = meaning === "both" ? (uiLang === "vi" ? "vi" : "en") : meaning;
  const targetId = targetDeckId(decks);
  const already = cards.some((c) => c.entryId === entry.id && c.deckId === targetId);

  function add() {
    const placed = placeEntry({ entry, lang, decks, cards, targetId, defaultDeckName: ft("deck.default") });
    if (!placed) return;
    setResult(placed.status === "added" ? "added" : "exists");
    setDeckName(placed.deckName);
  }

  const done = result === "added" || already;
  const label = result === "added" ? fmt(ft("entry.addedTo"), { deck: deckName }) : done ? ft("entry.added") : result === "exists" ? ft("entry.exists") : ft("entry.add");
  return (
    <button type="button" className={`fc-add${done ? " is-done" : ""}`} onClick={add} disabled={done} aria-label={label} title={label}>
      <Icon name={done ? "check" : "card"} size={16} />
    </button>
  );
}
