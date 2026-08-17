import type { DiffOp } from "../../shared/api/evaluate";
import { kanjiToHiragana } from "../../shared/utils/kanjiToHiragana";

type SubOp =
  | { type: "equal"; text: string }
  | { type: "replace"; expected: string; actual: string }
  | { type: "delete"; text: string }
  | { type: "insert"; text: string };

function diffHiraganaSubChars(expected: string, actual: string): {
  isPhoneticMatch: boolean;
  subOps: SubOp[] | null;
} {
  const hExp = kanjiToHiragana(expected);
  const hAct = kanjiToHiragana(actual);

  if (hExp === hAct) {
    return { isPhoneticMatch: true, subOps: null };
  }

  // Calculate character LCS diff
  const m = hExp.length;
  const n = hAct.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (hExp[i - 1] === hAct[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  const raw: Array<{ type: "equal" | "delete" | "insert"; ch: string }> = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && hExp[i - 1] === hAct[j - 1]) {
      raw.push({ type: "equal", ch: hExp[i - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      raw.push({ type: "insert", ch: hAct[j - 1]! });
      j--;
    } else {
      raw.push({ type: "delete", ch: hExp[i - 1]! });
      i--;
    }
  }
  raw.reverse();

  // Merge consecutive same-type
  const subOps: SubOp[] = [];
  let k = 0;
  while (k < raw.length) {
    const cur = raw[k]!;
    if (cur.type === "equal") {
      let text = cur.ch;
      k++;
      while (k < raw.length && raw[k]!.type === "equal") {
        text += raw[k]!.ch;
        k++;
      }
      subOps.push({ type: "equal", text });
    } else {
      let del = "";
      let ins = "";
      while (k < raw.length && raw[k]!.type !== "equal") {
        const r = raw[k]!;
        if (r.type === "delete") del += r.ch;
        else if (r.type === "insert") ins += r.ch;
        k++;
      }
      if (del && ins) {
        subOps.push({ type: "replace", expected: del, actual: ins });
      } else if (del) {
        subOps.push({ type: "delete", text: del });
      } else if (ins) {
        subOps.push({ type: "insert", text: ins });
      }
    }
  }

  const hasMatches = subOps.some((s) => s.type === "equal");
  return { isPhoneticMatch: false, subOps: hasMatches ? subOps : null };
}

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
          const { isPhoneticMatch, subOps } = diffHiraganaSubChars(op.expected, op.actual);

          if (isPhoneticMatch) {
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
                    background: "rgba(234, 179, 8, 0.25)",
                    color: "#facc15",
                    padding: "2px 6px",
                    borderRadius: "6px",
                    fontWeight: 600,
                  }}
                  title="Chấp nhận theo cách đọc"
                >
                  {op.actual}
                  <span style={{ fontSize: "0.75rem", opacity: 0.85, marginLeft: 4 }}>
                    (chấp nhận)
                  </span>
                </span>
              </span>
            );
          }

          // If there's partial phonetic alignment (e.g. 経営者 vs けいえんしゃ -> highlight only wrong char)
          if (subOps && subOps.length > 0) {
            return (
              <span
                key={i}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  margin: "0 4px",
                  padding: "2px 6px",
                  borderRadius: "8px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  flexWrap: "wrap",
                  gap: 3,
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: "0.9rem", marginRight: 4 }}>
                  {op.expected}:
                </span>
                {subOps.map((sop, idx) => {
                  if (sop.type === "equal") {
                    return (
                      <span key={idx} style={{ color: "#22c55e", fontWeight: 600 }}>
                        {sop.text}
                      </span>
                    );
                  }
                  if (sop.type === "replace") {
                    return (
                      <span
                        key={idx}
                        style={{
                          background: "rgba(239, 68, 68, 0.25)",
                          color: "#f87171",
                          padding: "1px 5px",
                          borderRadius: "4px",
                          fontWeight: 700,
                        }}
                        title={`Đúng: ${sop.expected}, Bạn nhập: ${sop.actual}`}
                      >
                        <span style={{ textDecoration: "line-through", opacity: 0.7, marginRight: 2 }}>
                          {sop.expected}
                        </span>
                        <span>↓{sop.actual}</span>
                        <span style={{ fontSize: "0.7rem", opacity: 0.85, marginLeft: 3 }}>
                          (sai)
                        </span>
                      </span>
                    );
                  }
                  if (sop.type === "delete") {
                    return (
                      <span
                        key={idx}
                        style={{
                          background: "rgba(239, 68, 68, 0.25)",
                          color: "#f87171",
                          padding: "1px 5px",
                          borderRadius: "4px",
                        }}
                        title="Thiếu"
                      >
                        -{sop.text}
                      </span>
                    );
                  }
                  if (sop.type === "insert") {
                    return (
                      <span
                        key={idx}
                        style={{
                          background: "rgba(239, 68, 68, 0.25)",
                          color: "#f87171",
                          padding: "1px 5px",
                          borderRadius: "4px",
                          textDecoration: "line-through",
                        }}
                        title="Thừa"
                      >
                        +{sop.text}
                      </span>
                    );
                  }
                  return null;
                })}
              </span>
            );
          }

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
              >
                {op.expected}
              </span>
              <span style={{ color: "var(--text-subtle)", margin: "0 4px", fontSize: "0.9rem" }}>↓</span>
              <span
                style={{
                  background: "rgba(239, 68, 68, 0.25)",
                  color: "#f87171",
                  padding: "2px 6px",
                  borderRadius: "6px",
                  fontWeight: 600,
                }}
                title="Chưa chính xác"
              >
                {op.actual}
                <span style={{ fontSize: "0.75rem", opacity: 0.85, marginLeft: 4 }}>
                  (sai)
                </span>
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
