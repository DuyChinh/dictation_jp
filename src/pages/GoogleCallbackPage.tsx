import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";

export function GoogleCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      login(token);
      navigate("/", { replace: true });
    } else {
      const error = searchParams.get("error");
      if (error) {
        console.error("Google Auth Error:", error);
      }
      navigate("/", { replace: true });
    }
  }, [searchParams, navigate, login]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "var(--bg-gradient)",
        color: "var(--text-main)",
      }}
    >
      <div className="card-glass" style={{ padding: "2.5rem 3rem", textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⏳</div>
        <h2 style={{ margin: 0, fontWeight: 700 }}>Đang xác thực đăng nhập...</h2>
      </div>
    </div>
  );
}
