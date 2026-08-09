import { apiUrl } from "../../shared/env";
import { useAuth } from "./AuthContext";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";

export function LoginButton() {
  const { user, logout, loading } = useAuth();
  const { t } = useUiLanguage();

  if (loading) {
    return (
      <span style={{ fontSize: "0.88rem", color: "var(--text-muted)", padding: "0.4rem 0.8rem" }}>
        …
      </span>
    );
  }

  if (user) {
    return (
      <div className="auth-user">
        {user.avatar ? (
          <img
            src={user.avatar}
            alt=""
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "1px solid var(--border-color)",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "var(--primary-color)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
            aria-hidden
          >
            {user.displayName?.charAt(0).toUpperCase() || "U"}
          </div>
        )}
        <span className="auth-user-name" style={{ fontWeight: 500, fontSize: "0.9rem", color: "var(--text-main)" }}>
          {user.displayName}
        </span>
        <button
          type="button"
          onClick={logout}
          className="auth-logout-btn"
          aria-label={t("auth.logout")}
          style={{
            padding: "0.4rem 0.65rem",
            fontSize: "0.85rem",
            borderRadius: "8px",
            border: "1px solid var(--border-color)",
            background: "var(--card-bg)",
            color: "var(--text-muted)",
            cursor: "pointer",
            minHeight: "var(--touch-min)",
          }}
        >
          <span className="auth-logout-label">{t("auth.logout")}</span>
          <span className="auth-logout-icon" aria-hidden>
            ⎋
          </span>
        </button>
      </div>
    );
  }

  const handleLogin = () => {
    window.location.href = apiUrl("/api/auth/google");
  };

  return (
    <button
      type="button"
      onClick={handleLogin}
      className="auth-login-btn"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "0.45rem 0.75rem",
        fontSize: "0.88rem",
        fontWeight: 600,
        borderRadius: "10px",
        border: "1px solid var(--border-color)",
        background: "var(--card-bg)",
        color: "var(--text-main)",
        cursor: "pointer",
        boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        />
      </svg>
      <span className="auth-login-label">{t("auth.loginGoogle")}</span>
    </button>
  );
}
