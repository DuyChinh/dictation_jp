import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../../shared/api/client";
import { Icon } from "../../shared/ui/Icon";
import { useFt } from "./flashText";
import { disableShare, enableShare, shareUrl } from "./shareApi";
import { setDeckShare } from "./store";
import { syncFlashcards } from "./sync";
import type { Deck } from "./types";

/** Private or public: a public deck has a link anyone can open to study it, or to keep a copy. */
export function DeckShare({ deck }: { deck: Deck }) {
  const ft = useFt();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const isPublic = Boolean(deck.shareId);
  const link = deck.shareId ? shareUrl(deck.shareId) : "";

  async function choose(makePublic: boolean) {
    if (busy || makePublic === isPublic) return;
    setBusy(true);
    setError("");
    try {
      if (makePublic) {
        // the server shares what is on the account, so the deck and its cards must be there first
        await syncFlashcards();
        const shareId = await enableShare(deck.id);
        setDeckShare(deck.id, shareId);
      } else {
        await disableShare(deck.id);
        setDeckShare(deck.id, undefined);
      }
      void syncFlashcards();
    } catch (e) {
      setError(e instanceof ApiError && e.code === "LIMIT" ? ft("share.limit") : ft("share.error"));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // no clipboard access: select the link so it can be copied by hand
      (document.getElementById(`share-link-${deck.id}`) as HTMLInputElement | null)?.select();
    }
  }

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <section className="fc-share" aria-label={ft("share.title")}>
      <div className="fc-share__head">
        <h2 className="fc-section">{ft("share.title")}</h2>
        {user ? (
          <div className="fc-dir" role="radiogroup" aria-label={ft("share.title")}>
            {([false, true] as const).map((pub) => (
              <button key={String(pub)} type="button" role="radio" aria-checked={isPublic === pub} disabled={busy} className={`fc-dir__item${isPublic === pub ? " is-on" : ""}`} onClick={() => void choose(pub)}>
                <Icon name={pub ? "globe" : "lock"} size={16} /> {ft(pub ? "share.public" : "share.private")}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {!user ? (
        <p className="fc-note">
          {ft("share.signin")} <Link to="/auth">{ft("share.signinLink")}</Link>
        </p>
      ) : (
        <p className="fc-note">{isPublic ? ft("share.publicHint") : ft("share.privateHint")}</p>
      )}
      {isPublic && (
        <div className="fc-share__link">
          <input id={`share-link-${deck.id}`} className="fc-input" readOnly value={link} aria-label={ft("share.link")} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="btn btn--soft" onClick={() => void copy()}>
            <Icon name={copied ? "check" : "copy"} size={16} /> {copied ? ft("share.copied") : ft("share.copy")}
          </button>
          {canNativeShare && (
            <button type="button" className="btn btn--outline" onClick={() => void navigator.share({ title: deck.name, url: link }).catch(() => undefined)}>
              <Icon name="send" size={16} /> {ft("share.share")}
            </button>
          )}
        </div>
      )}
      {error && <p className="fc-editor__message" role="alert">{error}</p>}
    </section>
  );
}
