import { useEffect, useState } from "react";
import { getPaperPractice, type PaperPractice } from "../../shared/api/paper";

/** `enabled` false skips the request, e.g. for a lesson that has no written part. */
export function usePaperPractice(lessonId: string, enabled = true) {
  const [paper, setPaper] = useState<PaperPractice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPaperPractice(lessonId)
      .then((d) => {
        if (!cancelled) setPaper(d.paper);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId, enabled]);

  return { paper, error, loading };
}
