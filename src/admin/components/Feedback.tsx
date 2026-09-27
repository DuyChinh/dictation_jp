import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Icon } from "../../shared/ui/Icon";
import { Modal } from "./Modal";

type ConfirmOptions = {
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
};

type Toast = { id: number; text: string; kind: "ok" | "error" };

type FeedbackValue = {
  /** Resolves true when the admin confirms. */
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  toast: (text: string, kind?: Toast["kind"]) => void;
};

const FeedbackContext = createContext<FeedbackValue | undefined>(undefined);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setPending(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setPending(null);
  };

  const toast = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, text, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3500);
  }, []);

  return (
    <FeedbackContext.Provider value={{ confirm, toast }}>
      {children}
      <Modal
        open={pending !== null}
        title={pending?.title ?? ""}
        onClose={() => settle(false)}
        footer={
          <>
            <button type="button" className="btn btn--outline" onClick={() => settle(false)}>
              Huỷ
            </button>
            <button
              type="button"
              className={`btn ${pending?.danger ? "adm-btn--danger" : "btn--primary"}`}
              onClick={() => settle(true)}
              autoFocus
            >
              {pending?.confirmLabel ?? "Đồng ý"}
            </button>
          </>
        }
      >
        <div className="adm-confirm">{pending?.body}</div>
      </Modal>
      <div className="adm-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`adm-toast adm-toast--${t.kind}`}>
            <Icon name={t.kind === "ok" ? "check" : "alert"} size={18} />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used within FeedbackProvider");
  return ctx;
}
