import { Link } from "react-router-dom";
import type { DictEntry } from "../../shared/api/dictionary";
import { fmt } from "../../shared/i18n/format";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { SpeakButton } from "../../shared/ui/SpeakButton";
import { AddEntryButton } from "../flashcards/AddEntryButton";
import { EntryImageButton } from "../flashcards/EntryImageButton";
import { jlptLabel, miscLabel, uniquePos } from "./dictLabels";

/** Which meanings to read: both (the interface language first), or one language only. */
export type MeaningLang = "both" | "vi" | "en";

type Props = {
  entry: DictEntry;
  /** Language of the meanings and example translations; `both` unless the reader picked one. */
  meaning?: MeaningLang;
  /** Popup: the first few meanings only, no examples. */
  compact?: boolean;
  /** Headword is a link to the full dictionary page. */
  linkHeadword?: boolean;
};

const COMPACT_SENSES = 3;

/**
 * The form to show as the headword: the first kanji spelling, or the kana when there is none or when the
 * dictionary marks the word as usually written in kana ("uk", e.g. コップ rather than 洋杯).
 */
export function headwordOf(entry: DictEntry): { word: string; reading: string | null } {
  const kanji = entry.kanji.find((k) => !k.tags.some((t) => t === "sK" || t === "iK" || t === "rK"))?.text ?? entry.kanji[0]?.text;
  const reading = entry.kana[0]?.text ?? "";
  const usuallyKana = entry.senses[0]?.misc.includes("uk") ?? false;
  return kanji && !usuallyKana ? { word: kanji, reading } : { word: reading, reading: null };
}

/** One dictionary entry: headword and reading, then each meaning with its word class and notes. */
export function EntryCard({ entry, meaning = "both", compact = false, linkHeadword = false }: Props) {
  const { t, uiLang } = useUiLanguage();
  const { word, reading } = headwordOf(entry);
  const hanViet = entry.hanViet?.[word];
  const otherForms = [...entry.kanji.map((k) => k.text), ...entry.kana.map((k) => k.text)].filter(
    (f) => f !== word && f !== reading,
  );
  const senses = compact ? entry.senses.slice(0, COMPACT_SENSES) : entry.senses;
  const hiddenSenses = entry.senses.length - senses.length;
  const vietnameseFirst = meaning === "vi" || (meaning === "both" && uiLang === "vi");
  const oneLanguage = meaning !== "both";

  return (
    <article className={`dict-entry${compact ? " dict-entry--compact" : ""}`}>
      <header className="dict-entry__head">
        <div className="dict-entry__word">
          {reading && <span className="dict-entry__reading jp" lang="ja">{reading}</span>}
          <div className="dict-entry__line">
            {linkHeadword ? (
              <Link className="dict-entry__headword jp" lang="ja" to={`/dictionary?q=${encodeURIComponent(word)}&lang=ja`}>
                {word}
              </Link>
            ) : (
              <strong className="dict-entry__headword jp" lang="ja">{word}</strong>
            )}
            <SpeakButton text={reading || word} />
            {hanViet && (
              <span className="dict-entry__hv" title={t("dict.hanViet")}>{hanViet}</span>
            )}
          </div>
        </div>
        <div className="dict-entry__badges">
          {entry.jlpt && <span className={`dict-badge dict-badge--n${entry.jlpt}`}>{jlptLabel(entry.jlpt)}</span>}
          {entry.common && <span className="dict-badge dict-badge--common">{t("dict.common")}</span>}
          <EntryImageButton entry={entry} meaning={meaning} />
          <AddEntryButton entry={entry} meaning={meaning} />
        </div>
      </header>

      {!compact && otherForms.length > 0 && (
        <p className="dict-entry__forms">
          <span>{t("dict.otherForms")}:</span> <span className="jp" lang="ja">{otherForms.slice(0, 8).join("、")}</span>
        </p>
      )}

      <ol className="dict-senses">
        {senses.map((s, i) => {
          const hasVi = s.vi.length > 0;
          const english = s.glosses.join("; ");
          const vietnamese = s.vi.join("; ");
          const notes = [...s.misc, ...s.field].map((c) => miscLabel(c, uiLang));
          const first = vietnameseFirst ? (hasVi ? vietnamese : english) : english;
          // One language only: English stands in just for a word that has no Vietnamese yet.
          const second = oneLanguage ? "" : vietnameseFirst ? (hasVi ? english : "") : hasVi ? vietnamese : "";
          const samePos = i > 0 && s.pos.join() === senses[i - 1]!.pos.join();
          return (
            <li key={i} className="dict-sense">
              {!samePos && (
                <p className="dict-sense__pos">
                  {uniquePos(s.pos, uiLang).join(" · ")}
                </p>
              )}
              <p className="dict-sense__main">
                {first}
                {vietnameseFirst && !hasVi && !compact && <em className="dict-sense__missing"> · {t("dict.noVi")}</em>}
              </p>
              {second && <p className="dict-sense__second">{second}</p>}
              {(notes.length > 0 || s.appliesToKanji || s.info.length > 0) && !compact && (
                <p className="dict-sense__notes">
                  {notes.map((n) => (
                    <span key={n} className="dict-tag">{n}</span>
                  ))}
                  {s.appliesToKanji && (
                    <span className="dict-tag jp" lang="ja">{fmt(t("dict.appliesTo"), { forms: s.appliesToKanji.join("、") })}</span>
                  )}
                  {s.info.map((info) => (
                    <span key={info} className="dict-note">{info}</span>
                  ))}
                </p>
              )}
              {!compact && s.examples.length > 0 && (
                <ul className="dict-examples" aria-label={t("dict.examples")}>
                  {s.examples.map((x, k) => (
                    <li key={k}>
                      <span className="dict-examples__ja">
                        <span className="jp" lang="ja">{x.ja}</span>
                        <SpeakButton text={x.ja} />
                      </span>
                      {vietnameseFirst && x.vi && <span className="dict-examples__vi">{x.vi}</span>}
                      {(!oneLanguage || !vietnameseFirst || !x.vi) && <span className="dict-examples__en">{x.en}</span>}
                      {!vietnameseFirst && !oneLanguage && x.vi && <span className="dict-examples__vi">{x.vi}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
      {hiddenSenses > 0 && <p className="dict-entry__more">+{hiddenSenses}</p>}
    </article>
  );
}
