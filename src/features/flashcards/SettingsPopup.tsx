import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "../../shared/ui/Icon";
import { useFt } from "./flashText";

/**
 * A settings icon that opens the study options (which side is asked, Sino-Vietnamese reading, pictures…) in a popup,
 * so they do not take room on the page. On a phone the popup is a sheet from the bottom edge.
 */
export function SettingsPopup({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ft = useFt();
  const [open, setOpen] = useState(false);
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
    <>
      <button type="button" className={`fc-gear${className ? ` ${className}` : ""}`} onClick={() => setOpen(true)} aria-label={ft("settings.open")} title={ft("settings.open")} aria-haspopup="dialog">
        <Icon name="sliders" size={20} />
      </button>
      <dialog
        ref={ref}
        className="fc-sheet"
        aria-label={ft("settings.title")}
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        onClick={(e) => {
          if (e.target === ref.current) setOpen(false);
        }}
      >
        {open && (
          <div className="fc-sheet__inner">
            <header className="fc-sheet__head">
              <h2>{ft("settings.title")}</h2>
              <button type="button" className="icon-btn icon-btn--ghost" onClick={() => setOpen(false)} aria-label={ft("common.cancel")}>
                <Icon name="close" />
              </button>
            </header>
            <div className="fc-sheet__body">{children}</div>
            <footer className="fc-sheet__foot">
              <button type="button" className="btn btn--primary btn--block" onClick={() => setOpen(false)}>{ft("settings.done")}</button>
            </footer>
          </div>
        )}
      </dialog>
    </>
  );
}
