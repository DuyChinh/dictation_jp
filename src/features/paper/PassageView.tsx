import { useState } from "react";
import {
  getPassageTranslation,
  type PaperPassage,
  type PassageTranslation,
} from "../../shared/api/paper";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import type { SentenceStatus } from "../../shared/storage/paperProgressStore";
import { Icon } from "../../shared/ui/Icon";
import { TranslationDrill } from "./TranslationDrill";

type Props = {
  lessonId: string;
  passage: PaperPassage;
  /** Sentences that justify the answers already given; highlighted in the text. */
  evidenceIds: Set<string>;
  /** Cloze passages hide their answers, so they only open the drill once every blank is answered. */
  drillReady: boolean;
  statuses: Record<string, SentenceStatus>;
  onSentenceStatus: (sentenceId: string, status: SentenceStatus) => void;
};

type Block = { label?: string; paragraphs: PaperPassage["sentences"][] };

/** Group sentences into labelled texts (A / B) and paragraphs, and collect footnotes. */
function layoutBlocks(passage: PaperPassage): { blocks: Block[]; footnotes: string[] } {
  const blocks: Block[] = [{ paragraphs: [[]] }];
  const footnotes: string[] = [];
  for (const s of passage.sentences) {
    const note = s.notes?.trim();
    let current = blocks[blocks.length - 1]!;
    if (note && /^[AB]$/.test(note)) {
      if (current.label !== note) {
        if (current.paragraphs.every((p) => p.length === 0)) current.label = note;
        else {
          current = { label: note, paragraphs: [[]] };
          blocks.push(current);
        }
      }
    } else if (note) {
      const paragraph = note.startsWith("¶");
      const rest = paragraph ? note.replace(/^¶\d*\s*/, "") : note;
      if (paragraph && current.paragraphs[current.paragraphs.length - 1]!.length > 0) current.paragraphs.push([]);
      if (rest) footnotes.push(rest);
    }
    current.paragraphs[current.paragraphs.length - 1]!.push(s);
  }
  return { blocks, footnotes };
}

/** A reading passage as printed, with on-demand translation and the sentence-by-sentence drill. */
export function PassageView({ lessonId, passage, evidenceIds, drillReady, statuses, onSentenceStatus }: Props) {
  const { t } = useUiLanguage();
  const [translation, setTranslation] = useState<PassageTranslation | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [drillOpen, setDrillOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cloze = passage.kind === "cloze";
  const { blocks, footnotes } = layoutBlocks(passage);
  const viOf = new Map(translation?.sentences.map((s) => [s.id, s.vi]) ?? []);

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
  const evidence = passage.sentences.filter((s) => evidenceIds.has(s.id));

  return (
    <section className="paper-passage" aria-label={t("paper.passage")}>
      {passage.title_ja && <h3 className="paper-passage__title jp">{passage.title_ja}</h3>}

      {passage.layout_ja ? (
        <>
          <pre className="paper-layout jp" lang="ja">
            {passage.layout_ja}
          </pre>
          {evidence.length > 0 && (
            <div className="paper-evidence">
              <strong>{t("paper.evidence")}</strong>
              <ul>
                {evidence.map((s) => (
                  <li key={s.id} className="jp" lang="ja">
                    {s.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : showTranslation ? (
        <ol className="paper-bilingual">
          {passage.sentences.map((s) => (
            <li key={s.id} className={evidenceIds.has(s.id) ? "is-evidence" : ""}>
              <span className="jp" lang="ja">
                {s.text}
              </span>
              <span className="paper-bilingual__vi">{viOf.get(s.id)}</span>
            </li>
          ))}
        </ol>
      ) : (
        blocks.map((b, bi) => (
          <div key={bi} className="paper-text">
            {b.label && <p className="paper-text__label">{b.label}</p>}
            {b.paragraphs.map((p, pi) => (
              <p key={pi} className="jp" lang="ja">
                {p.map((s) => (
                  <span key={s.id} className={evidenceIds.has(s.id) ? "is-evidence" : undefined}>
                    {s.text}
                  </span>
                ))}
              </p>
            ))}
          </div>
        ))
      )}

      {footnotes.length > 0 && !showTranslation && (
        <ul className="paper-footnotes jp">
          {footnotes.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      )}

      <div className="paper-passage__tools">
        <button type="button" className="btn btn--outline btn--sm" onClick={() => void toggleTranslation()} disabled={busy}>
          <Icon name="globe" size={16} />
          {showTranslation ? t("paper.hideTranslation") : t("paper.showTranslation")}
        </button>
        <button
          type="button"
          className="btn btn--soft btn--sm"
          onClick={() => void openDrill()}
          disabled={busy || !drillReady}
          title={drillReady ? undefined : t("paper.drillLocked")}
        >
          <Icon name="pencil" size={16} />
          {t("paper.drill")}
        </button>
        {!drillReady && <small>{t("paper.drillLocked")}</small>}
      </div>
      {error && (
        <div className="notice notice--error" role="alert">
          <Icon name="alert" />
          {error}
        </div>
      )}
      {drillOpen && (
        <TranslationDrill
          lessonId={lessonId}
          sentences={drillSentences}
          statuses={statuses}
          onStatus={onSentenceStatus}
          onClose={() => setDrillOpen(false)}
        />
      )}
    </section>
  );
}
