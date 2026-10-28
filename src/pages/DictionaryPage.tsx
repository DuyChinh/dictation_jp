import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { searchDictionary, type SearchLang, type SearchResult } from "../shared/api/dictionary";
import { fmt } from "../shared/i18n/format";
import type { TranslationKey } from "../shared/i18n/translations";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";
import { EntryCard } from "../features/dictionary/EntryCard";
import { KanjiCard } from "../features/dictionary/KanjiCard";
import { LookupLayer } from "../features/dictionary/LookupLayer";

const LANGS: Array<{ value: SearchLang; label: TranslationKey }> = [
  { value: "auto", label: "dict.lang.auto" },
  { value: "ja", label: "dict.lang.ja" },
  { value: "vi", label: "dict.lang.vi" },
  { value: "en", label: "dict.lang.en" },
];
const EXAMPLES = ["食べる", "勉強", "taberu", "ăn", "school", "かわいい"];

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "done"; result: SearchResult };

export function DictionaryPage() {
  const { t } = useUiLanguage();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const lang = (LANGS.find((l) => l.value === params.get("lang"))?.value ?? "auto") as SearchLang;
  const [draft, setDraft] = useState(q);
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
    searchDictionary(q, lang, controller.signal)
      .then((result) => setState({ status: "done", result }))
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setState({ status: "error" });
        void e;
      });
    return () => controller.abort();
  }, [q, lang]);

  function go(nextQ: string, nextLang: SearchLang = lang) {
    const next = new URLSearchParams();
    if (nextQ.trim()) next.set("q", nextQ.trim());
    if (nextLang !== "auto") next.set("lang", nextLang);
    setParams(next);
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
            />
          </div>
          <button type="submit" className="btn btn--primary" disabled={!draft.trim()}>
            {t("dict.search")}
          </button>
        </form>

        <div className="dict-langs" role="group" aria-label={t("dict.langLabel")}>
          {LANGS.map((l) => (
            <button
              key={l.value}
              type="button"
              className={`dict-langs__tab${lang === l.value ? " is-active" : ""}`}
              aria-pressed={lang === l.value}
              onClick={() => go(q || draft, l.value)}
            >
              {t(l.label)}
            </button>
          ))}
        </div>

        {state.status === "idle" && (
          <div className="dict-empty">
            <p>{t("dict.try")}:</p>
            <div className="dict-empty__chips">
              {EXAMPLES.map((x) => (
                <button key={x} type="button" className="dict-chip jp" onClick={() => go(x, "auto")}>
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
                  <EntryCard key={entry.id} entry={entry} />
                ))}
              </section>
            )}
          </LookupLayer>
        )}

        <footer className="dict-sources">
          <p>{t("dict.viAi")}</p>
          <p>{t("dict.sources")}</p>
        </footer>
      </section>
    </AppShell>
  );
}
