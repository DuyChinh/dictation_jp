import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../AdminAuth";
import { errorText } from "../api";

export function LoginPage() {
  const { admin, loading, login } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from;
  const target = from && from.startsWith("/admin") && from !== "/admin/login" ? from : "/admin";

  if (!loading && admin) return <Navigate to={target} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      navigate(target, { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm-login">
      <div className="adm-login__hero">
        <div className="adm-brand">
          <img className="adm-brand__logo" src="/logo.png" alt="" />
          <span className="adm-brand__text">
            <span className="adm-brand__name">Motto</span>
            <span className="adm-brand__tag">Bảng quản trị</span>
          </span>
        </div>
        <p className="adm-login__motto" lang="ja">
          続ければ、
          <br />
          もっとできる。
        </p>
        <p className="adm-login__sub">Quản lý người học, doanh thu và đề nghe.</p>
        <p className="adm-login__note">Chỉ dành cho quản trị viên. Mọi lần đăng nhập đều được ghi vào nhật ký.</p>
      </div>

      <main className="adm-login__panel">
        <form className="adm-login__form" onSubmit={submit}>
          <div>
            <h1>Đăng nhập</h1>
            <p className="muted">Dùng tài khoản quản trị được cấp.</p>
          </div>
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          <div className="field">
            <label htmlFor="adm-username">Tên đăng nhập</label>
            <input
              id="adm-username"
              type="text"
              required
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="adm-password">Mật khẩu</label>
            <input
              id="adm-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
          <p className="adm-login__help muted">Quên mật khẩu? Liên hệ Super admin để được đặt lại.</p>
        </form>
      </main>
    </div>
  );
}
