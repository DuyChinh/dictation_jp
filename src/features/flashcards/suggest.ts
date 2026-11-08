import type { DictEntry } from "../../shared/api/dictionary";
import type { CardLang } from "./types";

export type Suggestion = {
  entryId: number;
  /** The entry's reading, for the card's Japanese side. */
  reading: string;
  /** What each language would put in a card for this entry. */
  ja: string;
  vi: string;
  en: string;
  /** The Vietnamese meaning is missing, so `vi` holds the English one. */
  viFallback: boolean;
  /** Sino-Vietnamese reading of the headword, when it has one, e.g. "CẤU NHẬP". */
  hanViet: string;
  jlpt: number | null;
};

/** Same choice of headword as the dictionary page: the first usable kanji spelling, or the kana. */
function headword(entry: DictEntry): { word: string; reading: string } {
  const kanji = entry.kanji.find((k) => !k.tags.some((t) => t === "sK" || t === "iK" || t === "rK"))?.text ?? entry.kanji[0]?.text;
  const reading = entry.kana[0]?.text ?? "";
  const usuallyKana = entry.senses[0]?.misc.includes("uk") ?? false;
  return kanji && !usuallyKana ? { word: kanji, reading } : { word: reading, reading };
}

const MAX_PARTS = 3;

export function suggestionFromEntry(entry: DictEntry): Suggestion {
  const { word, reading } = headword(entry);
  const en = entry.senses.flatMap((s) => s.glosses.slice(0, 2)).slice(0, MAX_PARTS).join("; ");
  const vi = entry.senses.flatMap((s) => s.vi.slice(0, 2)).slice(0, MAX_PARTS).join("; ");
  return { entryId: entry.id, reading, ja: word, vi: vi || en, en, viFallback: !vi && !!en, hanViet: entry.hanViet?.[word] ?? "", jlpt: entry.jlpt };
}

export const suggestionsFromEntries = (entries: DictEntry[], max = 6): Suggestion[] =>
  entries.slice(0, max).map(suggestionFromEntry).filter((s) => s.ja && (s.vi || s.en));

export const textFor = (s: Suggestion, lang: CardLang): string => s[lang];

/** Whether the suggestion's text for this language is only a stand-in (English where Vietnamese was asked). */
export const isFallback = (s: Suggestion, lang: CardLang): boolean => lang === "vi" && s.viFallback;

const JAPANESE = /[぀-ヿ㐀-鿿ｦ-ﾟ]/;
const VIETNAMESE = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;

/** A guess at the language of text the reader selected on a page. */
export function guessLang(text: string): CardLang {
  if (JAPANESE.test(text)) return "ja";
  if (VIETNAMESE.test(text)) return "vi";
  return "en";
}

export const hasJapanese = (text: string): boolean => JAPANESE.test(text);
