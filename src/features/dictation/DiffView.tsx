import type { DiffOp } from "../../shared/api/evaluate";

export function DiffView({ ops }: { ops: DiffOp[] }) {
  return (
    <div
      style={{
        fontSize: "1.2rem",
        lineHeight: 2,
        wordBreak: "break-word",
        fontFamily:
          '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif',
        padding: "1rem",
        borderRadius: "12px",
        background: "var(--card-bg)",
        border: "1px solid var(--border-color)",
        marginTop: "1rem",
      }}
      aria-label="So sánh đáp án"
    >
      {ops.map((op, i) => {
        if (op.type === "equal") {
          return (
            <span key={i} style={{ color: "var(--diff-equal)" }}>
              {op.text}
            </span>
          );
        }
        if (op.type === "insert") {
          return (
            <span
              key={i}
              style={{
                background: "var(--diff-removed-bg)",
                color: "var(--diff-removed-text)",
                textDecoration: "line-through",
                padding: "2px 4px",
                borderRadius: "4px",
                margin: "0 1px",
              }}
              title="Thừa"
            >
              {op.text}
            </span>
          );
        }
        if (op.type === "delete") {
          return (
            <span
              key={i}
              style={{
                background: "var(--diff-added-bg)",
                color: "var(--diff-added-text)",
                padding: "2px 4px",
                borderRadius: "4px",
                margin: "0 1px",
              }}
              title="Thiếu"
            >
              {op.text}
            </span>
          );
        }
        return (
          <span key={i} style={{ display: "inline-block", margin: "0 3px" }}>
            <span
              style={{
                background: "var(--diff-added-bg)",
                color: "var(--diff-added-text)",
                padding: "2px 4px",
                borderRadius: "4px",
              }}
              title="Đúng"
            >
              [{op.expected}]
            </span>
            <span style={{ color: "var(--text-subtle)", margin: "0 4px" }}>↓</span>
            <span
              style={{
                background: "var(--diff-removed-bg)",
                color: "var(--diff-removed-text)",
                padding: "2px 4px",
                borderRadius: "4px",
              }}
              title="Bạn gõ"
            >
              [{op.actual}]
            </span>
          </span>
        );
      })}
    </div>
  );
}
