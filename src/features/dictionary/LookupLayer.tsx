import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { lookupWord, type LookupResult } from "../../shared/api/dictionary";
import { fmt } from "../../shared/i18n/format";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { Icon } from "../../shared/ui/Icon";
import { EntryCard, headwordOf } from "./EntryCard";
import { KanjiCard } from "./KanjiCard";
import { reasonLabel } from "./dictLabels";
import { caretAt, clickContext, rangeForMatch } from "./textContext";

type Popup = {
  rect: DOMRect;
  status: "loading" | "done" | "error";
  result: LookupResult | null;
};

const HIGHLIGHT = "dict-hit";
const INTERACTIVE = "button, a, input, textarea, select, label, summary, [role='radio'], [data-nolookup]";
const POPUP_WIDTH = 360;
const MAX_ENTRIES_IN_POPUP = 3;

type HighlightRegistry = { set(name: string, value: unknown): void; delete(name: string): void };
const highlights = (): HighlightRegistry | null =>
  (globalThis.CSS as unknown as { highlights?: HighlightRegistry } | undefined)?.highlights ?? null;

/**
 * Makes Japanese text inside it clickable: a click looks up the word under the cursor and shows its
 * meaning in a popup beside it. Text the learner selects, and buttons or links, are left alone.
 */
export function LookupLayer({ children, className }: { children: ReactNode; className?: string }) {
  const { t, uiLang } = useUiLanguage();
  const [popup, setPopup] = useState<Popup | null>(null);
  const latest = useRef(0);

  const close = useCallback(() => {
    latest.current++;
    setPopup(null);
    highlights()?.delete(HIGHLIGHT);
  }, []);

  useEffect(() => {
    if (!popup) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onScroll = () => close();
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [popup, close]);
  useEffect(() => close, [close]);

  async function onClick(e: MouseEvent<HTMLDivElement>) {
    const target = e.target as Element;
    if (target.closest(INTERACTIVE)) return;
    if (window.getSelection()?.toString().trim()) return;
    const caret = caretAt(e.clientX, e.clientY);
    if (!caret || caret.node.nodeType !== Node.TEXT_NODE) return close();
    const ctx = clickContext(caret.node as Text, caret.offset);
    if (!ctx) return close();

    const ticket = ++latest.current;
    const near = new DOMRect(e.clientX, e.clientY, 0, 0);
    setPopup({ rect: near, status: "loading", result: null });
    try {
      const result = await lookupWord(ctx.text, ctx.offset);
      if (ticket !== latest.current) return;
      let rect = near;
      if (result) {
        const range = rangeForMatch(ctx, result.start, result.length);
        if (range) {
          if (typeof range.getBoundingClientRect === "function") rect = range.getBoundingClientRect();
          highlights()?.set(HIGHLIGHT, new (globalThis as unknown as { Highlight: new (r: Range) => unknown }).Highlight(range));
        }
      }
      setPopup({ rect, status: "done", result });
    } catch {
      if (ticket === latest.current) setPopup({ rect: near, status: "error", result: null });
    }
  }

  return (
    <div className={className} onClick={onClick}>
      {children}
      {popup && createPortal(<LookupPopup popup={popup} onClose={close} t={t} uiLang={uiLang} />, document.body)}
    </div>
  );
}

function LookupPopup({
  popup,
  onClose,
  t,
  uiLang,
}: {
  popup: Popup;
  onClose: () => void;
  t: ReturnType<typeof useUiLanguage>["t"];
  uiLang: ReturnType<typeof useUiLanguage>["uiLang"];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const { rect, status, result } = popup;

  // Below the word when there is room, above it otherwise; kept inside the viewport.
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const h = box.offsetHeight;
    const left = Math.min(Math.max(8, rect.left), Math.max(8, vw - POPUP_WIDTH - 8));
    const below = rect.bottom + 8;
    const top = below + h <= vh - 8 ? below : Math.max(8, rect.top - h - 8);
    setPos({ left, top });
  }, [rect, status, result]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    // the click that opened the popup has finished by the next tick
    const id = setTimeout(() => document.addEventListener("pointerdown", onDown), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  const entries = result?.entries ?? [];
  const head = entries[0] ? headwordOf(entries[0]).word : (result?.matched ?? "");

  return (
    <div
      ref={ref}
      className="dict-popup"
      role="dialog"
      aria-label={result?.matched ?? t("nav.dictionary")}
      style={{ left: pos?.left ?? rect.left, top: pos?.top ?? rect.bottom + 8, visibility: pos ? "visible" : "hidden" }}
    >
      <button type="button" className="dict-popup__close" onClick={onClose} aria-label={t("dict.close")}>
        <Icon name="close" size={16} />
      </button>
      {status === "loading" && <p className="dict-popup__state">{t("dict.loading")}</p>}
      {status === "error" && <p className="dict-popup__state">{t("dict.error")}</p>}
      {status === "done" && !result && <p className="dict-popup__state">{t("dict.nothingFound")}</p>}
      {status === "done" && result && (
        <>
          {result.reasons.length > 0 && (
            <p className="dict-popup__reason">
              <span className="jp" lang="ja">{result.matched}</span>{" "}
              {fmt(t("dict.reason"), { forms: result.reasons.map((r) => reasonLabel(r, uiLang)).join(" → ") })}
            </p>
          )}
          {entries.slice(0, MAX_ENTRIES_IN_POPUP).map((entry) => (
            <EntryCard key={entry.id} entry={entry} compact />
          ))}
          {entries.length > MAX_ENTRIES_IN_POPUP && (
            <p className="dict-popup__more">{fmt(t("dict.more"), { n: entries.length - MAX_ENTRIES_IN_POPUP })}</p>
          )}
          {result.kanji.length > 0 && (
            <div className="dict-popup__kanji">
              {result.kanji.slice(0, 4).map((k) => (
                <KanjiCard key={k.char} kanji={k} compact />
              ))}
            </div>
          )}
          <Link className="dict-popup__open" to={`/dictionary?q=${encodeURIComponent(head)}&lang=ja`} onClick={onClose}>
            {t("dict.openFull")}
            <Icon name="search" size={14} />
          </Link>
        </>
      )}
    </div>
  );
}
