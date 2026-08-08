import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { LoginButton } from "../../features/auth/LoginButton";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSelector } from "./LanguageSelector";
import { useUiLanguage } from "../i18n/UiLanguageContext";

export function AppShell({
  children,
  wide,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useUiLanguage();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-gradient)",
        color: "var(--text-main)",
        lineHeight: 1.6,
        transition: "background 0.3s ease, color 0.3s ease",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "var(--header-bg)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--header-border)",
          padding: "0.75rem 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link
            to="/"
            style={{
              textDecoration: "none",
              color: "var(--primary-color)",
              fontWeight: 800,
              fontSize: "1.15rem",
              letterSpacing: "-0.02em",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "var(--primary-color)",
                color: "var(--primary-text)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1rem",
              }}
            >
              聴
            </span>
            <span>Japanese Dictation</span>
          </Link>

          <nav style={{ display: "flex", gap: 16, fontSize: "0.9rem", fontWeight: 500 }}>
            <Link
              to="/"
              style={{
                color: "var(--text-muted)",
                transition: "color 0.2s ease",
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = "var(--primary-color)")}
              onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              {t("nav.home")}
            </Link>
          </nav>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LanguageSelector />
          <ThemeToggle />
          <LoginButton />
        </div>
      </header>

      <main
        style={{
          maxWidth: wide ? 1000 : 780,
          margin: "0 auto",
          padding: "2rem 1.25rem 4rem",
        }}
      >
        {children}
      </main>
    </div>
  );
}
