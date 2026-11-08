import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../shared/api/client";
import { DirectionPicker, HanVietPicker } from "../features/flashcards/DirectionPicker";
import { StudyModes } from "../features/flashcards/StudyModes";
import { SideView } from "../features/flashcards/SideView";
import { useFt } from "../features/flashcards/flashText";
import { MODES, modeById } from "../features/flashcards/modes";
import { useDirection, useShowHanViet } from "../features/flashcards/prefs";
import { acceptedAnswers, sidesOf } from "../features/flashcards/quiz";
import { fetchSharedDeck, sharedToCards, type SharedDeck } from "../features/flashcards/shareApi";
import { importSharedDeck } from "../features/flashcards/store";
import { syncFlashcards } from "../features/flashcards/sync";
import { fmt } from "../shared/i18n/format";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";
import { isMode } from "./FlashcardStudyPage";

type State = { status: "loading" } | { status: "missing" } | { status: "error" } | { status: "ready"; deck: SharedDeck };

/** The deck behind a share link: loading, gone, or ready. */
function useSharedDeck(shareId: string): [State, () => void] {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    fetchSharedDeck(shareId, controller.signal)
      .then((deck) => setState({ status: "ready", deck }))
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: e instanceof ApiError && e.status === 404 ? "missing" : "error" });
      });
    return () => controller.abort();
  }, [shareId, attempt]);
  return [state, () => setAttempt((n) => n + 1)];
}

function Frame({ children, title, to }: { children: React.ReactNode; title?: string; to?: string }) {
  const { t } = useUiLanguage();
  return (
    <AppShell breadcrumbs={[{ label: t("nav.flashcards"), to: "/flashcards" }, ...(title ? [{ label: title, to }] : [])]}>
      <section className="fc-page fc-page--narrow">{children}</section>
    </AppShell>
  );
}

function Problem({ status, retry }: { status: "loading" | "missing" | "error"; retry: () => void }) {
  const ft = useFt();
  return (
    <div className="fc-empty">
      {status === "loading" && <p role="status">{ft("shared.loading")}</p>}
      {status === "missing" && (
        <>
          <p>{ft("shared.notFound")}</p>
          <Link to="/flashcards" className="btn btn--outline">{ft("deck.backAll")}</Link>
        </>
      )}
      {status === "error" && (
        <>
          <p role="alert">{ft("shared.error")}</p>
          <button type="button" className="btn btn--primary" onClick={retry}>{ft("shared.retry")}</button>
        </>
      )}
    </div>
  );
}

