import type { DictEntry } from "../../shared/api/dictionary";
import type { ImageHit } from "../../shared/api/images";
import type { CardImage } from "./types";

/** Pictures come only from Openverse and Wikimedia Commons; anything else is never loaded, whatever a deck says. */
/** Commons resizes on thumb.wikimedia.org (what its search answers with); upload.wikimedia.org holds the originals. */
const IMAGE_HOSTS = ["api.openverse.org", "thumb.wikimedia.org", "upload.wikimedia.org"];
const PAGE_HOSTS = ["openverse.org", "commons.wikimedia.org"];

function httpsHost(value: string | undefined, hosts: string[]): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password && hosts.includes(u.hostname);
  } catch {
    return false;
  }
}

export const isAllowedImage = (image: CardImage | undefined | null): image is CardImage => !!image && httpsHost(image.url, IMAGE_HOSTS);

/** The credit page, when it is one that may be linked to. */
export const creditPage = (image: CardImage): string | undefined => (httpsHost(image.page, PAGE_HOSTS) ? image.page : undefined);

/** What is kept on a card from a search result: where it is, who made it, its licence. */
export const toCardImage = (hit: ImageHit): CardImage => ({
  url: hit.url,
  ...(hit.page ? { page: hit.page } : {}),
  ...(hit.by ? { by: hit.by } : {}),
  ...(hit.lic ? { lic: hit.lic } : {}),
});

/** "Mathias Appel · CC0", the credit line shown with a picture. */
export const creditText = (image: CardImage): string => [image.by, image.lic].filter(Boolean).join(" · ");

/** One meaning as a search phrase: no brackets, no leading "to", "be", "a" or "the". */
function phrase(meaning: string): string {
  return meaning
    .replace(/\([^)]*\)/g, " ")
    .replace(/^\s*(to be|to|be|a|an|the)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

/**
 * A search phrase from an English meaning: the first sense without its brackets or a leading "to"/"be"/"a"/"the",
 * so "to eat; to have a meal" looks for "eat", "be convinced" for "convinced" and "(sl) cool; (a) cute thing" for "cool".
 */
export function imageQueryFrom(meaning: string): string {
  return phrase(meaning.split(/[;,/]/)[0] ?? "");
}

/** The primary search query for a dictionary entry: uses handwritten pictureQueries first, then gloss. */
export function imageQueryFromEntry(entry: DictEntry): string {
  if (entry.pictureQueries && entry.pictureQueries.length > 0 && entry.pictureQueries[0]) {
    return entry.pictureQueries[0];
  }
  return imageQueryFrom(entry.senses[0]?.glosses[0] ?? "");
}

const MAX_KEYWORDS = 8;
const MAX_KEYWORD = 40;

/**
 * Other things to look for, from the English meanings of a word: each meaning as a phrase, without repeats, and for
 * a verb "person eat" as well, since a verb alone mostly finds animals and objects rather than someone doing it.
 */
export function imageKeywordsFrom(meanings: string[], opts: { verb?: boolean } = {}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (k: string) => {
    const key = k.toLowerCase();
    if (!k || k.length > MAX_KEYWORD || seen.has(key)) return;
    seen.add(key);
    out.push(k);
  };
  const phrases = meanings.map(phrase).filter(Boolean);
  for (const k of phrases) add(k);
  if (opts.verb && phrases[0] && !/^person\b/i.test(phrases[0])) add(`person ${phrases[0]}`);
  return out.slice(0, MAX_KEYWORDS);
}

/** Keywords from a dictionary entry: pictureQueries first, then English meanings of every sense. */
export function imageKeywordsFromEntry(entry: DictEntry): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (k: string) => {
    const key = k.toLowerCase().trim();
    if (!key || key.length > MAX_KEYWORD || seen.has(key)) return;
    seen.add(key);
    out.push(k.trim());
  };

  if (entry.pictureQueries) {
    for (const q of entry.pictureQueries) add(q);
  }

  const verb = entry.senses.some((s) => s.pos.some((p) => /^v/.test(p)));
  const glossKeywords = imageKeywordsFrom(
    entry.senses.flatMap((s) => s.glosses),
    { verb },
  );
  for (const k of glossKeywords) add(k);

  return out.slice(0, MAX_KEYWORDS);
}
