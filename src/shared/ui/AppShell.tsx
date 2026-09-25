import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { LoginButton } from "../../features/auth/LoginButton";
import { useUiLanguage } from "../i18n/UiLanguageContext";
import type { TranslationKey, UiLang } from "../i18n/translations";
import { useTheme } from "../theme/ThemeProvider";
import { Icon, type IconName } from "./Icon";

export type Crumb = { label: string; to?: string };

const NAV: Array<{ to: string; label: TranslationKey; icon: IconName; end?: boolean }> = [
  { to: "/", label: "nav.home", icon: "home", end: true },
  { to: "/lessons", label: "nav.practice", icon: "book" },
  { to: "/history", label: "nav.progress", icon: "chart" },
  { to: "/pricing", label: "nav.pro", icon: "crown" },
];

const LANGS: Array<{ value: UiLang; label: string }> = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "ja", label: "日本語" },
  { value: "en", label: "English" },
];

export function Brand({ onClick }: { onClick?: () => void }) {
  const { t } = useUiLanguage();
  return (
    <Link to="/" className="shell-brand" onClick={onClick}>
      <span className="shell-brand__logo" aria-hidden="true">
        聴
      </span>
      <span className="shell-brand__text">
        <span className="shell-brand__name">Japanese Dictation</span>
        <span className="shell-brand__tag">{t("brand.tagline")}</span>
      </span>
    </Link>
  );
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const { t } = useUiLanguage();
  return (
    <nav className="breadcrumb" aria-label={t("nav.breadcrumb")}>
      <ol>
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`}>
              {last || !c.to ? (
                <span aria-current={last ? "page" : undefined}>{c.label}</span>
              ) : (
                <>
                  <Link to={c.to}>{c.label}</Link>
                  <span className="breadcrumb__sep" aria-hidden="true">
                    <Icon name="chevronRight" size={16} strokeWidth={2} />
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function AppShell({
  children,
  breadcrumbs,
  title,
}: {
  children: ReactNode;
  /** Trail shown in the top bar; the last item is the current page. */
  breadcrumbs?: Crumb[];
  /** Plain page name for the top bar when there is no trail. */
  title?: string;
}) {
  const { t, uiLang, setUiLang } = useUiLanguage();
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    document.documentElement.lang = uiLang;
  }, [uiLang]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="shell">
      {menuOpen && <div className="shell-backdrop" onClick={closeMenu} aria-hidden="true" />}

      <aside id="app-sidebar" className={`shell-sidebar${menuOpen ? " is-open" : ""}`}>
        <div className="shell-sidebar__top">
          <Brand onClick={closeMenu} />
          <button
            type="button"
            className="icon-btn icon-btn--ghost shell-sidebar__close"
            onClick={closeMenu}
            aria-label={t("nav.closeMenu")}
          >
            <Icon name="close" />
          </button>
        </div>

        <nav className="shell-nav" aria-label={t("nav.main")}>
          <span className="shell-nav__group">{t("nav.group")}</span>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `shell-nav__item${isActive ? " active" : ""}`}
              onClick={closeMenu}
            >
              <Icon name={item.icon} />
              {t(item.label)}
            </NavLink>
          ))}
        </nav>

        <div className="shell-sidebar__foot">
          {pathname !== "/pricing" && (
            <div className="upsell">
              <span className="upsell__title">{t("upsell.title")}</span>
              <span className="upsell__body">{t("upsell.body")}</span>
              <Link to="/pricing" className="btn btn--dark btn--sm btn--block" onClick={closeMenu}>
                {t("upsell.cta")}
              </Link>
            </div>
          )}
          <div className="shell-prefs">
            <label className="shell-lang">
              <span className="visually-hidden">{t("ui.language")}</span>
              <Icon name="globe" size={18} />
              <select value={uiLang} onChange={(e) => setUiLang(e.target.value as UiLang)}>
                {LANGS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="icon-btn"
              onClick={toggleTheme}
              aria-label={t("theme.toggle")}
              title={theme === "dark" ? t("theme.light") : t("theme.dark")}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
            </button>
          </div>
        </div>
      </aside>

      <div className="shell-main">
        <header className="shell-header">
          <button
            type="button"
            className="icon-btn icon-btn--ghost shell-header__menu"
            onClick={() => setMenuOpen(true)}
            aria-label={t("nav.openMenu")}
            aria-controls="app-sidebar"
            aria-expanded={menuOpen}
          >
            <Icon name="menu" size={22} />
          </button>
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <Breadcrumbs items={breadcrumbs} />
          ) : title ? (
            <span className="shell-header__title">{title}</span>
          ) : null}
          <div className="shell-header__actions">
            <LoginButton />
          </div>
        </header>

        <main className="shell-content">{children}</main>
      </div>
    </div>
  );
}
