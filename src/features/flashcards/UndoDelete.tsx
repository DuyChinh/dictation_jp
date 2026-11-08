import { useEffect, useRef, useState, type ReactElement } from "react";
import { fmt } from "../../shared/i18n/format";
import { useFt } from "./flashText";
import { deleteCard, restoreCard } from "./store";
import type { Card } from "./types";

const SHOW_MS = 7000;

/** Deleting a card can be taken back for a few seconds: `remove` deletes, `bar` offers the undo. */
export function useUndoDelete(): { remove: (c: Card) => void; bar: ReactElement | null } {
  const ft = useFt();
  const [last, setLast] = useState<Card | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function remove(card: Card) {
    deleteCard(card.id);
    setLast(card);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setLast(null), SHOW_MS);
  }

  const bar = last ? (
    <div className="fc-undo" role="status">
      <span>{fmt(ft("undo.deleted"), { term: last.term })}</span>
      <button
        type="button"
        className="btn btn--soft btn--sm"
        onClick={() => {
          restoreCard(last.id);
          setLast(null);
        }}
      >
        {ft("undo.undo")}
      </button>
    </div>
  ) : null;
  return { remove, bar };
}
