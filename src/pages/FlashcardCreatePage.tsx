import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CardEditor, type CardValue } from "../features/flashcards/CardEditor";
import { DeckPicker, resolveDeck } from "../features/flashcards/DeckPicker";
import { useFt } from "../features/flashcards/flashText";
import { DEFAULT_DECK_ID, addCard, isDuplicate, useFlashcards } from "../features/flashcards/store";
import { lastDeckId, saveLastDeck } from "../features/flashcards/prefs";
import { SideView } from "../features/flashcards/SideView";
import { syncFlashcards } from "../features/flashcards/sync";
import type { Card } from "../features/flashcards/types";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { AppShell } from "../shared/ui/AppShell";

export function FlashcardCreatePage() {
  const { t } = useUiLanguage();
  const ft = useFt();
  const [params] = useSearchParams();
  const { decks, cards } = useFlashcards();
  const [deckId, setDeckId] = useState(() => params.get("deck") ?? lastDeckId() ?? DEFAULT_DECK_ID);
  const [added, setAdded] = useState<Card[]>([]);

  useEffect(() => {
    void syncFlashcards();
  }, []);

  // A remembered deck may be gone; fall back to the first one that exists.
  const effective = decks.some((d) => d.id === deckId) ? deckId : (decks[0]?.id ?? DEFAULT_DECK_ID);
  const deck = decks.find((d) => d.id === effective);

  function save(v: CardValue): string | void {
    const target = resolveDeck(decks, effective, ft("deck.default"));
    if (isDuplicate(cards, target, v.term, v.definition)) return ft("create.duplicate");
    const card = addCard({ deckId: target, ...v, reading: v.reading || undefined });
    saveLastDeck(target);
    setDeckId(target);
    setAdded((a) => [card, ...a].slice(0, 8));
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

        {added.length > 0 && (
          <div className="fc-added" aria-live="polite">
            <h2 className="fc-section">{ft("create.added")}</h2>
            <ul className="fc-cardlist">
              {added.map((c) => (
                <li key={c.id} className="fc-row">
                  <SideView side={{ text: c.term, lang: c.termLang, reading: c.termLang === "ja" ? c.reading : undefined }} speak={false} />
                  <span className="fc-row__sep" aria-hidden="true">→</span>
                  <SideView side={{ text: c.definition, lang: c.definitionLang, reading: c.definitionLang === "ja" ? c.reading : undefined }} speak={false} />
                </li>
              ))}
            </ul>
            {deck && <Link to={`/flashcards/${deck.id}`} className="btn btn--soft">{ft("create.openDeck")}</Link>}
          </div>
        )}
      </section>
    </AppShell>
  );
}
