import { apiFetch } from "./client";

export type DictEntry = {
  id: number;
  common: boolean;
  /** 5 = N5 … 1 = N1; null when the word is in none of the JLPT lists */
  jlpt: number | null;
  kanji: Array<{ text: string; common: boolean; tags: string[] }>;
  kana: Array<{ text: string; common: boolean; tags: string[]; appliesToKanji: string[] | null }>;
  senses: Array<{
    pos: string[];
    field: string[];
    misc: string[];
    info: string[];
    appliesToKanji: string[] | null;
    appliesToKana: string[] | null;
    glosses: string[];
    /** Vietnamese meanings; empty while this sense is untranslated */
    vi: string[];
    examples: Array<{ ja: string; en: string; vi: string | null }>;
  }>;
  viSource: "ai" | "reviewed" | "manual" | null;
};

export type DictKanji = {
  char: string;
  strokes: number | null;
  grade: number | null;
  jlpt: number | null;
  on: string[];
  kun: string[];
  meanings: string[];
  hanViet: string[];
  radical: number | null;
  parts: string[];
};

export type LookupResult = {
  /** Where the word starts in the text that was sent, and how long it is (in code points). */
  start: number;
  length: number;
  matched: string;
  /** Conjugations undone, e.g. ["polite", "past"]; empty for the dictionary form. */
  reasons: string[];
  entries: DictEntry[];
  kanji: DictKanji[];
};

export type SearchLang = "auto" | "ja" | "en" | "vi";

export type SearchResult = {
  query: string;
  lang: Exclude<SearchLang, "auto">;
  entries: DictEntry[];
  kanji: DictKanji[];
};

const lookupCache = new Map<string, LookupResult | null>();

/** The word at `offset` (a code-point index) in `text`; answers are remembered for the session. */
export async function lookupWord(text: string, offset: number): Promise<LookupResult | null> {
  const key = `${offset}|${text}`;
  if (lookupCache.has(key)) return lookupCache.get(key) ?? null;
  const { result } = await apiFetch<{ result: LookupResult | null }>(
    `/api/dict/lookup?text=${encodeURIComponent(text)}&offset=${offset}`,
  );
  if (lookupCache.size > 300) lookupCache.clear();
  lookupCache.set(key, result);
  return result;
}

export function searchDictionary(q: string, lang: SearchLang = "auto", signal?: AbortSignal): Promise<SearchResult> {
  return apiFetch<SearchResult>(`/api/dict/search?q=${encodeURIComponent(q)}&lang=${lang}`, { signal });
}

export async function fetchEntry(id: number): Promise<DictEntry> {
  return (await apiFetch<{ entry: DictEntry }>(`/api/dict/entry/${id}`)).entry;
}

export async function fetchKanji(chars: string): Promise<DictKanji[]> {
  return (await apiFetch<{ kanji: DictKanji[] }>(`/api/dict/kanji?chars=${encodeURIComponent(chars)}`)).kanji;
}
