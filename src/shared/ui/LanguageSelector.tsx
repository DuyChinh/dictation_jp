import { useUiLanguage } from "../i18n/UiLanguageContext";
import type { UiLang } from "../i18n/translations";

const options: { value: UiLang; label: string; flag: string }[] = [
  { value: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
  { value: "ja", label: "日本語", flag: "🇯🇵" },
  { value: "en", label: "English", flag: "🇬🇧" },
];

export function LanguageSelector() {
  const { uiLang, setUiLang } = useUiLanguage();

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <select
        value={uiLang}
        onChange={(e) => setUiLang(e.target.value as UiLang)}
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          background: "var(--card-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: "10px",
          padding: "0.45rem 2rem 0.45rem 0.75rem",
          fontSize: "0.88rem",
          fontWeight: 500,
          color: "var(--text-main)",
          cursor: "pointer",
          outline: "none",
          transition: "all 0.2s ease",
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} style={{ background: "var(--card-bg)", color: "var(--text-main)" }}>
            {opt.flag} {opt.label}
          </option>
        ))}
      </select>
      <span
        style={{
          position: "absolute",
          right: "0.75rem",
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
          fontSize: "0.7rem",
          color: "var(--text-muted)",
        }}
      >
        ▼
      </span>
    </div>
  );
}
