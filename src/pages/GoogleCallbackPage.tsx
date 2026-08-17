import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";

export function GoogleCallbackPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { loginWithToken } = useAuth(); // We need to add this method to AuthContext

  useEffect(() => {
    if (token) {
      // Save token and fetch user
      loginWithToken(token).then(() => {
        navigate("/", { replace: true });
      }).catch(err => {
        console.error("Login failed after Google callback:", err);
        navigate("/auth", { replace: true });
      });
    } else {
      navigate("/auth", { replace: true });
    }
  }, [token, navigate, loginWithToken]);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
      <p style={{ color: "var(--text-main)", fontSize: "1.2rem" }}>Logging you in...</p>
    </div>
  );
}
