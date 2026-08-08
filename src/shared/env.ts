/**
 * Frontend env — only Vite-exposed keys (VITE_*).
 * Never hardcode API URLs in components.
 */
export function getApiBaseUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (base == null || base === "") return "";
  return base.replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${p}`;
}
