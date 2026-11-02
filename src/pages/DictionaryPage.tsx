import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { searchDictionary, type MeaningPair, type SearchResult } from "../shared/api/dictionary";
import { useSpeechInput } from "../shared/audio/recognition";
import { fmt } from "../shared/i18n/format";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";
import { HandwritingPad } from "../features/handwriting/HandwritingPad";
import { EntryCard } from "../features/dictionary/EntryCard";
import { KanjiCard } from "../features/dictionary/KanjiCard";
import { LookupLayer } from "../features/dictionary/LookupLayer";

const PAIRS: Array<{ value: MeaningPair; label: "dict.pair.vi" | "dict.pair.en" }> = [
  { value: "vi", label: "dict.pair.vi" },
  { value: "en", label: "dict.pair.en" },
];
const PAIR_KEY = "jd.dict_pair.v1";

function savedPair(): MeaningPair | null {
  try {
    const v = localStorage.getItem(PAIR_KEY);
    return v === "vi" || v === "en" ? v : null;
  } catch {
    return null;
  }
}

const EXAMPLES = ["食べる", "勉強", "taberu", "ăn", "school", "かわいい"];

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "done"; result: SearchResult };

export function DictionaryPage() {
  const { t, uiLang } = useUiLanguage();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  // Which dictionary: the address wins, then the last choice, then the interface language.
  const fromAddress = PAIRS.find((p) => p.value === params.get("lang"))?.value;
  const pair: MeaningPair = fromAddress ?? savedPair() ?? (uiLang === "en" || uiLang === "ja" ? "en" : "vi");
  const [draft, setDraft] = useState(q);
  const inputRef = useRef<HTMLInputElement>(null);
  const [writing, setWriting] = useState(false);
  // What is heard goes into the box for the reader to check (and fix) before searching.
  const mic = useSpeechInput({
    onText: (text, final) => {
      setDraft(text);
      if (final) inputRef.current?.focus();
    },
  });
  const [state, setState] = useState<State>({ status: "idle" });

  useEffect(() => setDraft(q), [q]);

  // The address holds the search, so results can be shared and the back button steps through searches.
  useEffect(() => {
    if (!q.trim()) {
      setState({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setState({ status: "loading" });
    searchDictionary(q, controller.signal, pair)
      .then((result) => setState({ status: "done", result }))
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setState({ status: "error" });
        void e;
      });
    return () => controller.abort();
  }, [q, pair]);

  function go(nextQ: string, nextPair: MeaningPair = pair) {
    const next = new URLSearchParams();
    if (nextQ.trim()) next.set("q", nextQ.trim());
    next.set("lang", nextPair);
    setParams(next);
  }
  function choosePair(next: MeaningPair) {
    try {
      localStorage.setItem(PAIR_KEY, next);
    } catch {
      /* the choice just won't be remembered */
    }
    go(q || draft, next);
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    go(draft);
  }

  return (
    <AppShell title={t("nav.dictionary")}>
      <section className="dict-page">
        <header className="dict-page__head">
          <h1>{t("dict.title")}</h1>
          <p>{t("dict.sub")}</p>
        </header>

        <form className="dict-search" onSubmit={submit} role="search">
          <div className="dict-search__box">
            <Icon name="search" size={20} aria-hidden="true" />
            <input
              type="search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("dict.placeholder")}
              aria-label={t("dict.search")}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={80}
              autoFocus
              ref={inputRef}
            />
            <button
              type="button"
              className={`dict-search__tool${writing ? " is-on" : ""}`}
              onClick={() => setWriting((v) => !v)}
              aria-label={t("dict.hw.open")}
              aria-pressed={writing}
              title={t("dict.hw.open")}
            >
              <Icon name="pencil" size={20} strokeWidth={2} />
            </button>
            {mic.supported && (
              <button
                type="button"
                className={`dict-search__mic${mic.listening ? " is-listening" : ""}`}
                onClick={mic.listening ? mic.stop : mic.start}
                aria-label={mic.listening ? t("dict.mic.stop") : t("dict.mic.start")}
                aria-pressed={mic.listening}
                title={mic.listening ? t("dict.mic.stop") : t("dict.mic.start")}
              >
                <Icon name="mic" size={20} strokeWidth={2} />
              </button>
            )}
          </div>
          <select
            className="dict-search__pair"
            value={pair}
            aria-label={t("dict.pairLabel")}
            onChange={(e) => choosePair(e.target.value as MeaningPair)}
          >
            {PAIRS.map((p) => (
              <option key={p.value} value={p.value}>
                {t(p.label)}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn--primary" disabled={!draft.trim()}>
            {t("dict.search")}
          </button>
        </form>

        {writing && (
          <HandwritingPad
            onPick={(ch) => {
              setDraft((d) => d + ch);
              inputRef.current?.focus();
            }}
            onClose={() => setWriting(false)}
          />
        )}
        {mic.listening && <p className="dict-state dict-state--listening" role="status">{t("dict.mic.listening")}</p>}
        {mic.error && <p className="dict-state dict-state--error" role="alert">{t(`dict.mic.error.${mic.error}` as const)}</p>}

        {state.status === "idle" && (
          <div className="dict-empty">
            <p>{t("dict.try")}:</p>
            <div className="dict-empty__chips">
              {EXAMPLES.map((x) => (
                <button key={x} type="button" className="dict-chip jp" onClick={() => go(x)}>
                  {x}
                </button>
              ))}
            </div>
            <p className="dict-empty__note">{t("dict.aboutVi")}</p>
          </div>
        )}
        {state.status === "loading" && <p className="dict-state" role="status">{t("dict.loading")}</p>}
        {state.status === "error" && (
          <p className="dict-state dict-state--error" role="alert">{t("dict.error")}</p>
        )}
        {state.status === "done" && state.result.entries.length === 0 && state.result.kanji.length === 0 && (
          <div className="dict-state">
            <p><strong>{fmt(t("dict.noResults"), { q: state.result.query })}</strong></p>
            <p>{t("dict.noResultsHint")}</p>
          </div>
        )}
        {state.status === "done" && (state.result.entries.length > 0 || state.result.kanji.length > 0) && (
          <LookupLayer className="dict-results">
            {state.result.kanji.length > 0 && (
              <section aria-label={t("dict.kanji")}>
                <h2 className="dict-results__title">{t("dict.kanji")}</h2>
                <div className="dict-kanji-list">
                  {state.result.kanji.map((k) => (
                    <KanjiCard key={k.char} kanji={k} />
                  ))}
                </div>
              </section>
            )}
            {state.result.entries.length > 0 && (
              <section>
                <h2 className="dict-results__title">
                  {fmt(t("dict.resultCount"), { n: state.result.entries.length })}
                </h2>
                {state.result.entries.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} meaning={pair} />
                ))}
              </section>
            )}
          </LookupLayer>
        )}

        <footer className="dict-sources">
          <p>{t("dict.viAi")}</p>
          <p>{t("dict.sources")}</p>
          {mic.supported && <p>{t("dict.mic.privacy")}</p>}
        </footer>
      </section>
    </AppShell>
  );
}
