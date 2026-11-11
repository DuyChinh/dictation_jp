import { Icon } from "../../shared/ui/Icon";
import { creditText, isAllowedImage } from "./cardImage";
import { useFt } from "./flashText";
import { sidesOf } from "./quiz";
import { SideView } from "./SideView";
import type { Card } from "./types";

/** One card in a list: the term, then the meaning (with its reading in front), and buttons to edit or delete it. */
export function CardRow({ card, isNew = false, onEdit, onDelete }: { card: Card; isNew?: boolean; onEdit: (c: Card) => void; onDelete: (c: Card) => void }) {
  const ft = useFt();
  const { prompt, answer } = sidesOf(card);
  return (
    <li className={`fc-row${isNew ? " is-new" : ""}${isAllowedImage(card.image) ? " has-image" : ""}`}>
      {isAllowedImage(card.image) && (
        <img className="fc-row__thumb" src={card.image.url} alt="" title={creditText(card.image)} loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable={false} />
      )}
      <SideView side={prompt} />
      <span className="fc-row__sep" aria-hidden="true">→</span>
      <SideView side={answer} speak={card.definitionLang === "ja"} />
      {isNew && <span className="fc-row__tag">{ft("create.justAdded")}</span>}
      <span className="fc-row__tools">
        <button type="button" className="icon-btn icon-btn--ghost" onClick={() => onEdit(card)} aria-label={`${ft("deck.edit")}: ${card.term}`} title={ft("deck.edit")}>
          <Icon name="pencil" size={18} />
        </button>
        <button type="button" className="icon-btn icon-btn--ghost" onClick={() => onDelete(card)} aria-label={`${ft("deck.remove")}: ${card.term}`} title={ft("deck.remove")}>
          <Icon name="trash" size={18} />
        </button>
      </span>
    </li>
  );
}
