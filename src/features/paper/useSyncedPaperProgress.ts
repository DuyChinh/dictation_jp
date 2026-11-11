import { useEffect, useState } from "react";
import { getPaperProgress, PAPER_PROGRESS_CHANGED, syncPaperProgressFromServer } from "../../shared/storage/paperProgressStore";

/** Refresh on entry and when returning to this device after practising elsewhere. */
export function useSyncedPaperProgress(lessonId: string) {
  const [progress, setProgress] = useState(() => getPaperProgress(lessonId));
  const [ready, setReady] = useState(() => !localStorage.getItem("token"));
  useEffect(() => {
    let cancelled = false;
    const read = () => { if (!cancelled) setProgress(getPaperProgress(lessonId)); };
    const refresh = () => {
      void syncPaperProgressFromServer(lessonId).then(() => {
        if (!cancelled) { read(); setReady(true); }
      });
    };
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    read();
    refresh();
    window.addEventListener(PAPER_PROGRESS_CHANGED, read);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener(PAPER_PROGRESS_CHANGED, read);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [lessonId]);
  return { progress, setProgress, ready };
}
