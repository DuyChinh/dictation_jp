import { parseTemplates, type StrokeData, type Template } from "./recognize";

let loaded: Promise<Template[]> | null = null;

/** The stroke data of every character, fetched once and only when the pad is first opened (about 400 KB zipped). */
export function loadTemplates(): Promise<Template[]> {
  loaded ??= fetch("/handwriting/strokes-v1.json")
    .then((res) => {
      if (!res.ok) throw new Error(`strokes ${res.status}`);
      return res.json() as Promise<StrokeData>;
    })
    .then(parseTemplates)
    .catch((e: unknown) => {
      loaded = null; // let the next opening try again
      throw e;
    });
  return loaded;
}
