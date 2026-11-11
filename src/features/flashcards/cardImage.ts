import type { ImageHit } from "../../shared/api/images";
import type { CardImage } from "./types";

/** Pictures come only from Openverse and Wikimedia Commons; anything else is never loaded, whatever a deck says. */
const IMAGE_HOSTS = ["api.openverse.org", "upload.wikimedia.org"];
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

/**
 * A search phrase from an English meaning: the first sense without its brackets or a leading "to"/"a"/"the", so
 * "to eat; to have a meal" looks for "eat" and "(sl) cool; (a) cute thing" for "cool".
 */
export function imageQueryFrom(meaning: string): string {
  const first = meaning.split(/[;,/]/)[0] ?? "";
  return first
    .replace(/\([^)]*\)/g, " ")
    .replace(/^\s*(to|a|an|the)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}
