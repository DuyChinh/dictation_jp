import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { Icon } from "../../shared/ui/Icon";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** "drawer" slides in from the right, for read-mostly detail. */
  variant?: "dialog" | "drawer";
  wide?: boolean;
};

/** A native <dialog>: focus is trapped and Escape closes it without extra code. */
export function Modal({ open, title, onClose, children, footer, variant = "dialog", wide }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`adm-modal adm-modal--${variant}${wide ? " adm-modal--wide" : ""}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="adm-modal__inner">
          <header className="adm-modal__head">
            <h2>{title}</h2>
            <button type="button" className="icon-btn icon-btn--ghost" onClick={onClose} aria-label="Đóng">
              <Icon name="close" />
            </button>
          </header>
          <div className="adm-modal__body">{children}</div>
          {footer && <footer className="adm-modal__foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

type FormDialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
  children: ReactNode;
};

/** A modal holding a form, with Cancel / Save in the footer and the error above the fields. */
export function FormDialog({ open, title, onClose, onSubmit, submitLabel, busy, error, children }: FormDialogProps) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void onSubmit();
  };
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <form className="adm-form" onSubmit={submit}>
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
        {children}
        <div className="adm-form__actions">
          <button type="button" className="btn btn--outline" onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? "Đang lưu…" : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** A labelled form row; `hint` sits under the control. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="adm-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <span className="adm-field__hint">{hint}</span>}
    </div>
  );
}
