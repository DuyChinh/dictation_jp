import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CardEditModal } from "../features/flashcards/CardEditModal";
import { CardEditor, type CardValue } from "../features/flashcards/CardEditor";
import { CardRow } from "../features/flashcards/CardRow";
import { DeckPicker, resolveDeck } from "../features/flashcards/DeckPicker";
import { useFt } from "../features/flashcards/flashText";
import { lastDeckId, saveLastDeck } from "../features/flashcards/prefs";
import { DEFAULT_DECK_ID, addCard, cardsOf, isDuplicate, liveCards, liveDecks, readState, useFlashcards } from "../features/flashcards/store";
import { syncFlashcards } from "../features/flashcards/sync";
import { useUndoDelete } from "../features/flashcards/UndoDelete";
import type { Card } from "../features/flashcards/types";
import { fmt } from "../shared/i18n/format";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";

const LIST_MAX = 40;

export function FlashcardCreatePage() {
  const { t } = useUiLanguage();
  const ft = useFt();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { decks, state } = useFlashcards();
  const [deckId, setDeckId] = useState(() => params.get("deck") ?? lastDeckId() ?? DEFAULT_DECK_ID);
  // cards made on this visit, to point out in the list
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Card | null>(null);
  const { remove, bar } = useUndoDelete();

  useEffect(() => {
    void syncFlashcards();
  }, []);

  // A remembered deck may be gone; fall back to the first one that exists.
  const effective = decks.some((d) => d.id === deckId) ? deckId : (decks[0]?.id ?? DEFAULT_DECK_ID);
  const deck = decks.find((d) => d.id === effective);
  const deckCards = useMemo(() => cardsOf(state, effective).sort((a, b) => b.createdAt - a.createdAt), [state, effective]);

  /** Adds a card to the chosen deck (making the default deck if there is none). A repeat of a card already there is skipped. */
  function put(v: CardValue): Card | null {
    const current = readState();
    const target = resolveDeck(liveDecks(current), deckRef.current, nameRef.current);
    if (isDuplicate(liveCards(readState()), target, v.term, v.definition)) return null;
    const card = addCard({ deckId: target, ...v, reading: v.reading || undefined, hanViet: v.hanViet || undefined });
    saveLastDeck(target);
    return card;
  }

  function save(v: CardValue): string | void {
    const card = put(v);
    if (!card) return ft("create.duplicate");
    setDeckId(card.deckId);
    setAdded((a) => new Set(a).add(card.id));
  }

  // What is typed but not yet added is kept, so leaving the page by any route (the buttons, the browser's back,
  // another menu item, closing the tab) still saves it.
  const draft = useRef<CardValue | null>(null);
  const deckRef = useRef(effective);
  const nameRef = useRef(ft("deck.default"));
  deckRef.current = effective;
  nameRef.current = ft("deck.default");
  const flush = useCallback(() => {
    const v = draft.current;
    if (!v) return;
    draft.current = null;
    put(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  /** Back to the page before this one (or to the deck when this page was opened directly). */
  function goBack() {
    flush();
    if (location.key !== "default") navigate(-1);
    else navigate(deck ? `/flashcards/${deck.id}` : "/flashcards");
  }

  const bar2 = (
    <div className="fc-actions fc-createbar">
      <button type="button" className="btn btn--outline" onClick={goBack}>
        <Icon name="chevronLeft" size={18} /> {ft("create.back")}
      </button>
      <button type="button" className="btn btn--primary" onClick={goBack}>
        <Icon name="check" size={18} /> {ft("create.save")}
      </button>
    </div>
  );

  return (
    <AppShell
      breadcrumbs={[
        { label: t("nav.flashcards"), to: "/flashcards" },
        { label: ft("create.title") },
      ]}
    >
      <section className="fc-page fc-page--narrow">
        <header className="fc-page__head">
          <div>
            <h1>{ft("create.title")}</h1>
            <p>{ft("create.sub")}</p>
          </div>
          {bar2}
        </header>

        <div className="fc-panel">
          <DeckPicker
            decks={decks}
            value={effective}
            onChange={(id) => {
              setDeckId(id);
              saveLastDeck(id);
            }}
            label={ft("create.deck")}
          />
          <CardEditor submitLabel={ft("create.add")} onSubmit={save} onDraft={(d) => (draft.current = d)} clearAfterSubmit autoFocus />
          <p className="fc-note">{ft("create.autosave")}</p>
        </div>

        <div className="fc-added">
          <div className="fc-listhead">
            <h2 className="fc-section">{ft("create.words")} ({deckCards.length})</h2>
            {deck && <Link to={`/flashcards/${deck.id}`} className="btn btn--soft btn--sm">{ft("create.openDeck")}</Link>}
          </div>
          {deckCards.length === 0 ? (
            <p className="fc-note">{ft("deck.noCards")}</p>
          ) : (
            <ul className="fc-cardlist" aria-live="polite">
              {deckCards.slice(0, LIST_MAX).map((c) => (
                <CardRow key={c.id} card={c} isNew={added.has(c.id)} onEdit={setEditing} onDelete={remove} />
              ))}
            </ul>
          )}
          {deckCards.length > LIST_MAX && <p className="fc-note">{fmt(ft("create.showingFirst"), { n: LIST_MAX })}</p>}
        </div>

        {bar2}
      </section>
      {bar}
      {editing && <CardEditModal card={editing} onClose={() => setEditing(null)} />}
    </AppShell>
  );
}
