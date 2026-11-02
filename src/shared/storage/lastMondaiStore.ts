/** Which 問題 of each part of a lesson was opened last, so the lesson page can point back to it. */
export const LAST_MONDAI_KEY = "jd.last_mondai.v1";

export type MondaiPart = "listening" | "dictation" | "vocab" | "grammar" | "reading";

type Store = Record<string, Partial<Record<MondaiPart, string>>>;

function read(): Store {
  try {
    const raw = localStorage.getItem(LAST_MONDAI_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

/** The section id (listening, dictation) or 問題 number as text (vocab, grammar, reading). */
export function getLastMondai(lessonId: string, part: MondaiPart): string | null {
  return read()[lessonId]?.[part] ?? null;
}

export function setLastMondai(lessonId: string, part: MondaiPart, key: string): void {
  const store = read();
  if (store[lessonId]?.[part] === key) return;
  store[lessonId] = { ...store[lessonId], [part]: key };
  try {
    localStorage.setItem(LAST_MONDAI_KEY, JSON.stringify(store));
  } catch {
    /* storage full or blocked: the marker just won't be there */
  }
}
