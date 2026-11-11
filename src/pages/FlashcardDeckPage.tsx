import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DirectionPicker, HanVietPicker, HiraganaPicker } from "../features/flashcards/DirectionPicker";
import { useFt } from "../features/flashcards/flashText";
import { useDirection, useShowHanViet, useShowHiragana } from "../features/flashcards/prefs";
import { cardsOf, deckStats, deleteDeck, renameDeck, useFlashcards } from "../features/flashcards/store";
import { syncFlashcards } from "../features/flashcards/sync";
import { useHanVietBackfill } from "../features/flashcards/useHanVietBackfill";
import { acceptedAnswers } from "../features/flashcards/quiz";
import type { Card } from "../features/flashcards/types";
import { fmt } from "../shared/i18n/format";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";
import { MODES } from "../features/flashcards/modes";
import { CardEditModal } from "../features/flashcards/CardEditModal";
import { CardRow } from "../features/flashcards/CardRow";
import { useUndoDelete } from "../features/flashcards/UndoDelete";
import { DeckShare } from "../features/flashcards/DeckShare";

export function FlashcardDeckPage() {
  const { t } = useUiLanguage();
  const ft = useFt();
  const navigate = useNavigate();
  const { deckId = "" } = useParams();
  const { decks, state } = useFlashcards();
  const deck = decks.find((d) => d.id === deckId);
  const cards = useMemo(() => cardsOf(state, deckId), [state, deckId]);
  const [direction, setDirection] = useDirection();
  const [hanViet, setHanViet] = useShowHanViet();
  const [hiragana, setHiragana] = useShowHiragana();
  useHanVietBackfill(cards);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Card | null>(null);
  const { remove: removeCard, bar } = useUndoDelete();

  useEffect(() => {
    void syncFlashcards();
  }, []);

  const crumbs = [{ label: t("nav.flashcards"), to: "/flashcards" }, { label: deck?.name ?? ft("deck.notFound") }];

  if (!deck) {
    return (
      <AppShell breadcrumbs={crumbs}>
        <section className="fc-page fc-page--narrow">
          <div className="fc-empty">
            <p>{ft("deck.notFound")}</p>
            <Link to="/flashcards" className="btn btn--outline">{ft("deck.backAll")}</Link>
          </div>
        </section>
      </AppShell>
    );
  }

  const stats = deckStats(cards);
  const q = query.trim().toLowerCase();
  const shown = q
    ? cards.filter((c) => c.term.toLowerCase().includes(q) || c.definition.toLowerCase().includes(q) || (c.reading ?? "").includes(q) || (c.hanViet ?? "").toLowerCase().includes(q) || acceptedAnswers({ text: c.term, lang: c.termLang, reading: c.reading }).some((a) => a.includes(q)))
    : cards;

  function rename(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) renameDeck(deckId, name);
    setRenaming(false);
  }
  function remove() {
    if (window.confirm(fmt(ft("deck.deleteConfirm"), { name: deck!.name, n: cards.length }))) {
      deleteDeck(deckId);
      navigate("/flashcards", { replace: true });
    }
  }

  return (
    <AppShell breadcrumbs={crumbs}>
      <section className="fc-page">
        <header className="fc-page__head">
          {renaming ? (
            <form className="fc-rename" onSubmit={rename}>
              <input className="fc-input" value={name} onChange={(e) => setName(e.target.value)} aria-label={ft("page.deckName")} maxLength={80} autoFocus />
              <button type="submit" className="btn btn--primary btn--sm">{ft("deck.save")}</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setRenaming(false)}>{ft("common.cancel")}</button>
            </form>
          ) : (
            <div>
              <h1>{deck.name}{deck.shareId && <span className="fc-badge fc-badge--inline">{ft("share.badge")}</span>}</h1>
              <p className="fc-stats">
                <span>{fmt(ft("page.cardsCount"), { n: stats.total })}</span>
                <span>{ft("deck.stats.new")}: {stats.fresh}</span>
                <span>{ft("deck.stats.learning")}: {stats.learning}</span>
                <span>{ft("deck.stats.learned")}: {stats.learned}</span>
              </p>
            </div>
          )}
          {!renaming && (
            <div className="fc-page__actions">
              <Link to={`/flashcards/create?deck=${deck.id}`} className="btn btn--primary btn--sm"><Icon name="plus" size={16} /> {ft("page.addCards")}</Link>
              <button type="button" className="btn btn--outline btn--sm" onClick={() => { setName(deck.name); setRenaming(true); }}>{ft("deck.rename")}</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={remove}><Icon name="trash" size={16} /> {ft("deck.delete")}</button>
            </div>
          )}
        </header>

        <DeckShare deck={deck} />

        <h2 className="fc-section">{ft("deck.modes")}</h2>
        <DirectionPicker value={direction} onChange={setDirection} />
        <HanVietPicker value={hanViet} onChange={setHanViet} />
        <HiraganaPicker value={hiragana} onChange={setHiragana} />
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
                  <Link className={`fc-mode fc-mode--${m.id}`} to={`/flashcards/${deck.id}/${m.id}`}>{body}</Link>
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
              <CardRow key={c.id} card={c} onEdit={setEditing} onDelete={removeCard} />
            ))}
          </ul>
        )}
      </section>

      {bar}
      {editing && <CardEditModal card={editing} onClose={() => setEditing(null)} />}
    </AppShell>
  );
}
