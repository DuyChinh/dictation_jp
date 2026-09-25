import type { PracticeChoice } from "../../shared/api/content";
import type { LocalizedText } from "../../shared/content/getLocalizedText";
import type { SupportLang } from "../../shared/content/languageSettings";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { Icon } from "../../shared/ui/Icon";
import { isBareNumber, textOf } from "./listeningUnits";

export type RevealChoice = { id: string; text: LocalizedText };

type Props = {
  choices: PracticeChoice[];
  /** "numbers": exam-style number buttons until reveal (問題3–5). */
  mode: "text" | "numbers";
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** After answering: full texts from the evaluation plus which is right / picked. */
  reveal?: {
    correctId: string | null;
    selectedId: string;
    choices: RevealChoice[];
  };
  translationLang: SupportLang;
  label: string;
};

/**
 * Answer options for one listening question. Before answering, every option
 * is selectable; afterwards the right one and the learner's pick are marked,
 * with the translation under each option.
 */
export function ChoiceCards({ choices, mode, selectedId, onSelect, reveal, translationLang, label }: Props) {
  const { t } = useUiLanguage();

  if (!reveal && mode === "numbers") {
    return (
      <div className="num-choices" role="radiogroup" aria-label={label}>
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={selectedId === c.id}
            className={`num-choice${selectedId === c.id ? " is-selected" : ""}`}
            onClick={() => onSelect(c.id)}
          >
            {c.id}
          </button>
        ))}
      </div>
    );
  }

  const list: RevealChoice[] = reveal
    ? choices.map((c) => reveal.choices.find((r) => r.id === c.id) ?? c)
    : choices;

  return (
    <div
      className={`choice-grid${list.length === 4 ? " choice-grid--2" : ""}`}
      role="radiogroup"
      aria-label={label}
    >
      {list.map((c) => {
        const ja = textOf(c.text, "ja");
        const showJa = ja && ja !== "—" && !isBareNumber(ja);
        const tr = textOf(c.text, translationLang);
        const showTr = reveal && showJa && tr && tr !== ja && tr !== "—";
        const isCorrect = !!reveal && c.id === reveal.correctId;
        const isWrongPick = !!reveal && c.id === reveal.selectedId && !isCorrect;
        const state = isCorrect
          ? " is-correct"
          : isWrongPick
            ? " is-wrong"
            : reveal
              ? " is-dim"
              : selectedId === c.id
                ? " is-selected"
                : "";
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={reveal ? c.id === reveal.selectedId : selectedId === c.id}
            aria-disabled={reveal ? true : undefined}
            className={`choice-card${state}`}
            onClick={() => {
              if (!reveal) onSelect(c.id);
            }}
          >
            <span className="choice-card__no">{c.id}</span>
            <span className="choice-card__body">
              {isCorrect && (
                <span className="choice-tag choice-tag--ok">
                  <Icon name="check" size={13} strokeWidth={3} />
                  {t("listening.tagAnswer")}
                </span>
              )}
              {isWrongPick && (
                <span className="choice-tag choice-tag--bad">
                  <Icon name="close" size={13} strokeWidth={3} />
                  {t("listening.tagYours")}
                </span>
              )}
              <span className="choice-card__ja jp">{showJa ? ja : `${t("listening.option")} ${c.id}`}</span>
              {showTr && <span className="choice-card__tr">{tr}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
