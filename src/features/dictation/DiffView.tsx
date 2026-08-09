import type { DiffOp } from "../../shared/api/evaluate";
import { kanjiToHiragana } from "../../shared/utils/kanjiToHiragana";

export function DiffView({ ops }: { ops: DiffOp[] }) {
  return (
    <div style={{ marginTop: "1rem" }}>
      {/* Legend Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontSize: "0.85rem",
          fontWeight: 600,
          marginBottom: "0.5rem",
          color: "var(--text-muted)",
          flexWrap: "wrap",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
          Đúng
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#eab308" }} />
          Chấp nhận (hiragana/biến thể đúng theo cách đọc)
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
          Sai / thiếu
        </span>
      </div>

      {/* Main Diff Box */}
      <div
        style={{
          fontSize: "1.2rem",
          lineHeight: 2.2,
          wordBreak: "break-word",
          fontFamily:
            '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif',
          padding: "1.25rem",
          borderRadius: "12px",
          background: "var(--card-bg)",
          border: "1px solid var(--border-color)",
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
                  background: "rgba(239, 68, 68, 0.2)",
                  color: "#f87171",
                  textDecoration: "line-through",
                  padding: "2px 6px",
                  borderRadius: "6px",
                  margin: "0 2px",
                  fontSize: "1.05rem",
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
                  background: "rgba(239, 68, 68, 0.25)",
                  color: "#f87171",
                  padding: "3px 7px",
                  borderRadius: "6px",
                  margin: "0 2px",
                  fontSize: "1.05rem",
                  fontWeight: 600,
                }}
                title="Thiếu"
              >
                {op.text}
                <span style={{ fontSize: "0.75rem", opacity: 0.85, marginLeft: 4 }}>
                  (thiếu)
                </span>
              </span>
            );
          }

          // Replace operation
          const isPhoneticMatch =
            kanjiToHiragana(op.expected) === kanjiToHiragana(op.actual);

          return (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", margin: "0 4px", flexWrap: "wrap" }}>
              <span
                style={{
                  background: "rgba(34, 197, 94, 0.2)",
                  color: "#4ade80",
                  padding: "2px 6px",
                  borderRadius: "6px",
                  fontWeight: 600,
                }}
                title="Được chấp nhận"
              >
                {op.expected}
              </span>
              <span style={{ color: "var(--text-subtle)", margin: "0 4px", fontSize: "0.9rem" }}>↓</span>
              <span
                style={{
                  background: isPhoneticMatch ? "rgba(234, 179, 8, 0.25)" : "rgba(239, 68, 68, 0.25)",
                  color: isPhoneticMatch ? "#facc15" : "#f87171",
                  padding: "2px 6px",
                  borderRadius: "6px",
                  fontWeight: 600,
                }}
                title={isPhoneticMatch ? "Chấp nhận theo cách đọc" : "Chưa chính xác"}
              >
                {op.actual}
                <span style={{ fontSize: "0.75rem", opacity: 0.85, marginLeft: 4 }}>
                  {isPhoneticMatch ? "(chấp nhận)" : "(sai)"}
                </span>
              </span>
            </span>
          );
        })}
      </div>

      {/* Info Banner */}
      <div
        style={{
          marginTop: "0.75rem",
          padding: "0.6rem 0.9rem",
          borderRadius: "8px",
          background: "rgba(56, 189, 248, 0.12)",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          color: "var(--text-main)",
          fontSize: "0.85rem",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span>ℹ️</span>
        <span>
          Hiragana đúng theo cách đọc được chấp nhận, không tính là lỗi chính tả.
        </span>
      </div>
    </div>
  );
}
