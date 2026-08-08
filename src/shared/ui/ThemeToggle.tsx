import { useTheme } from "../theme/ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
      style={{
        background: "transparent",
        border: "1px solid var(--border-color)",
        borderRadius: "10px",
        width: "38px",
        height: "38px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "1.1rem",
        cursor: "pointer",
        color: "var(--text-main)",
        transition: "all 0.2s ease",
      }}
    >
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}
