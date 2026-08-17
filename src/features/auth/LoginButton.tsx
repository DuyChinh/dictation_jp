import { useNavigate } from "react-router-dom";
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

  const navigate = useNavigate();

  const handleLogin = () => {
    navigate("/auth");
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
      <span className="auth-login-label">Sign In</span>
    </button>
  );
}
