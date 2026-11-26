import { useEffect, useRef } from "react";
import { Icon } from "../../shared/ui/Icon";

type Props = {
  open: boolean;
  /** The picture to show, already a usable image source. */
  src: string;
  alt: string;
  closeLabel: string;
  onClose: () => void;
  /** A photo at its own shape (not the square profile frame), loaded without a referrer like the other card pictures. */
  photo?: boolean;
};

/** The profile picture at a larger size. A native <dialog>: Escape closes it, and so does a click outside the picture. */
export function AvatarViewer({ open, src, alt, closeLabel, onClose, photo = false }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      if (typeof el.showModal === "function") el.showModal();
      else el.setAttribute("open", "");
    }
    if (!open && el.open) {
      if (typeof el.close === "function") el.close();
      else el.removeAttribute("open");
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="avatar-viewer"
      aria-label={alt}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // the dialog box itself is the backdrop area around the picture
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="avatar-viewer__inner" onClick={(e) => e.target === e.currentTarget && onClose()}>
          <img src={src} alt={alt} className={`avatar-viewer__img${photo ? " avatar-viewer__img--photo" : ""}`} referrerPolicy={photo ? "no-referrer" : undefined} />
          <button type="button" className="avatar-viewer__close" onClick={onClose} aria-label={closeLabel} autoFocus>
            <Icon name="close" size={20} strokeWidth={2.4} />
          </button>
        </div>
      )}
    </dialog>
  );
}
