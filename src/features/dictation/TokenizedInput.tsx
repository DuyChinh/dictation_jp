import { useEffect, useMemo, useRef, useState } from "react";
import type { DictationEvalResult } from "../../shared/api/evaluate";

type TokenizedInputProps = {
  expectedText: string;
  mode: "full" | "medium" | "hard";
  phase: "editing" | "checked";
  onAnswerChange: (answer: string) => void;
  result: DictationEvalResult | null;
};

type Token = {
  id: string;
  originalText: string;
  isWord: boolean;
  isHidden: boolean;
};

export function TokenizedInput({
  expectedText,
  mode,
  phase,
  onAnswerChange,
  result,
}: TokenizedInputProps) {
  // 1. Tokenize expectedText using Intl.Segmenter
  const tokens = useMemo(() => {
    try {
      const segmenter = new Intl.Segmenter("ja", { granularity: "word" });
      const segments = Array.from(segmenter.segment(expectedText));
      
      const wordsCount = segments.filter((s) => s.isWordLike).length;
      let hideCount = wordsCount;
      if (mode === "medium") hideCount = Math.floor(wordsCount * 0.3);
      if (mode === "hard") hideCount = Math.floor(wordsCount * 0.6);

      // Randomly select which word indices to hide for medium/hard
      // In full mode, all words are hidden.
      const wordIndices = segments
        .map((s, i) => (s.isWordLike ? i : -1))
        .filter((i) => i !== -1);
      
      // Shuffle word indices for random hiding
      const shuffled = [...wordIndices].sort(() => Math.random() - 0.5);
      const hiddenIndices = new Set(shuffled.slice(0, hideCount));

      return segments.map((s, idx) => ({
        id: `t_${idx}`,
        originalText: s.segment,
        isWord: !!s.isWordLike,
        isHidden: mode === "full" ? !!s.isWordLike : hiddenIndices.has(idx),
      }));
    } catch {
      // Fallback if Intl.Segmenter is not available (e.g. older browser)
      return [
        {
          id: "t_0",
          originalText: expectedText,
          isWord: true,
          isHidden: true,
        },
      ];
    }
  }, [expectedText, mode]);

  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Reset inputs when text or mode changes
  useEffect(() => {
    setInputValues({});
  }, [tokens]);

  // Aggregate the full string whenever inputs change
  useEffect(() => {
    const fullText = tokens
      .map((t) => (t.isHidden ? inputValues[t.id] || "" : t.originalText))
      .join("");
    onAnswerChange(fullText);
  }, [inputValues, tokens, onAnswerChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    const isNavigationKey = e.key === " " || e.key === "Tab" || e.key === "ArrowRight" || e.key === "ArrowLeft";
    
    // Prevent default scrolling for Space
    if (e.key === " ") e.preventDefault();

    if (isNavigationKey && phase === "editing") {
      e.preventDefault();
      const direction = (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey)) ? -1 : 1;
      
      // Find the next hidden token input
      let nextIdx = idx + direction;
      while (nextIdx >= 0 && nextIdx < tokens.length) {
        if (tokens[nextIdx].isHidden) {
          inputRefs.current[tokens[nextIdx].id]?.focus();
          break;
        }
        nextIdx += direction;
      }
    }
  };

  // Compute validation results for individual words if we are checked
  // We can't perfectly map a monolithic Diff to individual inputs if they misaligned,
  // but if the input value strictly matches the expected word, it's correct.
  const checkTokenStatus = (t: Token) => {
    if (phase === "editing") return null;
    const val = inputValues[t.id] || "";
    // If it was forced to reveal or it's correct
    if (result?.revealed) return "revealed";
    if (val === t.originalText) return "correct";
    return "incorrect";
  };

  return (
    <div className="tokenized-container">
      {tokens.map((t, idx) => {
        if (!t.isHidden) {
          return (
            <span key={t.id} className="token-static">
              {t.originalText}
            </span>
          );
        }

        const val = inputValues[t.id] || "";
        const status = checkTokenStatus(t);
        const isIncorrect = status === "incorrect" || status === "revealed";

        // Calculate dynamic width based on the maximum of expected length or typed length
        const charCount = Math.max(t.originalText.length, val.length || 1);
        const width = `${Math.max(2, charCount * 1.5)}rem`;

        return (
          <div key={t.id} className="token-word">
            {status === "revealed" && (
              <div className="token-reveal-correct">{t.originalText}</div>
            )}
            
            <input
              ref={(el) => { inputRefs.current[t.id] = el; }}
              type="text"
              value={val}
              disabled={phase === "checked" && !result?.revealed}
              onChange={(e) => {
                if (phase === "checked") return;
                setInputValues((prev) => ({ ...prev, [t.id]: e.target.value }));
              }}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`token-input ${isIncorrect ? "incorrect" : ""}`}
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
