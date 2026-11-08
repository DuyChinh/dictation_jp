import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { fmt } from "../../shared/i18n/format";
import { Icon } from "../../shared/ui/Icon";
import { CardEditor, type CardValue } from "./CardEditor";
import { DeckPicker, resolveDeck } from "./DeckPicker";
import { useFt } from "./flashText";
import { lastDeckId, loadRightLang, saveLastDeck } from "./prefs";
import { DEFAULT_DECK_ID, addCard, isDuplicate, useFlashcards } from "./store";
import { guessLang } from "./suggest";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import "./sync";

const MAX_CHARS = 60;
const PANEL_WIDTH = 420;
const SETTLE_MS = 200;

type Picked = { text: string; rect: DOMRect };

/**
 * Selecting a word inside `containerRef` shows a "Create flashcard" button beside it. The button opens a small
 * form with the word and its dictionary meaning already filled in, ready to save into a deck.
 */
export function SelectionFlashcard({ containerRef }: { containerRef: RefObject<HTMLElement | null> }) {
  const ft = useFt();
  const { uiLang } = useUiLanguage();
  const { decks, cards } = useFlashcards();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [open, setOpen] = useState(false);
  const [deckId, setDeckId] = useState(() => lastDeckId() ?? DEFAULT_DECK_ID);
  const [saved, setSaved] = useState<{ deckId: string; deckName: string } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // where the form sits vertically once its height is known: under the selection, or above it, but always on screen
  const [panelTop, setPanelTop] = useState<number | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setSaved(null);
    setPicked(null);
  }, []);

  // Follow the reader's selection while the form is closed.
  useEffect(() => {
    if (open) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = () => {
      const sel = window.getSelection();
      const root = containerRef.current;
      if (!sel || !root || sel.rangeCount === 0 || sel.isCollapsed) return setPicked(null);
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) return setPicked(null);
      const text = sel.toString().replace(/\s+/g, " ").trim();
      if (!text || [...text].length > MAX_CHARS) return setPicked(null);
      const rects = typeof range.getClientRects === "function" ? range.getClientRects() : null;
      const rect = rects?.length
        ? rects[rects.length - 1]!
        : typeof range.getBoundingClientRect === "function"
          ? range.getBoundingClientRect()
          : new DOMRect(0, 0, 0, 0);
      setPicked({ text, rect });
    };
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(read, SETTLE_MS);
    };
    document.addEventListener("selectionchange", later);
    window.addEventListener("scroll", later, true);
    window.addEventListener("resize", later);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", later);
      window.removeEventListener("scroll", later, true);
      window.removeEventListener("resize", later);
    };
  }, [open, containerRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) close();
    };
    window.addEventListener("keydown", onKey);
    // the press that opened the form has finished by the next tick
    const id = setTimeout(() => document.addEventListener("pointerdown", onDown), 0);
    return () => {
      clearTimeout(id);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, close]);

  const anchor = picked?.rect ?? null;
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!open || !el || !anchor) {
      setPanelTop(null);
      return;
    }
    const place = () => {
      const h = el.offsetHeight;
      const vh = window.innerHeight;
      const below = anchor.bottom + 8;
      const above = anchor.top - h - 8;
      const top = below + h <= vh - 8 ? below : above >= 8 ? above : Math.max(8, vh - h - 8);
      setPanelTop(top);
    };
    place();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, anchor, saved]);

  if (!picked) return null;

  const effectiveDeck = decks.some((d) => d.id === deckId) ? deckId : (decks[0]?.id ?? DEFAULT_DECK_ID);
  const vw = document.documentElement.clientWidth;
  const left = Math.min(Math.max(8, picked.rect.left), Math.max(8, vw - (open ? PANEL_WIDTH : 190) - 8));
  const top = picked.rect.bottom + 8;

  function save(v: CardValue): string | void {
    const target = resolveDeck(decks, effectiveDeck, ft("deck.default"));
    if (isDuplicate(cards, target, v.term, v.definition)) return ft("create.duplicate");
    addCard({ deckId: target, ...v, reading: v.reading || undefined, hanViet: v.hanViet || undefined });
    saveLastDeck(target);
    setDeckId(target);
    const name = decks.find((d) => d.id === target)?.name ?? ft("deck.default");
    setSaved({ deckId: target, deckName: name });
  }

  const termLang = guessLang(picked.text);

  return createPortal(
    open ? (
      <div
        ref={panelRef}
        className="fc-selpanel"
        role="dialog"
        aria-label={ft("select.title")}
        data-nolookup
        style={{ left, top: panelTop ?? Math.min(top, window.innerHeight - 120) }}
      >
        <button type="button" className="dict-popup__close" onClick={close} aria-label={ft("common.close")}>
          <Icon name="close" size={16} />
        </button>
        {saved ? (
          <div className="fc-selpanel__done" role="status">
            <p><Icon name="check" size={18} /> {fmt(ft("select.saved"), { deck: saved.deckName })}</p>
            <div className="fc-actions">
              <Link className="btn btn--soft btn--sm" to={`/flashcards/${saved.deckId}`} onClick={close}>{ft("select.open")}</Link>
              <button type="button" className="btn btn--ghost btn--sm" onClick={close}>{ft("common.close")}</button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="fc-selpanel__title">{ft("select.title")}</h2>
            <DeckPicker decks={decks} value={effectiveDeck} onChange={setDeckId} label={ft("select.deck")} />
            <CardEditor
              compact
              initial={{
                term: picked.text,
                termLang,
                definitionLang: termLang === "ja" ? loadRightLang(uiLang) : "ja",
              }}
              submitLabel={ft("common.save")}
              onSubmit={save}
              onCancel={close}
            />
          </>
        )}
      </div>
    ) : (
      <button
        ref={buttonRef}
        type="button"
        className="fc-selbtn"
        data-nolookup
        style={{ left, top }}
        // keep the text selected while the button is pressed
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen(true)}
      >
        <Icon name="card" size={16} /> {ft("select.button")}
      </button>
    ),
    document.body,
  );
}
