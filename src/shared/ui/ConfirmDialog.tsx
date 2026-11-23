import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

type Props = {
  open: boolean;
  title: string;
  /** What will happen, in a sentence or two. */
  message: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** A destructive action gets a red button and a warning icon. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** A small modal asking before something is lost. Uses a native <dialog>: focus is trapped, Escape cancels. */
export function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, danger = false, onConfirm, onCancel }: Props) {
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
      className={`cdlg${danger ? " cdlg--danger" : ""}`}
      aria-labelledby="cdlg-title"
      aria-describedby="cdlg-body"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCancel();
      }}
    >
      {open && (
        <div className="cdlg__inner">
          <span className="cdlg__icon" aria-hidden="true">
            <Icon name={danger ? "trash" : "alert"} size={24} />
          </span>
          <h2 id="cdlg-title" className="cdlg__title">{title}</h2>
          <p id="cdlg-body" className="cdlg__body">{message}</p>
          <div className="cdlg__actions">
            <button type="button" className="btn btn--outline" onClick={onCancel} autoFocus>
              {cancelLabel}
            </button>
            <button type="button" className={`btn ${danger ? "btn--danger" : "btn--primary"}`} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
