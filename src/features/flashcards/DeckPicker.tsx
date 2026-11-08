import { useState } from "react";
import { useFt } from "./flashText";
import { DEFAULT_DECK_ID, createDeck, ensureDefaultDeck } from "./store";
import type { Deck } from "./types";

const NEW = "__new__";

/**
 * The deck a card goes into. When there are no decks yet it offers the default one, which is only made
 * when a card is saved (`resolveDeck`). "New deck…" opens a name box.
 */
export function DeckPicker({ decks, value, onChange, label }: { decks: Deck[]; value: string; onChange: (id: string) => void; label: string }) {
  const ft = useFt();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const options = decks.length ? decks : [{ id: DEFAULT_DECK_ID, name: ft("deck.default") }];

  function make() {
    if (!name.trim()) return;
    onChange(createDeck(name).id);
    setName("");
    setNaming(false);
  }

  return (
    <div className="fc-deckpick">
      <label>
        <span>{label}</span>
        <select
          value={naming ? NEW : value}
          onChange={(e) => {
            if (e.target.value === NEW) setNaming(true);
            else {
              setNaming(false);
              onChange(e.target.value);
            }
          }}
        >
          {options.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
          <option value={NEW}>{ft("create.newDeckOption")}</option>
        </select>
      </label>
      {naming && (
        <div className="fc-deckpick__new">
          <input
            className="fc-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                make();
              }
            }}
            placeholder={ft("page.deckName")}
            aria-label={ft("page.deckName")}
            maxLength={80}
            autoFocus
          />
          <button type="button" className="btn btn--soft btn--sm" onClick={make} disabled={!name.trim()}>{ft("page.createDeck")}</button>
        </div>
      )}
    </div>
  );
}

/** The deck to save into: the chosen one, making the default deck first if that is what was offered. */
export function resolveDeck(decks: Deck[], id: string, defaultName: string): string {
  if (decks.some((d) => d.id === id)) return id;
  return ensureDefaultDeck(defaultName).id;
}
