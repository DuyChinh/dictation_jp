import { Link } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { Icon } from "../../shared/ui/Icon";

/** Top-bar account area: log in / sign up when signed out, the user chip when signed in. */
export function LoginButton() {
  const { user, logout, loading } = useAuth();
  const { t } = useUiLanguage();

  if (loading) {
    return <span className="account" aria-busy="true" style={{ width: 120, height: 44 }} />;
  }

  if (user) {
    const initial = user.displayName?.trim().charAt(0).toUpperCase() || "U";
    return (
      <div className="account">
        <span className="account__chip" title={user.displayName}>
          {user.avatar ? (
            <img src={user.avatar} alt="" className="account__avatar" />
          ) : (
            <span className="account__avatar" aria-hidden="true">
              {initial}
            </span>
          )}
          <span className="account__name">{user.displayName}</span>
        </span>
        <button
          type="button"
          onClick={logout}
          className="icon-btn icon-btn--ghost"
          aria-label={t("auth.logout")}
          title={t("auth.logout")}
        >
          <Icon name="logout" size={18} />
        </button>
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
