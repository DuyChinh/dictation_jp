import { useMemo } from "react";
import { useFt } from "./flashText";
import { DEFAULT_DECK_ID, createDeck, ensureDefaultDeck, moveDeck, useFlashcards } from "./store";
import type { Deck } from "./types";

/** "Has 11 words" with the number picked out in bold and colour. */
export function DeckCount({ n, role }: { n: number; role?: "status" }) {
  const ft = useFt();
  const [before, after] = ft("select.deckCount").split("{n}");
  return (
    <p className="fc-deckpick__count" role={role}>
      {before}<strong>{n}</strong>{after}
    </p>
  );
}

/** The picker's value while "New deck…" is chosen; the deck is only made when a card is saved into it (`resolveDeck`). */
export const NEW_DECK = "__new__";

type Props = {
  decks: Deck[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  /** The name typed for a new deck, which `resolveDeck` makes when the card is saved. */
  newName: string;
  onNewName: (name: string) => void;
  /** When given, a folder box is shown: the folder for the new deck, or (for a deck that exists) the folder it is moved to. */
  folder?: string;
  onFolder?: (id: string) => void;
};

/**
 * The deck a card goes into. When there are no decks yet it offers the default one, which is only made
 * when a card is saved. "New deck…" opens a name box; there is no button to make the deck, saving the card does.
 */
export function DeckPicker({ decks, value, onChange, label, newName, onNewName, folder = "", onFolder }: Props) {
  const ft = useFt();
  const { cards, folders } = useFlashcards();
  const options = decks.length ? decks : [{ id: DEFAULT_DECK_ID, name: ft("deck.default") }];
  /** How many words the chosen deck holds now (it grows as cards are saved). */
  const count = useMemo(() => (value === NEW_DECK ? 0 : cards.filter((c) => c.deckId === value).length), [cards, value]);
  const known = value !== NEW_DECK && decks.some((d) => d.id === value);
  const current = known ? decks.find((d) => d.id === value) : undefined;
  const folderValue = value === NEW_DECK ? folder : folders.some((f) => f.id === current?.folderId) ? (current?.folderId ?? "") : "";
  const showFolder = Boolean(onFolder) && folders.length > 0 && (value === NEW_DECK || known);

  return (
    <div className="fc-deckpick">
      <label>
        <span>{label}</span>
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
          <option value={NEW_DECK}>{ft("create.newDeckOption")}</option>
        </select>
      </label>
      {known && <DeckCount n={count} role="status" />}
      {value === NEW_DECK && (
        <div className="fc-deckpick__new">
          <input
            className="fc-input"
            value={newName}
            onChange={(e) => onNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            placeholder={ft("page.deckName")}
            aria-label={ft("page.deckName")}
            maxLength={80}
            autoFocus
          />
        </div>
      )}
      {showFolder && (
        <label>
          <span>{ft("create.folder")}</span>
          <select
            value={folderValue}
            onChange={(e) => {
              if (value === NEW_DECK) onFolder?.(e.target.value);
              else moveDeck(value, e.target.value || undefined);
            }}
          >
            <option value="">{ft("create.noFolder")}</option>
            {[...folders].sort((a, b) => a.name.localeCompare(b.name)).map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

/** Whether the card still needs a name for the new deck it is going into. */
export const needsDeckName = (id: string, newName: string): boolean => id === NEW_DECK && !newName.trim();

/** The deck to save into: the chosen one, a new one made from the typed name, or the default deck if that is what was offered. */
export function resolveDeck(decks: Deck[], id: string, defaultName: string, newName = "", folderId = ""): string {
  if (id === NEW_DECK && newName.trim()) return createDeck(newName, undefined, folderId || undefined).id;
  if (decks.some((d) => d.id === id)) return id;
  return ensureDefaultDeck(defaultName).id;
}
