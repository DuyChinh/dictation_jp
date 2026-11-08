import { useState } from "react";
import type { DictEntry } from "../../shared/api/dictionary";
import { fmt } from "../../shared/i18n/format";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { Icon } from "../../shared/ui/Icon";
import { useFt } from "./flashText";
import { lastDeckId, saveLastDeck } from "./prefs";
import { DEFAULT_DECK_ID, addCard, ensureDefaultDeck, isDuplicate, useFlashcards } from "./store";
import { suggestionFromEntry, textFor } from "./suggest";
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
  const remembered = lastDeckId();
  const targetId = decks.some((d) => d.id === remembered) ? remembered! : (decks[0]?.id ?? DEFAULT_DECK_ID);
  const already = cards.some((c) => c.entryId === entry.id && c.deckId === targetId);

  function add() {
    const s = suggestionFromEntry(entry);
    const definition = textFor(s, lang);
    if (!s.ja || !definition) return;
    const deck = decks.find((d) => d.id === targetId) ?? ensureDefaultDeck(ft("deck.default"));
    if (isDuplicate(cards, deck.id, s.ja, definition) || cards.some((c) => c.entryId === entry.id && c.deckId === deck.id)) {
      setResult("exists");
      setDeckName(deck.name);
      return;
    }
    addCard({ deckId: deck.id, term: s.ja, termLang: "ja", definition, definitionLang: lang, reading: s.reading, entryId: entry.id });
    saveLastDeck(deck.id);
    setDeckName(deck.name);
    setResult("added");
  }

  const done = result === "added" || already;
  const label = result === "added" ? fmt(ft("entry.addedTo"), { deck: deckName }) : done ? ft("entry.added") : result === "exists" ? ft("entry.exists") : ft("entry.add");
  return (
    <button type="button" className={`fc-add${done ? " is-done" : ""}`} onClick={add} disabled={done} aria-label={label} title={label}>
      <Icon name={done ? "check" : "card"} size={16} />
    </button>
  );
}
