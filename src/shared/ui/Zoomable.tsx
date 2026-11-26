import { useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AvatarViewer } from "../../features/auth/AvatarViewer";
import { useUiLanguage } from "../i18n/UiLanguageContext";
import { Icon } from "./Icon";

type Props = {
  /** Address of the picture to show full size. */
  src: string;
  alt?: string;
  /** `corner`: the magnifier sits in the top-right corner (for pictures that are themselves clickable); default: centred. */
  corner?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

/**
 * Wraps a small picture: on hover a magnifier appears, and clicking it opens the picture full size.
 * The magnifier is a span, not a button, and its clicks never reach the parent: the picture often sits inside a
 * button (a card that turns over, a choice to pick) which must not react.
 */
export function Zoomable({ src, alt = "", corner = false, className = "", style, children }: Props) {
  const { t } = useUiLanguage();
  const [open, setOpen] = useState(false);

  const show = (e: MouseEvent | KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  return (
    <span className={`zoomable${corner ? " zoomable--corner" : ""}${className ? ` ${className}` : ""}`} style={style}>
      {children}
      <span
        className="zoomable__btn"
        role="button"
        tabIndex={0}
        aria-label={t("feedback.openImage")}
        title={t("feedback.openImage")}
        data-nolookup
        onClick={show}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") show(e);
        }}
        onPointerDown={stop}
        onMouseDown={stop}
      >
        <Icon name="zoomIn" size={16} strokeWidth={2.2} />
      </span>
      {open &&
        createPortal(
          // React events of a portal still climb the component tree: keep them away from the card or button around the picture
          <span onClick={stop} onKeyDown={stop} onPointerDown={stop} onMouseDown={stop}>
            <AvatarViewer photo open src={src} alt={alt} closeLabel={t("dict.close")} onClose={() => setOpen(false)} />
          </span>,
          document.body,
        )}
    </span>
  );
}
