import { useEffect, useMemo, useRef, useState } from "react";
import type { DictationEvalResult } from "../../shared/api/evaluate";

type TokenizedInputProps = {
  expectedText: string;
  mode: "full" | "medium" | "hard";
  phase: "editing" | "checked";
  onAnswerChange: (answer: string) => void;
  result: DictationEvalResult | null;
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

  // Reset inputs when blocks change
  useEffect(() => {
    setInputValues({});
  }, [blocks]);

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
        const isCorrect = phase === "checked" && val.trim() === b.expectedText.trim();
        const isIncorrect = phase === "checked" && !isCorrect;

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
              className={`token-input ${isIncorrect || (isRevealed && !isCorrect) ? "incorrect" : ""}`}
              style={{ width }}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        );
      })}
    </div>
  );
}
