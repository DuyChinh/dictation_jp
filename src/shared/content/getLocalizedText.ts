export type ContentLang = "ja" | "vi" | "en";

export type LocalizedText = {
  ja?: string;
  vi?: string;
  en?: string;
};

/**
 * Pick localized string with fallback order.
 * Default: current lang → vi → en → ja
 */
export function getLocalizedText(
  obj: LocalizedText | string | null | undefined,
  lang: ContentLang = "vi",
  fallbackOrder?: ContentLang[],
): string {
  if (obj == null) return "";
  if (typeof obj === "string") return obj.normalize("NFC");
  const order = fallbackOrder ?? [lang, "vi", "en", "ja"];
  for (const key of order) {
    const v = obj[key];
    if (v != null && v.trim() !== "") return v.normalize("NFC");
  }
  return "";
}
