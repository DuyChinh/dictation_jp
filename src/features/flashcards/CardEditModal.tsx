import { useEffect } from "react";
import { CardEditor, type CardValue } from "./CardEditor";
import { useFt } from "./flashText";
import { updateCard } from "./store";
import type { Card } from "./types";

/** A card in a box over the page: change it and save, or cancel (Escape also closes it). */
export function CardEditModal({ card, onClose }: { card: Card; onClose: () => void }) {
  const ft = useFt();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function save(v: CardValue): void {
    updateCard(card.id, { term: v.term, termLang: v.termLang, definition: v.definition, definitionLang: v.definitionLang, reading: v.reading, hanViet: v.hanViet, entryId: v.entryId });
    onClose();
  }

  return (
    <div className="fc-modal" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fc-modal__box" role="dialog" aria-modal="true" aria-label={ft("deck.edit")}>
        <h2>{ft("deck.edit")}</h2>
        <CardEditor
          initial={{ term: card.term, termLang: card.termLang, definition: card.definition, definitionLang: card.definitionLang, reading: card.reading, hanViet: card.hanViet, entryId: card.entryId }}
          submitLabel={ft("common.save")}
          onSubmit={save}
          onCancel={onClose}
          compact
        />
      </div>
    </div>
  );
}
