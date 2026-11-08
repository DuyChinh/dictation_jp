import { useEffect, useRef, useState, type FormEvent } from "react";
import { lookupWord, searchDictionary, type DictEntry, type MeaningPair } from "../../shared/api/dictionary";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { Icon } from "../../shared/ui/Icon";
import { useFt } from "./flashText";
import { loadRightLang, saveRightLang } from "./prefs";
import { isFallback, suggestionsFromEntries, textFor, type Suggestion } from "./suggest";
import { CARD_LANGS, type CardLang } from "./types";

export type CardValue = {
  term: string;
  termLang: CardLang;
  definition: string;
  definitionLang: CardLang;
  reading: string;
  hanViet: string;
  entryId?: number;
};

type Props = {
  /** Starting values; with a term already there, meanings are looked up straight away. */
  initial?: Partial<CardValue>;
  /** Fewer suggestions and no heading, for the small panel over a page. */
  compact?: boolean;
  submitLabel: string;
  /** Return a message to show under the form (e.g. "already in this deck") or nothing on success. */
  onSubmit: (value: CardValue) => string | void;
  onCancel?: () => void;
  /** Empty the boxes and focus the first one after a successful save, to add the next card. */
  clearAfterSubmit?: boolean;
  autoFocus?: boolean;
  /** Told what is typed in the boxes whenever it changes: a complete card, or null while a box is empty. */
  onDraft?: (draft: CardValue | null) => void;
};

const SEARCH_DELAY = 300;

const meaningHint = (leftLang: CardLang, rightLang: CardLang): MeaningPair =>
  leftLang === "vi" ? "vi" : leftLang === "en" ? "en" : rightLang === "vi" ? "vi" : "en";

/**
 * The card form: a term box (Japanese unless changed) on the left and its definition on the right, each with
 * its own language. Typing in the left box looks the word up and fills the right box with the meaning in the
 * language chosen there, until the learner types in the right box themselves.
 */