/** What anyone with a share link sees: the deck's words, ways to study it right away, and a button to keep a copy. */
export function FlashcardSharedPage() {
  const ft = useFt();
  const navigate = useNavigate();
  const { shareId = "" } = useParams();
  const [state, retry] = useSharedDeck(shareId);
  const [direction, setDirection] = useDirection();
  const [hanViet, setHanViet] = useShowHanViet();
  const [query, setQuery] = useState("");
  const deckKey = `shared-${shareId}`;
  const cards = useMemo(() => (state.status === "ready" ? sharedToCards(state.deck, deckKey) : []), [state, deckKey]);

  if (state.status !== "ready") {
    return (
      <Frame>
        <Problem status={state.status} retry={retry} />
      </Frame>
    );
  }
  const { deck } = state;
  const q = query.trim().toLowerCase();
  const shown = q
    ? cards.filter((c) => c.term.toLowerCase().includes(q) || c.definition.toLowerCase().includes(q) || (c.reading ?? "").includes(q) || (c.hanViet ?? "").toLowerCase().includes(q) || acceptedAnswers({ text: c.term, lang: c.termLang, reading: c.reading }).some((a) => a.includes(q)))
    : cards;

  function keep() {
    const copy = importSharedDeck(deck.name, deck.cards);
    void syncFlashcards();
    navigate(`/flashcards/${copy.id}`);
  }

  return (
    <Frame title={deck.name}>
      <header className="fc-page__head">
        <div>
          <h1>{deck.name}</h1>
          <p className="fc-stats">
            <span>{fmt(ft("shared.by"), { name: deck.ownerName || ft("shared.anon") })}</span>
            <span>{fmt(ft("page.cardsCount"), { n: cards.length })}</span>
          </p>
        </div>
        <div className="fc-page__actions">
          <button type="button" className="btn btn--primary" onClick={keep} disabled={cards.length === 0}>
            <Icon name="download" size={16} /> {ft("shared.save")}
          </button>
        </div>
      </header>
      <p className="fc-note">{ft("shared.note")}</p>

      <h2 className="fc-section">{ft("deck.modes")}</h2>
      <div className="fc-pickers">
        <DirectionPicker value={direction} onChange={setDirection} />
        <HanVietPicker value={hanViet} onChange={setHanViet} />
      </div>
      <ul className="fc-modes">
        {MODES.map((m) => {
          const ok = cards.length >= m.min;
          const body = (
            <>
              <Icon name={m.icon} size={26} />
              <span className="fc-mode__title">{ft(`mode.${m.id}`)}</span>
              <span className="fc-mode__sub">{ok ? ft(`mode.${m.id}.sub`) : fmt(ft("deck.needCards"), { n: m.min })}</span>
            </>
          );
          return (
            <li key={m.id}>
              {ok ? (
                <Link className={`fc-mode fc-mode--${m.id}`} to={`/flashcards/shared/${shareId}/${m.id}`}>{body}</Link>
              ) : (
                <span className={`fc-mode fc-mode--${m.id} is-disabled`} aria-disabled="true">{body}</span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="fc-listhead">
        <h2 className="fc-section">{ft("deck.cards")} ({cards.length})</h2>
        {cards.length > 0 && (
          <div className="fc-search" role="search">
            <Icon name="search" size={18} aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={ft("deck.search")} aria-label={ft("deck.search")} autoComplete="off" spellCheck={false} />
            {query && (
              <button type="button" className="fc-search__clear" onClick={() => setQuery("")} aria-label={ft("deck.searchClear")} title={ft("deck.searchClear")}>
                <Icon name="close" size={16} />
              </button>
            )}
          </div>
        )}
      </div>
      {cards.length === 0 ? (
        <p className="fc-note">{ft("deck.noCards")}</p>
      ) : shown.length === 0 ? (
        <p className="fc-note">{fmt(ft("deck.searchNone"), { q: query.trim() })}</p>
      ) : (
        <ul className="fc-cardlist">
          {shown.map((c) => (
            <li key={c.id} className="fc-row">
              <SideView side={sidesOf(c).prompt} />
              <span className="fc-row__sep" aria-hidden="true">→</span>
              <SideView side={sidesOf(c).answer} speak={c.definitionLang === "ja"} />
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}

/** One study mode of a shared deck, played straight from the link. */
export function FlashcardSharedStudyPage() {
  const ft = useFt();
  const { shareId = "", mode = "" } = useParams();
  const [state, retry] = useSharedDeck(shareId);
  const deckKey = `shared-${shareId}`;
  const cards = useMemo(() => (state.status === "ready" ? sharedToCards(state.deck, deckKey) : []), [state, deckKey]);
  const back = `/flashcards/shared/${shareId}`;

  if (state.status !== "ready") {
    return (
      <Frame>
        <Problem status={state.status} retry={retry} />
      </Frame>
    );
  }
  const min = modeById(mode)?.min ?? 1;
  return (
    <Frame title={state.deck.name} to={back}>
      {isMode(mode) && cards.length >= min ? (
        <>
          <p className="fc-note">{ft("shared.note")}</p>
          <StudyModes deckId={deckKey} cards={cards} mode={mode} backTo={back} />
        </>
      ) : (
        <div className="fc-empty">
          <p>{ft("deck.notFound")}</p>
          <Link to={back} className="btn btn--outline">{ft("common.backToDeck")}</Link>
        </div>
      )}
    </Frame>
  );
}
