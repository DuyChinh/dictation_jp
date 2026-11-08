import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { DirectionPicker } from "../features/flashcards/DirectionPicker";
import { BlitzMode } from "../features/flashcards/BlitzMode";
import { DropMode } from "../features/flashcards/DropMode";
import { MemoryMode } from "../features/flashcards/MemoryMode";
import { MinerMode } from "../features/flashcards/MinerMode";
import { ShootMode } from "../features/flashcards/ShootMode";
import { modeById, type ModeId } from "../features/flashcards/modes";
import { LearnMode } from "../features/flashcards/LearnMode";
import { MatchMode } from "../features/flashcards/MatchMode";
import { TestMode } from "../features/flashcards/TestMode";
import { useFt } from "../features/flashcards/flashText";
import { useDirection } from "../features/flashcards/prefs";
import { cardsOf, useFlashcards } from "../features/flashcards/store";
import { syncFlashcards } from "../features/flashcards/sync";
import { fmt } from "../shared/i18n/format";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { AppShell } from "../shared/ui/AppShell";

const isMode = (v: string): v is ModeId => modeById(v) !== undefined;

/** One study mode of a deck, under the deck's breadcrumb. */
export function FlashcardStudyPage() {
  const { t } = useUiLanguage();
  const ft = useFt();
  const { deckId = "", mode = "" } = useParams();
  const { decks, state } = useFlashcards();
  const deck = decks.find((d) => d.id === deckId);
  const cards = useMemo(() => cardsOf(state, deckId), [state, deckId]);
  const [direction, setDirection] = useDirection();

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
    // a fresh start when the deck or the asked side changes
    const key = `${deck.id}:${direction}`;
    body = (
      <>
        <DirectionPicker value={direction} onChange={setDirection} />
        {mode === "learn" && <LearnMode key={key} deckId={deck.id} cards={cards} direction={direction} />}
        {mode === "test" && <TestMode key={key} deckId={deck.id} cards={cards} direction={direction} />}
        {mode === "match" && <MatchMode key={key} deckId={deck.id} cards={cards} direction={direction} />}
        {mode === "memory" && <MemoryMode key={key} deckId={deck.id} cards={cards} direction={direction} />}
        {mode === "blitz" && <BlitzMode key={key} deckId={deck.id} cards={cards} direction={direction} />}
        {mode === "shoot" && <ShootMode key={key} deckId={deck.id} cards={cards} direction={direction} />}
        {mode === "miner" && <MinerMode key={key} deckId={deck.id} cards={cards} direction={direction} />}
        {mode === "drop" && <DropMode key={key} deckId={deck.id} cards={cards} direction={direction} />}
      </>
    );
  }

  return (
    <AppShell breadcrumbs={crumbs}>
      <section className="fc-page fc-page--narrow">{body}</section>
    </AppShell>
  );
}
