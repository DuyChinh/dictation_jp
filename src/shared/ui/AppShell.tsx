import { useState, useEffect } from "react";
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
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem("jd.sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    if (window.innerWidth < 768) {
      setMobileOpen((v) => !v);
    } else {
      setIsCollapsed((prev) => {
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

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      className={`app-shell-layout ${
        isCollapsed ? "is-collapsed-layout" : "is-expanded-layout"
      }`}
    >
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar Navigation */}
      <aside
        className={`app-sidebar ${isCollapsed ? "is-collapsed" : "is-expanded"} ${
          mobileOpen ? "is-mobile-open" : ""
        }`}
      >
        {/* Sidebar Header: Always has [☰] toggle on top */}
        <div className="app-sidebar__head">
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={toggleSidebar}
            aria-label={isCollapsed ? "Mở rộng menu" : "Thu gọn menu"}
            title={isCollapsed ? "Mở rộng menu" : "Thu gọn menu"}
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

          {!isCollapsed && (
            <Link
              to="/"
              className="app-header__brand sidebar-brand"
              onClick={() => setMobileOpen(false)}
              title="Japanese Dictation"
            >
              <span className="app-header__logo" aria-hidden>
                聴
              </span>
              <span className="app-header__title">Japanese Dictation</span>
            </Link>
          )}

          {/* Close button on mobile */}
          {!isCollapsed && (
            <button
              type="button"
              className="sidebar-close-btn"
              onClick={() => setMobileOpen(false)}
              aria-label="Đóng menu"
              title="Đóng menu"
            >
              ✕
            </button>
          )}
        </div>

        {/* Navigation Items List */}
        <nav className="app-sidebar__nav" aria-label="Main Navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? "active" : ""}`
            }
            onClick={() => setMobileOpen(false)}
            title={t("nav.home")}
          >
            <span className="sidebar-nav-icon" aria-hidden="true">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
            </span>
            {!isCollapsed && (
              <span className="sidebar-nav-label">{t("nav.home")}</span>
            )}
          </NavLink>

          <NavLink
            to="/history"
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? "active" : ""}`
            }
            onClick={() => setMobileOpen(false)}
            title={t("nav.history")}
          >
            <span className="sidebar-nav-icon" aria-hidden="true">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 21h8"></path>
                <path d="M12 17v4"></path>
                <path d="M7 4h10v5a5 5 0 0 1-10 0V4z"></path>
                <path d="M7 6H4a2 2 0 0 0-2 2v1a4 4 0 0 0 4 4h1"></path>
                <path d="M17 6h3a2 2 0 0 1 2 2v1a4 4 0 0 1-4 4h-1"></path>
              </svg>
            </span>
            {!isCollapsed && (
              <span className="sidebar-nav-label">{t("nav.history")}</span>
            )}
          </NavLink>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="app-shell-content">
        <header className="app-header">
          <div className="app-header__left">
            {/* Mobile Hamburger Button (Only on screen < 768px) */}
            <button
              type="button"
              className="sidebar-toggle-btn mobile-header-toggle"
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

            {/* Header Brand: Displays [聴] Japanese Dictation on the main header */}
            <Link
              to="/"
              className="app-header__brand header-brand"
              onClick={() => setMobileOpen(false)}
            >
              <span className="app-header__logo" aria-hidden>
                聴
              </span>
              <span className="app-header__title">Japanese Dictation</span>
            </Link>
          </div>

          <div className="app-header__actions">
            <LevelSelector />
            <LanguageSelector />
            <ThemeToggle />
            <LoginButton />
          </div>
        </header>

        <main className={`app-main${wide ? " app-main--wide" : ""}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
