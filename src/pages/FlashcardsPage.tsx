import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { useFt } from "../features/flashcards/flashText";
import { createDeck, deckNameTaken, deckStats, deleteDeck, useFlashcards, useReviewDue } from "../features/flashcards/store";
import { syncFlashcards } from "../features/flashcards/sync";
import type { Deck } from "../features/flashcards/types";
import { fmt } from "../shared/i18n/format";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { AppShell } from "../shared/ui/AppShell";
import { ConfirmDialog } from "../shared/ui/ConfirmDialog";
import { Icon } from "../shared/ui/Icon";

/** Case- and width-insensitive form of a name, so "vocab" finds "Vocab1311". */
const fold = (s: string) => s.normalize("NFKC").toLocaleLowerCase();

export function FlashcardsPage() {
  const { t } = useUiLanguage();
  const ft = useFt();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { decks, cards } = useFlashcards();
  const due = useReviewDue();
  /** One box: what is typed filters the decks, and "Create deck" makes a deck of that name. */
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<{ deck: Deck; n: number } | null>(null);

  useEffect(() => {
    void syncFlashcards();
  }, [user?._id]);

  const typed = name.trim();
  const taken = deckNameTaken(decks, name);
  const shown = useMemo(() => {
    const q = fold(typed);
    return q ? decks.filter((d) => fold(d.name).includes(q)) : decks;
  }, [decks, typed]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!typed || taken) return;
    const deck = createDeck(name);
    setName("");
    navigate(`/flashcards/${deck.id}`);
  }

  return (
    <AppShell title={t("nav.flashcards")}>
      <section className="fc-page">
        <header className="fc-page__head">
          <div>
            <h1>{ft("page.title")}</h1>
            <p>{ft("page.sub")}</p>
          </div>
          <Link to="/flashcards/create" className="btn btn--primary">
            <Icon name="plus" size={18} /> {ft("create.title")}
          </Link>
        </header>

        {due.total > 0 && due.topDeckId && (
          <aside className="fc-remind" aria-label={fmt(ft("remind.title"), { n: due.total })}>
            <span className="fc-remind__icon" aria-hidden="true"><Icon name="clock" size={22} /></span>
            <div className="fc-remind__text">
              <strong>{fmt(ft("remind.title"), { n: due.total })}</strong>
              <span>{ft("remind.sub")}</span>
            </div>
            <Link to={`/flashcards/${due.topDeckId}/learn?review=1`} className="btn btn--primary">{ft("remind.go")}</Link>
          </aside>
        )}

        <form className="fc-newdeck" onSubmit={submit} role="search">
          <div className="fc-newdeck__field">
            <Icon name="search" size={18} aria-hidden="true" />
            <input
              className="fc-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={ft("page.findOrCreate")}
              aria-label={ft("page.findOrCreate")}
              aria-invalid={taken}
              aria-describedby={taken ? "fc-newdeck-err" : undefined}
              maxLength={80}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="done"
            />
            {name && (
              <button type="button" className="fc-search__clear" onClick={() => setName("")} aria-label={ft("deck.searchClear")} title={ft("deck.searchClear")}>
                <Icon name="close" size={16} />
              </button>
            )}
          </div>
          <button type="submit" className="btn btn--outline" disabled={!typed || taken}>{ft("page.createDeck")}</button>
          {taken && <p id="fc-newdeck-err" className="fc-fielderr" role="alert">{fmt(ft("page.deckExists"), { name: typed })}</p>}
        </form>

        {decks.length === 0 ? (
          <div className="fc-empty">
            <Icon name="card" size={40} />
            <p>{ft("page.empty")}</p>
            <Link to="/flashcards/create" className="btn btn--primary">{ft("page.addCards")}</Link>
          </div>
        ) : (
          <>
            <h2 className="fc-section">
              {ft("page.decks")}
              {typed && <span className="fc-section__count"> · {fmt(ft("page.matchCount"), { shown: shown.length, total: decks.length })}</span>}
            </h2>
            {shown.length === 0 ? (
              <p className="fc-note" role="status">{fmt(ft("page.noMatch"), { q: typed })}</p>
            ) : (
              <ul className="fc-decks">
                {shown.map((d) => {
                  const own = cards.filter((c) => c.deckId === d.id);
                  const s = deckStats(own);
                  const learnedPct = s.total ? Math.round((s.learned / s.total) * 100) : 0;
                  return (
                    <li key={d.id} className="fc-decks__item">
                      <Link to={`/flashcards/${d.id}`} className="fc-deck">
                        <span className="fc-deck__name">{d.name}{d.shareId && <span className="fc-badge fc-badge--inline">{ft("share.badge")}</span>}</span>
                        <span className="fc-deck__meta">
                          {fmt(ft("page.cardsCount"), { n: s.total })}
                          {s.due > 0 && <span className="fc-deck__due"> · {fmt(ft("page.dueCount"), { n: s.due })}</span>}
                        </span>
                        <span className="fc-bar" aria-hidden="true"><span style={{ width: `${learnedPct}%` }} /></span>
                      </Link>
                      <button
                        type="button"
                        className="fc-deck__del"
                        onClick={() => setToDelete({ deck: d, n: s.total })}
                        aria-label={fmt(ft("deck.deleteItem"), { name: d.name })}
                        title={ft("deck.delete")}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        <p className="fc-note">{ft("page.selectHint")}</p>
        <p className="fc-note">{user ? ft("page.syncNote") : ft("page.signinNote")}</p>
      </section>

      <ConfirmDialog
        open={toDelete !== null}
        danger
        title={ft("dlg.deleteDeck.title")}
        message={toDelete ? fmt(ft("dlg.deleteDeck.body"), { name: toDelete.deck.name, n: toDelete.n }) : ""}
        confirmLabel={ft("dlg.deleteDeck.confirm")}
        cancelLabel={ft("common.cancel")}
        onConfirm={() => {
          if (toDelete) deleteDeck(toDelete.deck.id);
          setToDelete(null);
        }}
        onCancel={() => setToDelete(null)}
      />
    </AppShell>
  );
}
