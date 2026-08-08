import type { PracticeChoice } from "../../shared/api/content";
import { getLocalizedText } from "../../shared/content/getLocalizedText";

type Props = {
  choices: PracticeChoice[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
  /** After submit */
  reveal?: {
    correctId: string | null;
    selectedId: string;
  };
};

export function TextChoiceList({
  choices,
  selectedId,
  onSelect,
  disabled,
  reveal,
}: Props) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
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
        return (
          <li key={c.id} style={{ marginBottom: 10 }}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(c.id)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "0.85rem 1.25rem",
                borderRadius: 12,
                border: `2px solid ${border}`,
                background: bg,
                color: textColor,
                cursor: disabled ? "default" : "pointer",
                fontSize: "1.05rem",
                fontFamily: "inherit",
                fontWeight: 500,
                transition: "all 0.2s ease",
              }}
            >
              <strong style={{ marginRight: 10, color: "var(--primary-color)" }}>{c.id}.</strong>
              {getLocalizedText(c.text, "ja")}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
