import type { ContentLang } from "@jd/content-schema";
import { getLocalizedText as sharedGet } from "@jd/content-schema";

export type { ContentLang } from "@jd/content-schema";
export type LocalizedText = {
  ja?: string;
  vi?: string;
  en?: string;
};

export function getLocalizedText(
  obj: LocalizedText | string | null | undefined,
  lang: ContentLang = "vi",
  fallbackOrder?: ContentLang[],
): string {
  return sharedGet(obj, lang, fallbackOrder);
}
