import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CardEditor, type CardValue } from "../features/flashcards/CardEditor";
import { DeckPicker, resolveDeck } from "../features/flashcards/DeckPicker";
import { useFt } from "../features/flashcards/flashText";
import { DEFAULT_DECK_ID, addCard, cardsOf, isDuplicate, useFlashcards } from "../features/flashcards/store";
import { lastDeckId, saveLastDeck } from "../features/flashcards/prefs";
import { sidesOf } from "../features/flashcards/quiz";
import { SideView } from "../features/flashcards/SideView";
import { syncFlashcards } from "../features/flashcards/sync";
import { fmt } from "../shared/i18n/format";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { AppShell } from "../shared/ui/AppShell";

const LIST_MAX = 40;

export function FlashcardCreatePage() {
  const { t } = useUiLanguage();
  const ft = useFt();
  const [params] = useSearchParams();
  const { decks, cards, state } = useFlashcards();
  const [deckId, setDeckId] = useState(() => params.get("deck") ?? lastDeckId() ?? DEFAULT_DECK_ID);
  // cards made on this visit, to point out in the list
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    void syncFlashcards();
  }, []);

  // A remembered deck may be gone; fall back to the first one that exists.
  const effective = decks.some((d) => d.id === deckId) ? deckId : (decks[0]?.id ?? DEFAULT_DECK_ID);
  const deck = decks.find((d) => d.id === effective);
  const deckCards = useMemo(() => cardsOf(state, effective).sort((a, b) => b.createdAt - a.createdAt), [state, effective]);

  function save(v: CardValue): string | void {
    const target = resolveDeck(decks, effective, ft("deck.default"));
    if (isDuplicate(cards, target, v.term, v.definition)) return ft("create.duplicate");
    const card = addCard({ deckId: target, ...v, reading: v.reading || undefined, hanViet: v.hanViet || undefined });
    saveLastDeck(target);
    setDeckId(target);
    setAdded((a) => new Set(a).add(card.id));
  }

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
          <CardEditor submitLabel={ft("create.add")} onSubmit={save} clearAfterSubmit autoFocus />
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
                <li key={c.id} className={`fc-row${added.has(c.id) ? " is-new" : ""}`}>
                  <SideView side={sidesOf(c).prompt} />
                  <span className="fc-row__sep" aria-hidden="true">→</span>
                  <SideView side={sidesOf(c).answer} speak={c.definitionLang === "ja"} />
                  {added.has(c.id) && <span className="fc-row__tag">{ft("create.justAdded")}</span>}
                </li>
              ))}
            </ul>
          )}
          {deckCards.length > LIST_MAX && <p className="fc-note">{fmt(ft("create.showingFirst"), { n: LIST_MAX })}</p>}
        </div>
      </section>
    </AppShell>
  );
}
