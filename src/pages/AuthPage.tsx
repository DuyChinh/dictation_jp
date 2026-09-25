import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { AuthLayout } from "../features/auth/AuthLayout";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { apiUrl } from "../shared/env";

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function AuthPage() {
  const [params, setParams] = useSearchParams();
  const isLogin = params.get("mode") !== "register";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const { t } = useUiLanguage();
  const navigate = useNavigate();

  const switchMode = () => {
    setError(null);
    setParams(isLogin ? { mode: "register" } : {}, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, displayName);
      }
      navigate("/");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t("auth.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={isLogin ? t("auth.loginTitle") : t("auth.registerTitle")}
      subtitle={isLogin ? t("auth.loginSub") : t("auth.registerSub")}
    >
      <button
        type="button"
        className="btn btn--outline btn--lg btn--block"
        onClick={() => (window.location.href = apiUrl("/api/auth/google"))}
      >
        <GoogleMark />
        {t("auth.google")}
      </button>

      <div className="auth__divider">{t("auth.orEmail")}</div>

      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}

      <form className="auth__form" onSubmit={handleSubmit}>
        {!isLogin && (
          <div className="field">
            <label htmlFor="auth-name">{t("auth.displayName")}</label>
            <input
              id="auth-name"
              type="text"
              required
              autoComplete="nickname"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("auth.displayNamePh")}
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="auth-email">{t("auth.email")}</label>
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ban@email.com"
          />
        </div>
        <div className="field">
          <div className="field__row">
            <label htmlFor="auth-password">{t("auth.password")}</label>
            {isLogin && (
              <Link to="/auth/forgot-password" style={{ fontSize: 13, fontWeight: 600, color: "var(--primary-color)" }}>
                {t("auth.forgot")}
              </Link>
            )}
          </div>
          <input
            id="auth-password"
            type="password"
            required
            minLength={isLogin ? undefined : 8}
            autoComplete={isLogin ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isLogin ? "••••••••" : t("auth.passwordPh")}
          />
        </div>
        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={loading}>
          {loading ? t("auth.wait") : isLogin ? t("auth.loginTitle") : t("auth.register")}
        </button>
      </form>

      <p className="auth__switch">
        {isLogin ? t("auth.noAccount") : t("auth.haveAccount")}{" "}
        <button type="button" className="link-btn" onClick={switchMode}>
          {isLogin ? t("auth.registerFree") : t("auth.loginTitle")}
        </button>
      </p>
      <p className="auth__terms">{t("auth.terms")}</p>
    </AuthLayout>
  );
}
