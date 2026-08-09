import { useUiLanguage } from "../i18n/UiLanguageContext";
import type { UiLang } from "../i18n/translations";
import { useState, useRef, useEffect } from "react";

const options: { value: UiLang; label: string; flagUrl: string }[] = [
  { value: "vi", label: "Tiếng Việt", flagUrl: "https://flagcdn.com/vn.svg" },
  { value: "ja", label: "日本語", flagUrl: "https://flagcdn.com/jp.svg" },
  { value: "en", label: "English", flagUrl: "https://flagcdn.com/us.svg" },
];

export function LanguageSelector() {
  const { uiLang, setUiLang } = useUiLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentOpt = options.find((o) => o.value === uiLang) || options[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="lang-selector" style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Language"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          padding: "0.3rem 0.4rem",
          color: "var(--text-main)",
          cursor: "pointer",
          outline: "none",
          minHeight: "var(--touch-min)",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
        }}
      >
        <img
          src={currentOpt.flagUrl}
          alt={currentOpt.label}
          style={{ width: "28px", height: "20px", objectFit: "cover", borderRadius: "2px", display: "block" }}
        />
        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>▼</span>
      </button>

      {isOpen && (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "0.3rem",
            background: "var(--card-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            padding: "0.3rem 0",
            listStyle: "none",
            margin: 0,
            minWidth: "140px",
            boxShadow: "var(--card-shadow)",
            zIndex: 100,
          }}
        >
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === uiLang}
              onClick={() => {
                setUiLang(opt.value);
                setIsOpen(false);
              }}
              style={{
                padding: "0.5rem 1rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                background: opt.value === uiLang ? "var(--primary-light)" : "transparent",
                color: opt.value === uiLang ? "var(--primary-color)" : "var(--text-main)",
                fontSize: "0.88rem",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => {
                if (opt.value !== uiLang) e.currentTarget.style.background = "var(--primary-light)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = opt.value === uiLang ? "var(--primary-light)" : "transparent";
              }}
            >
              <img
                src={opt.flagUrl}
                alt={opt.label}
                style={{ width: "24px", height: "17px", objectFit: "cover", borderRadius: "2px", display: "block" }}
              />
              <span>{opt.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
