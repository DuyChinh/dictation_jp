import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  const navigate = useNavigate();

  useEffect(() => {
    if (!token || !email) {
      setError("Invalid reset link. Missing token or email.");
    }
  }, [token, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !email) return;

    if (password !== confirmPassword) {
      setError("Passwords do not match");
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
        throw new Error(data.error?.message || "Failed to reset password");
      }
      
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-gradient)",
        padding: "var(--page-pad-x)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "var(--card-bg)",
          backdropFilter: "blur(12px)",
          border: "1px solid var(--border-color)",
          borderRadius: "20px",
          padding: "2rem",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <h1 style={{ margin: "0 0 0.5rem 0", fontSize: "1.5rem", color: "var(--text-main)", fontWeight: 700 }}>
          Set New Password
        </h1>
        <p style={{ margin: "0 0 1.5rem 0", color: "var(--text-muted)", fontSize: "0.95rem" }}>
          Please enter your new password below.
        </p>

        {error && (
          <div style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", padding: "0.75rem", borderRadius: "10px", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
            {error}
          </div>
        )}

        {success ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981", padding: "1rem", borderRadius: "10px", marginBottom: "1.5rem", fontSize: "0.95rem" }}>
              Password has been successfully reset!
            </div>
            <button
              onClick={() => navigate("/auth")}
              style={{
                width: "100%",
                padding: "0.85rem",
                borderRadius: "12px",
                border: "none",
                background: "var(--primary-color)",
                color: "#fff",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Go to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--text-main)", fontWeight: 500 }}>
                New Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  borderRadius: "12px",
                  border: "1px solid var(--input-border)",
                  background: "var(--input-bg)",
                  color: "var(--input-text)",
                  outline: "none",
                  fontSize: "1rem",
                }}
                placeholder="••••••••"
                disabled={!token || !email}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--text-main)", fontWeight: 500 }}>
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  borderRadius: "12px",
                  border: "1px solid var(--input-border)",
                  background: "var(--input-bg)",
                  color: "var(--input-text)",
                  outline: "none",
                  fontSize: "1rem",
                }}
                placeholder="••••••••"
                disabled={!token || !email}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading || !token || !email}
              style={{
                width: "100%",
                padding: "0.85rem",
                borderRadius: "12px",
                border: "none",
                background: "var(--primary-color)",
                color: "#fff",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: loading || !token || !email ? "not-allowed" : "pointer",
                opacity: loading || !token || !email ? 0.7 : 1,
              }}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
