import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../shared/env";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

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
        throw new Error(data.error?.message || "Failed to process request");
      }
      
      setMessage(data.message || "Reset link generated.");
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
        <button
          onClick={() => navigate("/auth")}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: 0,
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.9rem",
          }}
        >
          <span>←</span> Back to login
        </button>

        <h1 style={{ margin: "0 0 0.5rem 0", fontSize: "1.5rem", color: "var(--text-main)", fontWeight: 700 }}>
          Reset Password
        </h1>
        <p style={{ margin: "0 0 1.5rem 0", color: "var(--text-muted)", fontSize: "0.95rem" }}>
          Enter your email and we will generate a password reset link.
        </p>

        {error && (
          <div style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", padding: "0.75rem", borderRadius: "10px", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
            {error}
          </div>
        )}

        {message ? (
          <div style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981", padding: "1rem", borderRadius: "10px", textAlign: "center", fontSize: "0.95rem" }}>
            {message}
            <br/><br/>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              (Since SMTP is not configured, please check the backend terminal console for the reset link)
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--text-main)", fontWeight: 500 }}>
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                placeholder="name@example.com"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.85rem",
                borderRadius: "12px",
                border: "none",
                background: "var(--primary-color)",
                color: "#fff",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
