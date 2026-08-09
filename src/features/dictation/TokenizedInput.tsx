import { useEffect, useMemo, useRef, useState } from "react";
import type { DictationEvalResult } from "../../shared/api/evaluate";
import { kanjiToHiragana, getReadingMappings } from "../../shared/utils/kanjiToHiragana";

type TokenizedInputProps = {
  expectedText: string;
  mode: "full" | "medium" | "hard";
  phase: "editing" | "checked";
  onAnswerChange: (answer: string) => void;
  result: DictationEvalResult | null;
  resetKey?: number;
};

type Block =
  | { type: "static"; key: string; text: string }
  | { type: "input"; key: string; expectedText: string };

export function TokenizedInput({
  expectedText,
  mode,
  phase,
  onAnswerChange,
  result,
  resetKey = 0,
}: TokenizedInputProps) {
  // 1. Tokenize expectedText and group contiguous hidden tokens into single input blocks
  const blocks = useMemo(() => {
    try {
      const segmenter = new Intl.Segmenter("ja", { granularity: "word" });
      const segments = Array.from(segmenter.segment(expectedText));

      const wordsCount = segments.filter((s) => s.isWordLike).length;
      let hideCount = wordsCount;
      if (mode === "medium") hideCount = Math.floor(wordsCount * 0.3);
      if (mode === "hard") hideCount = Math.floor(wordsCount * 0.6);

      const wordIndices = segments
        .map((s, i) => (s.isWordLike ? i : -1))
        .filter((i) => i !== -1);

      const shuffled = [...wordIndices].sort(() => Math.random() - 0.5);
      const hiddenIndices = new Set(shuffled.slice(0, hideCount));

      const tokens = segments.map((s, idx) => ({
        text: s.segment,
        isWord: !!s.isWordLike,
        isHidden: mode === "full" ? !!s.isWordLike : hiddenIndices.has(idx),
      }));

      // Group contiguous tokens into blocks
      const resultBlocks: Block[] = [];
      let currentBlock: { isHidden: boolean; texts: string[] } | null = null;

      tokens.forEach((t) => {
        if (!currentBlock) {
          currentBlock = { isHidden: t.isHidden, texts: [t.text] };
        } else if (currentBlock.isHidden === t.isHidden) {
          currentBlock.texts.push(t.text);
        } else {
          const joined = currentBlock.texts.join("");
          if (currentBlock.isHidden) {
            resultBlocks.push({
              type: "input",
              key: `b_${resultBlocks.length}`,
              expectedText: joined,
            });
          } else {
            resultBlocks.push({
              type: "static",
              key: `b_${resultBlocks.length}`,
              text: joined,
            });
          }
          currentBlock = { isHidden: t.isHidden, texts: [t.text] };
        }
      });

      if (currentBlock) {
        const joined = (currentBlock as { isHidden: boolean; texts: string[] }).texts.join("");
        if ((currentBlock as { isHidden: boolean; texts: string[] }).isHidden) {
          resultBlocks.push({
            type: "input",
            key: `b_${resultBlocks.length}`,
            expectedText: joined,
          });
        } else {
          resultBlocks.push({
            type: "static",
            key: `b_${resultBlocks.length}`,
            text: joined,
          });
        }
      }

      return resultBlocks;
    } catch {
      return [
        {
          type: "input" as const,
          key: "b_0",
          expectedText,
        },
      ];
    }
  }, [expectedText, mode]);

  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Reset inputs when blocks or resetKey change
  useEffect(() => {
    setInputValues({});
  }, [blocks, resetKey]);

  // Aggregate full answer string whenever inputValues or blocks change
  useEffect(() => {
    const fullText = blocks
      .map((b) => (b.type === "input" ? inputValues[b.key] || "" : b.text))
      .join("");
    onAnswerChange(fullText);
  }, [inputValues, blocks, onAnswerChange]);

  const inputBlocks = useMemo(
    () => blocks.filter((b): b is Extract<Block, { type: "input" }> => b.type === "input"),
    [blocks]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentKey: string) => {
    const isNavKey = e.key === "Tab" || e.key === "Enter";

    if (isNavKey && phase === "editing") {
      e.preventDefault();
      const currentIndex = inputBlocks.findIndex((b) => b.key === currentKey);
      const direction = e.shiftKey ? -1 : 1;
      const nextBlock = inputBlocks[currentIndex + direction];
      if (nextBlock) {
        inputRefs.current[nextBlock.key]?.focus();
      }
    }
  };

  return (
    <div className="tokenized-container">
      {blocks.map((b) => {
        if (b.type === "static") {
          return (
            <span key={b.key} className="token-static">
              {b.text}
            </span>
          );
        }

        const val = inputValues[b.key] || "";
        const isRevealed = !!result?.revealed;
        
        // Validation statuses
        const isExactCorrect = phase === "checked" && val.trim() === b.expectedText.trim();
        const isAcceptedReading =
          phase === "checked" &&
          !isExactCorrect &&
          val.trim().length > 0 &&
          kanjiToHiragana(val.trim()) === kanjiToHiragana(b.expectedText.trim());
        const isEmptyMissing = phase === "checked" && val.trim().length === 0;
        const isIncorrect = phase === "checked" && !isExactCorrect && !isAcceptedReading;

        // Reading mappings if accepted reading
        const mappings = isAcceptedReading ? getReadingMappings(b.expectedText, val) : [];

        // Dynamic width calculated from expected length or input length
        const charCount = Math.max(b.expectedText.length, val.length || 1);
        const width = `${Math.max(4, charCount * 1.5)}rem`;

        return (
          <div key={b.key} className="token-word">
            {isRevealed && (
              <div className="token-reveal-correct">{b.expectedText}</div>
            )}

            <input
              ref={(el) => {
                inputRefs.current[b.key] = el;
              }}
              type="text"
              value={val}
              disabled={phase === "checked" && !isRevealed}
              onChange={(e) => {
                if (phase === "checked") return;
                setInputValues((prev) => ({ ...prev, [b.key]: e.target.value }));
              }}
              onKeyDown={(e) => handleKeyDown(e, b.key)}
              className={`token-input ${
                isIncorrect || (isRevealed && !isExactCorrect && !isAcceptedReading)
                  ? "incorrect"
                  : isAcceptedReading
                  ? "accepted-reading"
                  : ""
              }`}
              style={{ width }}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
            />

            {/* Badges in Checked Phase */}
            {phase === "checked" && (
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                {isAcceptedReading && (
                  <>
                    <span
                      style={{
                        background: "rgba(234, 179, 8, 0.25)",
                        border: "1px solid rgba(234, 179, 8, 0.4)",
                        color: "#facc15",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      ✔ Chấp nhận theo cách đọc
                    </span>
                    {mappings.length > 0 && (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
                        {mappings.map((m, i) => (
                          <span
                            key={i}
                            style={{
                              background: "rgba(255, 255, 255, 0.08)",
                              border: "1px solid rgba(234, 179, 8, 0.3)",
                              color: "#fef08a",
                              padding: "1px 6px",
                              borderRadius: "6px",
                              fontSize: "0.72rem",
                            }}
                          >
                            {m.hiragana} → {m.kanji}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {isEmptyMissing && (
                  <span
                    style={{
                      background: "rgba(239, 68, 68, 0.25)",
                      border: "1px solid rgba(239, 68, 68, 0.4)",
                      color: "#f87171",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    ✖ Thiếu
                  </span>
                )}

                {isIncorrect && !isEmptyMissing && (
                  <span
                    style={{
                      background: "rgba(239, 68, 68, 0.25)",
                      border: "1px solid rgba(239, 68, 68, 0.4)",
                      color: "#f87171",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    ✖ Sai
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
