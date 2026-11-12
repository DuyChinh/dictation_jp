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

export type ImageQueryPayload = {
  word: string;
  reading?: string;
  meanings: string[];
  example?: string;
  description?: string;
};

export type ImageQueryResponse = {
  queries: string[];
  picturable: boolean;
  source?: "ai" | "cache";
};

/** AI-suggested visual search phrases for a word. Throws an error carrying HTTP status (e.g. 501). */
export function suggestImageQueries(
  payload: ImageQueryPayload,
  signal?: AbortSignal,
): Promise<ImageQueryResponse> {
  return apiFetch<ImageQueryResponse>("/api/images/queries", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}
