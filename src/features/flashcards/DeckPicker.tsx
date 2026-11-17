import { useFt } from "./flashText";
import { DEFAULT_DECK_ID, createDeck, ensureDefaultDeck } from "./store";
import type { Deck } from "./types";

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
};

/**
 * The deck a card goes into. When there are no decks yet it offers the default one, which is only made
 * when a card is saved. "New deck…" opens a name box; there is no button to make the deck, saving the card does.
 */
export function DeckPicker({ decks, value, onChange, label, newName, onNewName }: Props) {
  const ft = useFt();
  const options = decks.length ? decks : [{ id: DEFAULT_DECK_ID, name: ft("deck.default") }];

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
    </div>
  );
}

/** Whether the card still needs a name for the new deck it is going into. */
export const needsDeckName = (id: string, newName: string): boolean => id === NEW_DECK && !newName.trim();

/** The deck to save into: the chosen one, a new one made from the typed name, or the default deck if that is what was offered. */
export function resolveDeck(decks: Deck[], id: string, defaultName: string, newName = ""): string {
  if (id === NEW_DECK && newName.trim()) return createDeck(newName).id;
  if (decks.some((d) => d.id === id)) return id;
  return ensureDefaultDeck(defaultName).id;
}
