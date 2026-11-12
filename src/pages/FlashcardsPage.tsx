import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { useFt } from "../features/flashcards/flashText";
import { createDeck, deckStats, useFlashcards, useReviewDue } from "../features/flashcards/store";
import { syncFlashcards } from "../features/flashcards/sync";
import { fmt } from "../shared/i18n/format";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";

export function FlashcardsPage() {
  const { t } = useUiLanguage();
  const ft = useFt();
  const { user } = useAuth();
  const { decks, cards } = useFlashcards();
  const due = useReviewDue();
  const [name, setName] = useState("");

  useEffect(() => {
    void syncFlashcards();
  }, [user?._id]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createDeck(name);
    setName("");
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

        <form className="fc-newdeck" onSubmit={submit}>
          <input
            className="fc-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={ft("page.newDeck")}
            aria-label={ft("page.deckName")}
            maxLength={80}
          />
          <button type="submit" className="btn btn--outline" disabled={!name.trim()}>{ft("page.createDeck")}</button>
        </form>

        {decks.length === 0 ? (
          <div className="fc-empty">
            <Icon name="card" size={40} />
            <p>{ft("page.empty")}</p>
            <Link to="/flashcards/create" className="btn btn--primary">{ft("page.addCards")}</Link>
          </div>
        ) : (
          <>
            <h2 className="fc-section">{ft("page.decks")}</h2>
            <ul className="fc-decks">
              {decks.map((d) => {
                const own = cards.filter((c) => c.deckId === d.id);
                const s = deckStats(own);
                const learnedPct = s.total ? Math.round((s.learned / s.total) * 100) : 0;
                return (
                  <li key={d.id}>
                    <Link to={`/flashcards/${d.id}`} className="fc-deck">
                      <span className="fc-deck__name">{d.name}{d.shareId && <span className="fc-badge fc-badge--inline">{ft("share.badge")}</span>}</span>
                      <span className="fc-deck__meta">
                        {fmt(ft("page.cardsCount"), { n: s.total })}
                        {s.due > 0 && <span className="fc-deck__due"> · {fmt(ft("page.dueCount"), { n: s.due })}</span>}
                      </span>
                      <span className="fc-bar" aria-hidden="true"><span style={{ width: `${learnedPct}%` }} /></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <p className="fc-note">{ft("page.selectHint")}</p>
        <p className="fc-note">{user ? ft("page.syncNote") : ft("page.signinNote")}</p>
      </section>
    </AppShell>
  );
}
