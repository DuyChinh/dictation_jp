import { useLevel, type JlptLevel } from "../context/LevelContext";

const LEVELS: JlptLevel[] = ["ALL", "N1", "N2", "N3", "N4", "N5"];

export function LevelSelector() {
  const { level, setLevel, getLevelLabel } = useLevel();

  return (
    <div className="level-selector-wrapper" style={{ display: "inline-flex", alignItems: "center" }}>
      <select
        value={level}
        onChange={(e) => setLevel(e.target.value as JlptLevel)}
        className="level-select-input"
        aria-label="Chọn trình độ JLPT"
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          background: "rgba(255, 255, 255, 0.07)",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          padding: "0.38rem 1.65rem 0.38rem 0.65rem",
          fontSize: "0.85rem",
          fontWeight: 700,
          color: "var(--text-main)",
          cursor: "pointer",
          backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 0.4rem center",
          backgroundSize: "1em",
          transition: "all 0.2s ease",
        }}
      >
        {LEVELS.map((lvl) => (
          <option key={lvl} value={lvl} style={{ background: "var(--bg-card)", color: "var(--text-main)" }}>
            {getLevelLabel(lvl)}
          </option>
        ))}
      </select>
    </div>
  );
}
