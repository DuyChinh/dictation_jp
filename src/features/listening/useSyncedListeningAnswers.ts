import { useEffect, useState } from "react";
import {
  getListeningAnswers,
  syncListeningAnswersFromServer,
  type ListeningAnswer,
} from "../../shared/storage/listeningScoreStore";

/** A lesson's listening answers: this browser's at once, then merged with the account's. */
export function useSyncedListeningAnswers(lessonId: string) {
  const [answers, setAnswers] = useState<Record<string, ListeningAnswer>>(() => getListeningAnswers(lessonId));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setAnswers(getListeningAnswers(lessonId));
    void syncListeningAnswersFromServer(lessonId).then((merged) => {
      if (cancelled) return;
      setAnswers(merged);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  return { answers, ready };
}
