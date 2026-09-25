import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "../features/auth/AuthLayout";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { apiUrl } from "../shared/env";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useUiLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/auth/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || t("auth.error"));
      }
      setMessage(data.message || t("auth.linkSent"));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t("auth.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title={t("auth.forgotTitle")} subtitle={t("auth.forgotSub")}>
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      {message ? (
        <div className="alert alert--ok" role="status">
          {message}
        </div>
      ) : (
        <form className="auth__form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="forgot-email">{t("auth.email")}</label>
            <input
              id="forgot-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ban@email.com"
            />
          </div>
          <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={loading}>
            {loading ? t("auth.wait") : t("auth.sendLink")}
          </button>
        </form>
      )}
      <p className="auth__switch">
        <Link to="/auth" style={{ fontWeight: 600, color: "var(--primary-color)" }}>
          {t("auth.backLogin")}
        </Link>
      </p>
    </AuthLayout>
  );
}
