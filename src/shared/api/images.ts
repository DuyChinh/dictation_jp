import { apiFetch } from "./client";

export type ImageHit = {
  /** The thumbnail. */
  url: string;
  page?: string;
  by?: string;
  lic?: string;
  title?: string;
  source: "openverse" | "wikimedia";
};

export type ImageSearchResult = {
  query: string;
  results: ImageHit[];
  /** One of the two sources did not answer in time, so there may be more to find later. */
  partial: boolean;
};

/** Pictures for a word (its English meaning works best). Rejects when no source answers. */
export function searchImages(q: string, signal?: AbortSignal): Promise<ImageSearchResult> {
  return apiFetch<ImageSearchResult>(`/api/images/search?q=${encodeURIComponent(q)}&limit=18`, { signal });
}
