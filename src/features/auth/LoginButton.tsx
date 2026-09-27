import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth, type User } from "./AuthContext";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { Icon } from "../../shared/ui/Icon";

export function UserAvatar({ user, className = "account__avatar" }: { user: User; className?: string }) {
  const initial = user.displayName?.trim().charAt(0).toUpperCase() || "U";
  return user.avatar ? (
    <img src={user.avatar} alt="" className={className} />
  ) : (
    <span className={className} aria-hidden="true">
      {initial}
    </span>
  );
}

/** Plan name for display: the free tier by its translated name, paid plans by their code. */
export function planLabel(plan: string | undefined, freeLabel: string): string {
  return !plan || plan === "free" ? freeLabel : plan.toUpperCase();
}

/** Top-bar account area: log in / sign up when signed out, the user chip with its menu when signed in. */
export function LoginButton() {
  const { user, logout, loading } = useAuth();
  const { t } = useUiLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (loading) {
    return <span className="account" aria-busy="true" style={{ width: 120, height: 44 }} />;
  }

  if (user) {
    return (
      <div className="account" ref={rootRef}>
        <button
          type="button"
          className="account__chip"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls="account-menu"
        >
          <span className="account__text">
            <span className="account__name">{user.displayName}</span>
            <span className={`account__plan${user.plan && user.plan !== "free" ? " is-paid" : ""}`}>
              {planLabel(user.plan, t("pricing.free"))}
            </span>
          </span>
          <UserAvatar user={user} />
        </button>
        {open && (
          <div id="account-menu" className="account__menu" role="menu">
            <div className="account__menu-head">
              <span className="account__menu-name">{user.displayName}</span>
              <span className="account__menu-email">{user.email}</span>
            </div>
            <Link to="/profile" role="menuitem" className="account__menu-item" onClick={() => setOpen(false)}>
              <Icon name="user" size={18} />
              {t("profile.title")}
            </Link>
            <Link to="/donate" role="menuitem" className="account__menu-item" onClick={() => setOpen(false)}>
              <Icon name="heart" size={18} />
              {t("nav.donate")}
            </Link>
            <button type="button" role="menuitem" className="account__menu-item" onClick={logout}>
              <Icon name="logout" size={18} />
              {t("auth.logout")}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="account">
      <Link to="/auth?mode=register" className="btn btn--ghost hide-sm">
        {t("auth.register")}
      </Link>
      <Link to="/auth" className="btn btn--primary">
        {t("auth.login")}
      </Link>
    </div>
  );
}