export function CardEditor({ initial, compact = false, submitLabel, onSubmit, onCancel, clearAfterSubmit = false, autoFocus = false, onDraft }: Props) {
  const { uiLang } = useUiLanguage();
  const ft = useFt();
  const [left, setLeft] = useState(initial?.term ?? "");
  const [leftLang, setLeftLang] = useState<CardLang>(initial?.termLang ?? "ja");
  const [right, setRight] = useState(initial?.definition ?? "");
  const [rightLang, setRightLang] = useState<CardLang>(initial?.definitionLang ?? loadRightLang(uiLang));
  const [reading, setReading] = useState(initial?.reading ?? "");
  const [hanViet, setHanViet] = useState(initial?.hanViet ?? "");
  const [entryId, setEntryId] = useState<number | undefined>(initial?.entryId);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [search, setSearch] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [message, setMessage] = useState("");
  // Once the learner writes in the right box, lookups stop overwriting it.
  const rightTouched = useRef(Boolean(initial?.definition));
  const leftRef = useRef<HTMLInputElement>(null);
  const rightLangRef = useRef(rightLang);
  rightLangRef.current = rightLang;
  const hasJapanese = leftLang === "ja" || rightLang === "ja";

  function apply(s: Suggestion, index: number, lang: CardLang = rightLangRef.current) {
    setPicked(index);
    setRight(textFor(s, lang));
    setEntryId(s.entryId);
    setReading(s.reading);
    setHanViet(s.hanViet);
  }

  // Look the left box up as the learner types.
  useEffect(() => {
    const q = left.trim();
    if (!q) {
      setSuggestions([]);
      setPicked(null);
      setSearch("idle");
      return;
    }
    const controller = new AbortController();
    setSearch("loading");
    const id = setTimeout(() => {
      searchDictionary(q, controller.signal, meaningHint(leftLang, rightLangRef.current), leftLang === "ja" ? "auto" : leftLang)
        .then(async (r): Promise<DictEntry[]> => {
          // A conjugated form (食べました) is not a headword; the click lookup knows how to undo it.
          if (r.entries.length === 0 && leftLang === "ja") {
            try {
              return (await lookupWord(q, 0))?.entries ?? [];
            } catch {
              return [];
            }
          }
          return r.entries;
        })
        .then((entries) => {
          if (controller.signal.aborted) return;
          const items = suggestionsFromEntries(entries, compact ? 4 : 6);
          setSuggestions(items);
          setSearch("done");
          if (items[0] && !rightTouched.current) apply(items[0], 0);
          else setPicked(null);
        })
        .catch(() => {
          if (!controller.signal.aborted) setSearch("error");
        });
    }, SEARCH_DELAY);
    return () => {
      clearTimeout(id);
      controller.abort();
    };
    // `apply` only reads refs and setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, leftLang, compact]);

  // A new right-hand language re-reads the chosen suggestion in that language.
  useEffect(() => {
    if (picked !== null && suggestions[picked] && !rightTouched.current) setRight(textFor(suggestions[picked]!, rightLang));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rightLang]);

  function changeLeftLang(next: CardLang) {
    if (next === rightLang) setRightLang(leftLang);
    setLeftLang(next);
  }
  function changeRightLang(next: CardLang) {
    if (next === leftLang) setLeftLang(rightLang);
    setRightLang(next);
    if (next !== "ja") saveRightLang(next);
  }
  function swap() {
    const l = left;
    setLeft(right);
    setRight(l);
    setLeftLang(rightLang);
    setRightLang(leftLang);
    rightTouched.current = true;
    setSuggestions([]);
    setPicked(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!left.trim() || !right.trim()) return;
    const problem = onSubmit({
      term: left.trim(),
      termLang: leftLang,
      definition: right.trim(),
      definitionLang: rightLang,
      reading: hasJapanese ? reading.trim() : "",
      hanViet: hasJapanese ? hanViet.trim() : "",
      entryId,
    });
    setMessage(problem ?? "");
    if (!problem && clearAfterSubmit) {
      setLeft("");
      setRight("");
      setReading("");
      setHanViet("");
      setEntryId(undefined);
      setSuggestions([]);
      setPicked(null);
      rightTouched.current = false;
      leftRef.current?.focus();
    }
  }

  // let the page keep what is half typed, so leaving the page can still save it
  useEffect(() => {
    onDraft?.(
      left.trim() && right.trim()
        ? { term: left.trim(), termLang: leftLang, definition: right.trim(), definitionLang: rightLang, reading: hasJapanese ? reading.trim() : "", hanViet: hasJapanese ? hanViet.trim() : "", entryId }
        : null,
    );
    // onDraft is only a listener
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, right, leftLang, rightLang, reading, hanViet, entryId, hasJapanese]);

  const langName = (l: CardLang) => ft(`lang.${l}`);

  return (
    <form className={`fc-editor${compact ? " fc-editor--compact" : ""}`} onSubmit={submit}>
      <div className="fc-editor__pair">
        <div className="fc-field">
          <label className="fc-field__lang">
            <span className="visually-hidden">{ft("editor.leftLang")}</span>
            <select value={leftLang} onChange={(e) => changeLeftLang(e.target.value as CardLang)}>
              {CARD_LANGS.map((l) => (
                <option key={l} value={l}>{langName(l)}</option>
              ))}
            </select>
          </label>
          <input
            ref={leftRef}
            className={`fc-input${leftLang === "ja" ? " jp" : ""}`}
            value={left}
            onChange={(e) => {
              setLeft(e.target.value);
              setEntryId(undefined);
              setMessage("");
            }}
            placeholder={ft("editor.leftPlaceholder")}
            aria-label={ft("editor.term")}
            lang={leftLang}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={200}
            autoFocus={autoFocus}
          />
        </div>

        <button type="button" className="fc-swap" onClick={swap} aria-label={ft("editor.swap")} title={ft("editor.swap")}>
          <Icon name="refresh" size={18} />
        </button>

        <div className="fc-field">
          <label className="fc-field__lang">
            <span className="visually-hidden">{ft("editor.rightLang")}</span>
            <select value={rightLang} onChange={(e) => changeRightLang(e.target.value as CardLang)}>
              {CARD_LANGS.map((l) => (
                <option key={l} value={l}>{langName(l)}</option>
              ))}
            </select>
          </label>
          <input
            className={`fc-input${rightLang === "ja" ? " jp" : ""}`}
            value={right}
            onChange={(e) => {
              rightTouched.current = true;
              setRight(e.target.value);
              setMessage("");
            }}
            placeholder={ft("editor.rightPlaceholder")}
            aria-label={ft("editor.definition")}
            lang={rightLang}
            autoComplete="off"
            spellCheck={false}
            maxLength={400}
          />
        </div>
      </div>

      {hasJapanese && (
        <div className="fc-reading-row">
        <label className="fc-reading">
          <span>{ft("editor.reading")}</span>
          <input
            className="fc-input jp"
            value={reading}
            onChange={(e) => setReading(e.target.value)}
            placeholder="たべる"
            lang="ja"
            autoComplete="off"
            spellCheck={false}
            maxLength={200}
          />
        </label>
        <label className="fc-reading">
          <span>{ft("editor.hanViet")}</span>
          <input
            className="fc-input"
            value={hanViet}
            onChange={(e) => setHanViet(e.target.value)}
            placeholder={ft("editor.hanVietPlaceholder")}
            autoComplete="off"
            spellCheck={false}
            maxLength={100}
          />
        </label>
        </div>
      )}

      <div className="fc-suggest" aria-live="polite">
        {search === "loading" && <p className="fc-suggest__note">{ft("editor.searching")}</p>}
        {search === "error" && <p className="fc-suggest__note">{ft("editor.searchError")}</p>}
        {search === "done" && suggestions.length === 0 && <p className="fc-suggest__note">{ft("editor.noSuggestion")}</p>}
        {suggestions.length > 0 && (
          <>
            <p className="fc-suggest__title">{ft("editor.suggestions")}</p>
            <ul className="fc-suggest__list">
              {suggestions.map((s, i) => (
                <li key={s.entryId}>
                  <button
                    type="button"
                    className={`fc-suggest__item${picked === i ? " is-on" : ""}`}
                    aria-pressed={picked === i}
                    onClick={() => {
                      rightTouched.current = false;
                      apply(s, i);
                    }}
                  >
                    <span className={`fc-suggest__main${leftLang === "ja" ? " jp" : ""}`} lang={leftLang === "ja" ? "ja" : undefined}>
                      {textFor(s, leftLang)}
                      {leftLang === "ja" && s.reading && s.reading !== s.ja && <small>{s.reading}</small>}
                    </span>
                    <span className="fc-suggest__arrow" aria-hidden="true">→</span>
                    <span className={`fc-suggest__sub${rightLang === "ja" ? " jp" : ""}`} lang={rightLang === "ja" ? "ja" : undefined}>
                      {textFor(s, rightLang)}
                      {isFallback(s, rightLang) && <em title={ft("editor.noVi")}> EN</em>}
                    </span>
                    {s.jlpt && <span className="fc-suggest__jlpt">N{s.jlpt}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {message && <p className="fc-editor__message" role="alert">{message}</p>}

      <div className="fc-editor__actions">
        {onCancel && (
          <button type="button" className="btn btn--outline" onClick={onCancel}>
            {ft("common.cancel")}
          </button>
        )}
        <button type="submit" className="btn btn--primary" disabled={!left.trim() || !right.trim()}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
