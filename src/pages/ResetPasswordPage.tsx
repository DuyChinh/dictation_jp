import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../features/auth/AuthLayout";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { apiUrl } from "../shared/env";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { t } = useUiLanguage();
  const linkValid = !!token && !!email;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkValid) return;
    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || t("auth.error"));
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t("auth.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title={t("auth.resetTitle")} subtitle={t("auth.resetSub")}>
      {!linkValid && (
        <div className="alert" role="alert">
          {t("auth.invalidLink")}
        </div>
      )}
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      {success ? (
        <>
          <div className="alert alert--ok" role="status">
            {t("auth.resetDone")}
          </div>
          <Link to="/auth" className="btn btn--primary btn--lg btn--block">
            {t("auth.loginTitle")}
          </Link>
        </>
      ) : (
        linkValid && (
          <form className="auth__form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="reset-password">{t("auth.newPassword")}</label>
              <input
                id="reset-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.passwordPh")}
              />
            </div>
            <div className="field">
              <label htmlFor="reset-confirm">{t("auth.confirmPassword")}</label>
              <input
                id="reset-confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={loading}>
              {loading ? t("auth.wait") : t("auth.resetSubmit")}
            </button>
          </form>
        )
      )}
      <p className="auth__switch">
        <Link to="/auth" style={{ fontWeight: 600, color: "var(--primary-color)" }}>
          {t("auth.backLogin")}
        </Link>
      </p>
    </AuthLayout>
  );
}
