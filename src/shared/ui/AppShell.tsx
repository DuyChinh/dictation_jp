import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { LoginButton } from "../../features/auth/LoginButton";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSelector } from "./LanguageSelector";
import { LevelSelector } from "./LevelSelector";
import { useUiLanguage } from "../i18n/UiLanguageContext";

export function AppShell({
  children,
  wide,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useUiLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
    try {
      return localStorage.getItem("jd.sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    if (window.innerWidth < 960) {
      setMobileOpen((v) => !v);
    } else {
      setDesktopCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem("jd.sidebar_collapsed", String(next));
        } catch {
          // ignore
        }
        return next;
      });
    }
  };

  return (
    <div className={`app-shell-layout ${desktopCollapsed ? "sidebar--collapsed" : ""}`}>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar Menu (Default hidden on mobile, collapsible on desktop) */}
      <aside
        className={`app-sidebar ${mobileOpen ? "is-open" : ""} ${
          desktopCollapsed ? "is-collapsed" : ""
        }`}
      >
        <div className="app-sidebar__head">
          <Link to="/" className="app-header__brand" onClick={() => setMobileOpen(false)}>
            <span className="app-header__logo" aria-hidden>
              聴
            </span>
            {!desktopCollapsed && (
              <span className="app-header__title">
                <span className="app-header__title-full">Japanese Dictation</span>
              </span>
            )}
          </Link>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setMobileOpen(false)}
            aria-label="Đóng menu"
            title="Đóng menu"
          >
            ✕
          </button>
        </div>

        <nav className="app-sidebar__nav" aria-label="Main Navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `sidebar-nav-item ${isActive ? "active" : ""}`}
            onClick={() => setMobileOpen(false)}
            title={t("nav.home")}
          >
            <span className="sidebar-nav-icon">🏠</span>
            {!desktopCollapsed && <span className="sidebar-nav-label">{t("nav.home")}</span>}
            {!desktopCollapsed && <span className="sidebar-nav-pill" />}
          </NavLink>

          <NavLink
            to="/history"
            className={({ isActive }) => `sidebar-nav-item ${isActive ? "active" : ""}`}
            onClick={() => setMobileOpen(false)}
            title={t("nav.history")}
          >
            <span className="sidebar-nav-icon">🏆</span>
            {!desktopCollapsed && <span className="sidebar-nav-label">{t("nav.history")}</span>}
            {!desktopCollapsed && <span className="sidebar-nav-pill" />}
          </NavLink>
        </nav>

        <div className="app-sidebar__footer">
          {!desktopCollapsed ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div className="sidebar-badge">
                <span className="badge-dot" />
                <span>JLPT N1–N5</span>
              </div>
              <button
                type="button"
                className="desktop-collapse-btn"
                onClick={toggleSidebar}
                title="Thu gọn menu"
              >
                ◀
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="desktop-collapse-btn"
              onClick={toggleSidebar}
              title="Mở rộng menu"
              style={{ width: "100%", justifyContent: "center" }}
            >
              ▶
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area with Top Header */}
      <div className="app-shell-content">
        <header className="app-header">
          <div className="app-header__left">
            <button
              type="button"
              className="sidebar-toggle-btn"
              onClick={toggleSidebar}
              aria-label="Đóng / Mở menu"
              title="Đóng / Mở menu điều hướng"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>

            <Link to="/" className="app-header__brand app-header__brand--header">
              <span className="app-header__logo" aria-hidden>
                聴
              </span>
              <span className="app-header__title">
                <span className="app-header__title-full">Japanese Dictation</span>
              </span>
            </Link>
          </div>

          <div className="app-header__actions">
            <LevelSelector />
            <LanguageSelector />
            <ThemeToggle />
            <LoginButton />
          </div>
        </header>

        <main className={`app-main${wide ? " app-main--wide" : ""}`}>{children}</main>
      </div>
    </div>
  );
}
