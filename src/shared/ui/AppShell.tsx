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
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__left">
          <Link to="/" className="app-header__brand">
            <span className="app-header__logo" aria-hidden>
              聴
            </span>
            <span className="app-header__title">
              <span className="app-header__title-short">Dictation</span>
              <span className="app-header__title-full">Japanese Dictation</span>
            </span>
          </Link>

          <nav className="app-header__nav" aria-label="Main">
            <Link to="/">{t("nav.home")}</Link>
          </nav>
        </div>

        <div className="app-header__actions">
          <LanguageSelector />
          <ThemeToggle />
          <LoginButton />
        </div>
      </header>

      <main className={`app-main${wide ? " app-main--wide" : ""}`}>
        {children}
      </main>
    </div>
  );
}
