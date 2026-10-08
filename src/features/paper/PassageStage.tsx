import { useState, type ReactNode } from "react";
import {
  getPassageTranslation,
  type PaperPassage,
  type PassageTranslation,
} from "../../shared/api/paper";
import type { SentenceStatus } from "../../shared/storage/paperProgressStore";
import { PassageView } from "./PassageView";
import { TranslationDrill } from "./TranslationDrill";

type Props = {
  lessonId: string;
  passage: PaperPassage;
  evidenceIds: Set<string>;
  drillReady: boolean;
  statuses: Record<string, SentenceStatus>;
  onSentenceStatus: (sentenceId: string, status: SentenceStatus) => void;
  /** The question(s) of this passage, shown beside it. */
  children: ReactNode;
};

/** A passage on the left; its question and the translation drill on the right. */
export function PassageStage({ lessonId, passage, evidenceIds, drillReady, statuses, onSentenceStatus, children }: Props) {
  const [translation, setTranslation] = useState<PassageTranslation | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [drillOpen, setDrillOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cloze = passage.kind === "cloze";

  async function loadTranslation(): Promise<PassageTranslation | null> {
    if (translation) return translation;
    setBusy(true);
    setError(null);
    try {
      const { translation: tr } = await getPassageTranslation(lessonId, passage.id);
      setTranslation(tr);
      return tr;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function toggleTranslation() {
    if (!showTranslation && !(await loadTranslation())) return;
    setShowTranslation((v) => !v);
  }

  async function openDrill() {
    // The completed Japanese text of a cloze passage comes with the translation.
    if (cloze && !(await loadTranslation())) return;
    setDrillOpen(true);
  }

  const drillSentences =
    cloze && translation
      ? translation.sentences.map((s) => ({ id: s.id, ja: s.ja }))
      : passage.sentences.map((s) => ({ id: s.id, ja: s.text }));

  return (
    <div className="paper-split">
      <div className="paper-split__passage">
        <PassageView
          passage={passage}
          evidenceIds={evidenceIds}
          translation={translation}
          showTranslation={showTranslation}
          busy={busy}
          error={error}
          drillReady={drillReady}
          drilling={drillOpen}
          onToggleTranslation={() => void toggleTranslation()}
          onOpenDrill={() => void openDrill()}
        />
      </div>
      <div className="paper-split__side">
        {children}
        {drillOpen && (
          <TranslationDrill
            lessonId={lessonId}
            sentences={drillSentences}
            statuses={statuses}
            onStatus={onSentenceStatus}
            onClose={() => setDrillOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
