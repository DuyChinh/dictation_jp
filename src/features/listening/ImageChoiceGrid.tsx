import { useState } from "react";
import type { PracticeChoice } from "../../shared/api/content";
import { getLocalizedText } from "../../shared/content/getLocalizedText";

type Props = {
  choices: PracticeChoice[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
  reveal?: {
    correctId: string | null;
    selectedId: string;
  };
};

export function ImageChoiceGrid({
  choices,
  selectedId,
  onSelect,
  disabled,
  reveal,
}: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 12,
      }}
    >
      {choices.map((c) => (
        <ImageChoiceCard
          key={c.id}
          choice={c}
          selected={selectedId === c.id}
          disabled={disabled}
          reveal={reveal}
          onSelect={() => onSelect(c.id)}
        />
      ))}
    </div>
  );
}

function ImageChoiceCard({
  choice,
  selected,
  disabled,
  reveal,
  onSelect,
}: {
  choice: PracticeChoice;
  selected: boolean;
  disabled?: boolean;
  reveal?: { correctId: string | null; selectedId: string };
  onSelect: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const [loading, setLoading] = useState(true);
  const caption = getLocalizedText(choice.text, "ja");
  const alt = getLocalizedText(choice.image?.alt ?? choice.text, "ja") || caption;

  let border = selected ? "#2f5d50" : "#c5cfc8";
  let ring = selected ? "0 0 0 2px #2f5d50" : "none";
  if (reveal) {
    if (choice.id === reveal.correctId) {
      border = "#1b5e20";
      ring = "0 0 0 2px #1b5e20";
    } else if (
      choice.id === reveal.selectedId &&
      choice.id !== reveal.correctId
    ) {
      border = "#8b2942";
      ring = "0 0 0 2px #8b2942";
    }
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-label={`${choice.id}. ${alt}`}
      style={{
        border: `2px solid ${border}`,
        boxShadow: ring,
        borderRadius: 12,
        padding: 8,
        background: "#fff",
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        fontFamily: "inherit",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1",
          background: "#f0f3f1",
          borderRadius: 8,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {choice.image?.url && !imgError ? (
          <>
            {loading && (
              <span style={{ position: "absolute", fontSize: 12, color: "#889" }}>
                Loading…
              </span>
            )}
            <img
              src={choice.image.url}
              alt={alt}
              onLoad={() => setLoading(false)}
              onError={() => {
                setImgError(true);
                setLoading(false);
              }}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                opacity: loading ? 0 : 1,
              }}
            />
          </>
        ) : (
          <span style={{ padding: 8, fontSize: "0.9rem", textAlign: "center" }}>
            {caption}
          </span>
        )}
      </div>
      <div style={{ fontSize: "0.85rem", textAlign: "left" }}>
        <strong>{choice.id}.</strong> {caption}
      </div>
    </button>
  );
}
