import type { PracticeChoice } from "../../shared/api/content";
import { getLocalizedText } from "../../shared/content/getLocalizedText";

type Props = {
  choices: PracticeChoice[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
  /** After submit: show full labels when available */
  revealLabels?: boolean;
  reveal?: {
    correctId: string | null;
    selectedId: string;
  };
};

/**
 * JLPT ○1 ○2 ○3 style — number chips until reveal; optional full text after.
 */
export function NumberChoiceList({
  choices,
  selectedId,
  onSelect,
  disabled,
  revealLabels,
  reveal,
}: Props) {
  return (
    <ul className="number-choice-list" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
      {choices.map((c) => {
        const selected = selectedId === c.id;
        let border = selected ? "var(--primary-color)" : "var(--border-color)";
        let bg = selected ? "var(--primary-light)" : "var(--card-bg)";
        let textColor = "var(--text-main)";
        if (reveal) {
          if (c.id === reveal.correctId) {
            border = "#22c55e";
            bg = "var(--diff-added-bg)";
            textColor = "var(--diff-added-text)";
          } else if (c.id === reveal.selectedId && c.id !== reveal.correctId) {
            border = "#ef4444";
            bg = "var(--diff-removed-bg)";
            textColor = "var(--diff-removed-text)";
          }
        }
        const label = getLocalizedText(c.text, "ja");
        // Prefer pure number glyph for exam-like UI; fall back to id
        const numLabel = /^\d+$/.test(label.trim()) ? label.trim() : c.id;
        const showFull = Boolean(revealLabels && label && label !== numLabel && label !== "—");

        return (
          <li key={c.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(c.id)}
              className="number-choice-btn"
              aria-pressed={selected}
              style={{
                minWidth: "var(--touch-min)",
                minHeight: "var(--touch-min)",
                padding: showFull ? "0.75rem 1.1rem" : "0.65rem 1.15rem",
                borderRadius: 999,
                border: `2px solid ${border}`,
                background: bg,
                color: textColor,
                cursor: disabled ? "default" : "pointer",
                fontSize: "1.1rem",
                fontWeight: 700,
                fontFamily: "inherit",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span aria-hidden>{selected || reveal ? "◉" : "◯"}</span>
              <span>{numLabel}</span>
              {showFull ? (
                <span style={{ fontWeight: 500, fontSize: "0.95rem" }}>{label}</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
