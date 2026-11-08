import { useEffect } from "react";
import { fetchEntry } from "../../shared/api/dictionary";
import { applyHanViet } from "./store";
import { suggestionFromEntry } from "./suggest";
import type { Card } from "./types";

const TRIED_KEY = "jd.flash_hv_tried.v1";
const BATCH = 6;
const MAX_PER_VISIT = 60;

function loadTried(): Set<number> {
  try {
    const v = JSON.parse(localStorage.getItem(TRIED_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : []);
  } catch {
    return new Set();
  }
}
function saveTried(tried: Set<number>) {
  try {
    localStorage.setItem(TRIED_KEY, JSON.stringify([...tried].slice(-5000)));
  } catch {
    /* it will just be asked again next time */
  }
}

/**
 * Cards saved before the Sino-Vietnamese reading existed (or whose word had none then) are looked up once
 * from the dictionary by their entry. A word with no reading is remembered, so it is not asked again.
 */
export function useHanVietBackfill(cards: Card[]): void {
  const key = cards.filter((c) => c.entryId && !c.hanViet).map((c) => c.entryId).join(",");
  useEffect(() => {
    if (!key) return;
    const tried = loadTried();
    const wanted = [...new Set(cards.filter((c) => c.entryId && !c.hanViet).map((c) => c.entryId!))].filter((id) => !tried.has(id)).slice(0, MAX_PER_VISIT);
    if (wanted.length === 0) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < wanted.length && !cancelled; i += BATCH) {
        const group = wanted.slice(i, i + BATCH);
        const found: Record<number, string> = {};
        await Promise.all(
          group.map(async (id) => {
            try {
              const hv = suggestionFromEntry(await fetchEntry(id)).hanViet;
              if (hv) found[id] = hv;
              tried.add(id);
            } catch {
              // offline or a bad id: try again on another visit
            }
          }),
        );
        if (cancelled) break;
        applyHanViet(found);
        saveTried(tried);
      }
    })();
    return () => {
      cancelled = true;
    };
    // `key` stands for the cards that still need looking up
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
