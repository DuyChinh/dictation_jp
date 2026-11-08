import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { StudyModes } from "../features/flashcards/StudyModes";
import { modeById, type ModeId } from "../features/flashcards/modes";
import { useFt } from "../features/flashcards/flashText";
import { cardsOf, useFlashcards } from "../features/flashcards/store";
import { syncFlashcards } from "../features/flashcards/sync";
import { useHanVietBackfill } from "../features/flashcards/useHanVietBackfill";
import { fmt } from "../shared/i18n/format";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { AppShell } from "../shared/ui/AppShell";

export const isMode = (v: string): v is ModeId => modeById(v) !== undefined;

/** One study mode of a deck, under the deck's breadcrumb. */
export function FlashcardStudyPage() {
  const { t } = useUiLanguage();
  const ft = useFt();
  const { deckId = "", mode = "" } = useParams();
  const { decks, state } = useFlashcards();
  const deck = decks.find((d) => d.id === deckId);
  const cards = useMemo(() => cardsOf(state, deckId), [state, deckId]);
  useHanVietBackfill(cards);

  useEffect(() => {
    void syncFlashcards();
  }, []);

  const crumbs = [
    { label: t("nav.flashcards"), to: "/flashcards" },
    { label: deck?.name ?? ft("deck.notFound"), to: deck ? `/flashcards/${deck.id}` : undefined },
    { label: isMode(mode) ? ft(`mode.${mode}`) : "" },
  ];

  let body;
  if (!deck || !isMode(mode)) {
    body = (
      <div className="fc-empty">
        <p>{ft("deck.notFound")}</p>
        <Link to="/flashcards" className="btn btn--outline">{ft("deck.backAll")}</Link>
      </div>
    );
  } else if (cards.length < modeById(mode)!.min) {
    body = (
      <div className="fc-empty">
        <p>{cards.length === 0 ? ft("deck.noCards") : fmt(ft("deck.needCards"), { n: modeById(mode)!.min })}</p>
        <Link to={`/flashcards/create?deck=${deck.id}`} className="btn btn--primary">{ft("page.addCards")}</Link>
      </div>
    );
  } else {
    body = <StudyModes deckId={deck.id} cards={cards} mode={mode} />;
  }

  return (
    <AppShell breadcrumbs={crumbs}>
      <section className="fc-page fc-page--narrow">{body}</section>
    </AppShell>
  );
}
