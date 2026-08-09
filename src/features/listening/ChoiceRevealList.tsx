import type { LocalizedText } from "../../shared/content/getLocalizedText";
import { getLocalizedText } from "../../shared/content/getLocalizedText";
import type { SupportLang } from "../../shared/content/languageSettings";

export type RevealChoice = {
  id: string;
  text: LocalizedText;
  correct?: boolean;
  explanation?: LocalizedText;
};

type Props = {
  choices: RevealChoice[];
  selectedId: string;
  correctId: string | null;
  translationLang: SupportLang;
};

function isBareNumberLabel(s: string): boolean {
  return /^\d+$/.test(s.trim());
}

/**
 * Full answer list (JA + translation) after listening submit.
 * Used for numbers/text modes so Mondai 3/4 stil show option content when revealed.
 */
export function ChoiceRevealList({
  choices,
  selectedId,
  correctId,
  translationLang,
}: Props) {
  return (
    <ul
      className="choice-reveal-list"
      style={{ listStyle: "none", padding: 0, margin: "0.75rem 0 0" }}
    >
      {choices.map((c) => {
        const isCorrect = c.id === correctId || c.correct === true;
        const isSelected = c.id === selectedId;
        let border = "var(--border-color)";
        let bg = "var(--card-bg)";
        if (isCorrect) {
          border = "#22c55e";
          bg = "var(--diff-added-bg)";
        } else if (isSelected && !isCorrect) {
          border = "#ef4444";
          bg = "var(--diff-removed-bg)";
        }

        const ja = getLocalizedText(c.text, "ja");
        const tr = getLocalizedText(c.text, translationLang);
        const jaIsNum = isBareNumberLabel(ja || c.id);
        const displayJa = jaIsNum ? `Đáp án ${c.id}` : ja;
        const showTr =
          Boolean(tr) &&
          tr !== ja &&
          tr !== "—" &&
          tr !== displayJa;

        const badge = isCorrect
          ? "✓ Đúng"
          : isSelected
            ? "× Bạn chọn"
            : null;

        return (
          <li key={c.id} style={{ marginBottom: 10 }}>
            <div
              style={{
                width: "100%",
                textAlign: "left",
                padding: "0.85rem 1.15rem",
                borderRadius: 12,
                border: `2px solid ${border}`,
                background: bg,
                color: "var(--text-main)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 4,
                }}
              >
                <strong style={{ color: "var(--primary-color)", flexShrink: 0 }}>
                  {c.id}.
                </strong>
                {badge ? (
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: isCorrect ? "#22c55e" : "#ef4444",
                    }}
                  >
                    {badge}
                  </span>
                ) : null}
              </div>
              <div
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 600,
                  lineHeight: 1.55,
                  marginBottom: showTr ? 4 : 0,
                }}
              >
                {displayJa}
              </div>
              {showTr ? (
                <div
                  style={{
                    fontSize: "0.92rem",
                    color: "var(--text-muted)",
                    lineHeight: 1.5,
                  }}
                >
                  {tr}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
