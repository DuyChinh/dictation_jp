import type { PaperPassage, PassageTranslation } from "../../shared/api/paper";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { Icon } from "../../shared/ui/Icon";

type Props = {
  passage: PaperPassage;
  /** Sentences that justify the answers already given; highlighted in the text. */
  evidenceIds: Set<string>;
  translation: PassageTranslation | null;
  showTranslation: boolean;
  busy: boolean;
  error: string | null;
  /** Cloze passages hide their answers, so the drill opens only once every blank is answered. */
  drillReady: boolean;
  drilling: boolean;
  onToggleTranslation: () => void;
  onOpenDrill: () => void;
  /** Exam room: just the text, with no translation or drill. */
  plain?: boolean;
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
      if (rest) footnotes.push(...rest.split(/\s*(?=（注\d*）)/).filter(Boolean));
    }
    current.paragraphs[current.paragraphs.length - 1]!.push(s);
  }
  return { blocks, footnotes };
}

/** A reading passage as printed, with on-demand translation. The drill itself lives beside the question. */
export function PassageView({
  passage,
  evidenceIds,
  translation,
  showTranslation,
  busy,
  error,
  drillReady,
  drilling,
  onToggleTranslation,
  onOpenDrill,
  plain = false,
}: Props) {
  const { t } = useUiLanguage();
  const { blocks, footnotes } = layoutBlocks(passage);
  const viOf = new Map(translation?.sentences.map((s) => [s.id, s.vi]) ?? []);
  const noteViOf = new Map(translation?.sentences.map((s) => [s.id, s.notes_vi]) ?? []);
  const evidence = passage.sentences.filter((s) => evidenceIds.has(s.id));

  return (
    <section className="paper-passage" aria-label={t("paper.passage")}>
      <div className="paper-passage__sheet">
        {(passage.title_ja || evidenceIds.size > 0) && (
          <div className="paper-passage__top">
            {passage.title_ja ? <h3 className="paper-passage__title jp">{passage.title_ja}</h3> : <span />}
            {evidenceIds.size > 0 && (
              <span className="paper-legend">
                <i aria-hidden="true" />
                {t("paper.legendEvidence")}
              </span>
            )}
          </div>
        )}

        {passage.layout_ja ? (
          <>
            <pre className="paper-layout jp" lang="ja">
              {passage.layout_ja}
            </pre>
            {evidence.length > 0 && (
              <ul className="paper-evidence">
                {evidence.map((s) => (
                  <li key={s.id} className="jp" lang="ja">
                    {s.text}
                  </li>
                ))}
              </ul>
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
                {noteViOf.get(s.id) && <small className="paper-bilingual__note">{noteViOf.get(s.id)}</small>}
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
          <ul className="paper-footnotes jp" lang="ja">
            {footnotes.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        )}
      </div>

      {!plain && (
      <div className="paper-passage__tools">
        <button type="button" className="paper-outline" onClick={onToggleTranslation} disabled={busy}>
          <Icon name="globe" size={18} />
          {showTranslation ? t("paper.hideTranslation") : t("paper.showTranslation")}
        </button>
        {drilling ? (
          <span className="paper-chip-on">
            <Icon name="pencil" size={18} />
            {t("paper.drilling")}
          </span>
        ) : (
          <button
            type="button"
            className="paper-soft"
            onClick={onOpenDrill}
            disabled={busy || !drillReady}
            title={drillReady ? undefined : t("paper.drillLocked")}
          >
            <Icon name="pencil" size={18} />
            {t("paper.drill")}
          </button>
        )}
      </div>
      )}
      {!plain && !drillReady && <small className="paper-passage__locked">{t("paper.drillLocked")}</small>}
      {error && (
        <div className="notice notice--error" role="alert">
          <Icon name="alert" />
          {error}
        </div>
      )}
    </section>
  );
}
