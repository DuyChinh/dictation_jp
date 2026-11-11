import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { searchImages, type ImageHit } from "../../shared/api/images";
import { Icon } from "../../shared/ui/Icon";
import { isAllowedImage } from "./cardImage";
import { useImgText } from "./imageText";
import type { CardImage } from "./types";

type Props = {
  /** What to look for to begin with; searched at once when there is something. */
  initialQuery: string;
  /** The word the picture is for, shown as a reminder. */
  word?: string;
  /** The picture the card has now, if any. */
  current?: CardImage;
  onPick: (hit: ImageHit) => void;
  /** Offered when the card has a picture: take it off. */
  onRemove?: () => void;
  onClose: () => void;
};

type State = { status: "idle" } | { status: "loading" } | { status: "error" } | { status: "done"; results: ImageHit[]; partial: boolean };

/**
 * A box over the page to choose a picture for a card: search (the word's English meaning is filled in), see what
 * Openverse and Wikimedia Commons have, pick one. The first search of a word can take several seconds, because
 * Openverse is slow; the box says so rather than looking stuck.
 */
export function ImagePicker({ initialQuery, word, current, onPick, onRemove, onClose }: Props) {
  const it = useImgText();
  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState<State>({ status: "idle" });
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const controller = useRef<AbortController | null>(null);
  const opener = useRef<Element | null>(typeof document === "undefined" ? null : document.activeElement);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  function run(q: string) {
    const text = q.trim();
    controller.current?.abort();
    if (!text) {
      setState({ status: "idle" });
      return;
    }
    const c = new AbortController();
    controller.current = c;
    setState({ status: "loading" });
    searchImages(text, c.signal)
      .then((r) => !c.signal.aborted && setState({ status: "done", results: r.results.filter((h) => isAllowedImage(h)), partial: r.partial }))
      .catch(() => !c.signal.aborted && setState({ status: "error" }));
  }

  useEffect(() => {
    run(initialQuery);
    return () => controller.current?.abort();
    // only the first search is automatic
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape closes this box only, not a box it was opened from (the capture phase gets there first)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onCloseRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    const back = opener.current;
    return () => {
      window.removeEventListener("keydown", onKey, true);
      if (back instanceof HTMLElement) back.focus();
    };
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    // the box can be opened from inside a form (the card editor), and a portal's events still reach that form
    e.stopPropagation();
    run(query);
  }

  const shown = state.status === "done" ? state.results.filter((h) => !broken.has(h.url)) : [];

  return createPortal(
    <div className="fc-modal fc-imgpick-modal" data-keep-open="" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fc-modal__box fc-imgpick" role="dialog" aria-modal="true" aria-label={it("img.title")}>
        <header className="fc-imgpick__head">
          <div>
            <h2>{it("img.title")}</h2>
            {word && <p className="jp">{it("img.forWord", { word })}</p>}
          </div>
          <button type="button" className="icon-btn icon-btn--ghost" onClick={onClose} aria-label={it("img.close")} title={it("img.close")}>
            <Icon name="close" size={20} />
          </button>
        </header>

        <form className="fc-imgpick__search" onSubmit={submit} role="search">
          <input
            className="fc-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={it("img.placeholder")}
            aria-label={it("img.searchLabel")}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={60}
            autoFocus
          />
          <button type="submit" className="btn btn--primary" disabled={!query.trim() || state.status === "loading"}>
            <Icon name="search" size={18} />
            {it("img.search")}
          </button>
        </form>
        <p className="fc-imgpick__hint">{it("img.searchLabel")}</p>

        {current && isAllowedImage(current) && (
          <div className="fc-imgpick__current">
            <img src={current.url} alt="" referrerPolicy="no-referrer" draggable={false} />
            <span>{it("img.current")}</span>
            {onRemove && (
              <button type="button" className="btn btn--outline btn--sm" onClick={onRemove}>
                <Icon name="trash" size={16} />
                {it("img.remove")}
              </button>
            )}
          </div>
        )}

        <div className="fc-imgpick__body" aria-live="polite" aria-busy={state.status === "loading"}>
          {state.status === "loading" && (
            <>
              <p className="fc-imgpick__note">{it("img.loading")}</p>
              <div className="fc-imgpick__grid" aria-hidden="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <span key={i} className="fc-imgpick__skeleton" />
                ))}
              </div>
            </>
          )}
          {state.status === "error" && (
            <div className="fc-imgpick__note fc-imgpick__note--error" role="alert">
              <p>{it("img.error")}</p>
              <button type="button" className="btn btn--outline btn--sm" onClick={() => run(query)}>
                {it("img.retry")}
              </button>
            </div>
          )}
          {state.status === "done" && shown.length === 0 && <p className="fc-imgpick__note">{it("img.empty")}</p>}
          {state.status === "done" && state.partial && (
            <p className="fc-imgpick__note">
              {it("img.partial")}{" "}
              <button type="button" className="fc-imgpick__link" onClick={() => run(query)}>
                {it("img.retry")}
              </button>
            </p>
          )}
          {shown.length > 0 && (
            <ul className="fc-imgpick__grid" aria-label={it("img.results")}>
              {shown.map((hit) => {
                const credit = [hit.by, hit.lic].filter(Boolean).join(" · ");
                return (
                  <li key={hit.url}>
                    <button type="button" className="fc-imgpick__tile" onClick={() => onPick(hit)} aria-label={`${it("img.use")}: ${hit.title || hit.by || ""}`.trim()} title={[hit.title, credit].filter(Boolean).join(" — ")}>
                      <img
                        src={hit.url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        draggable={false}
                        onError={() => setBroken((b) => new Set(b).add(hit.url))}
                      />
                      {credit && <span className="fc-imgpick__credit">{credit}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="fc-imgpick__footer">{it("img.credit")}</p>
      </div>
    </div>,
    document.body,
  );
}
