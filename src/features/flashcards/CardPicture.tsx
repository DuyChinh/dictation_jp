import { useState } from "react";
import { creditText, isAllowedImage } from "./cardImage";
import type { CardImage } from "./types";

/**
 * A card's picture with its credit line, as shown with a question. The credit is plain text, not a link: the
 * picture often sits inside a button (a card that turns over), and the credit page is one tap away in the picker.
 * A picture that fails to load is simply left out.
 */
export function CardPicture({ image }: { image: CardImage }) {
  const [broken, setBroken] = useState(false);
  if (broken || !isAllowedImage(image)) return null;
  const credit = creditText(image);
  return (
    <span className="fc-side__pic">
      <img src={image.url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable={false} onError={() => setBroken(true)} />
      {credit && <small className="fc-side__credit">{credit}</small>}
    </span>
  );
}
