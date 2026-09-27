import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { useTheme } from "../shared/theme/ThemeProvider";
import { Icon, type IconName } from "../shared/ui/Icon";
import { useAdminAuth } from "./AdminAuth";
import { adminFetch, errorText, type AdminAccount, type AdminArea } from "./api";
import { useFeedback } from "./components/Feedback";
import { Field, FormDialog } from "./components/Modal";
import { initials, ROLE_LABEL } from "./format";

type NavItem = { to: string; label: string; icon: IconName; area?: AdminArea; end?: boolean };

const NAV: Array<{ group: string; items: NavItem[] }> = [
  { group: "Chung", items: [{ to: "/admin", label: "Tổng quan", icon: "grid", end: true }] },
  {
    group: "Người học",
    items: [
      { to: "/admin/users", label: "Người dùng", icon: "users", area: "users" },
      { to: "/admin/feedback", label: "Góp ý", icon: "message", area: "feedback" },
    ],
  },
  { group: "Doanh thu", items: [{ to: "/admin/payments", label: "Thanh toán", icon: "card" }] },
  { group: "Nội dung", items: [{ to: "/admin/content", label: "Đề thi & script", icon: "headphones", area: "content" }] },
  { group: "Hệ thống", items: [{ to: "/admin/admins", label: "Quản trị viên", icon: "shield", area: "admins" }] },
];

function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { setSession } = useAdminAuth();
  const { toast } = useFeedback();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCurrent("");
      setNext("");
      setAgain("");
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (next !== again) {
      setError("Hai lần nhập mật khẩu mới không khớp.");
      return;
    }
    setBusy(true);
    try {
      const s = await adminFetch<{ token: string; admin: AdminAccount }>("/auth/password", {
        method: "POST",
        body: { currentPassword: current, newPassword: next },
      });
      setSession(s.token, s.admin);
      toast("Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất.");
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog open={open} title="Đổi mật khẩu" onClose={onClose} onSubmit={submit} submitLabel="Đổi mật khẩu" busy={busy} error={error}>
      <Field label="Mật khẩu hiện tại" htmlFor="pw-current">
        <input id="pw-current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label="Mật khẩu mới" htmlFor="pw-next" hint="Ít nhất 8 ký tự.">
        <input id="pw-next" type="password" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      <Field label="Nhập lại mật khẩu mới" htmlFor="pw-again">
        <input id="pw-again" type="password" autoComplete="new-password" required minLength={8} value={again} onChange={(e) => setAgain(e.target.value)} />
      </Field>
    </FormDialog>
  );
}

export function AdminLayout() {
  const { admin, loading, logout, can } = useAdminAuth();
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const [pwOpen, setPwOpen] = useState(false);

  useEffect(() => {
    document.documentElement.lang = "vi";
  }, []);

  if (loading) return <div className="adm-loading">Đang tải…</div>;
  if (!admin) return <Navigate to="/admin/login" replace state={{ from: pathname }} />;

  const paymentsVisible = can("payments", "read") || can("catalog", "read");
  const visible = (item: NavItem) => (item.to === "/admin/payments" ? paymentsVisible : !item.area || can(item.area, "read"));

  return (
    <div className="adm">
      <aside className="adm-side">
        <div className="adm-brand">
          <img className="adm-brand__logo" src="/logo.png" alt="" />
          <span className="adm-brand__text">
            <span className="adm-brand__name">Motto</span>
            <span className="adm-brand__tag">Bảng quản trị</span>
          </span>
        </div>

        <nav className="adm-nav" aria-label="Điều hướng quản trị">
          {NAV.map((g) => {
            const items = g.items.filter(visible);
            if (items.length === 0) return null;
            return (
              <div key={g.group} className="adm-nav__group">
                <span className="adm-nav__label">{g.group}</span>
                {items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end} className="adm-nav__item">
                    <Icon name={item.icon} size={18} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="adm-side__foot">
          <div className="adm-me">
            <span className="adm-me__avatar" aria-hidden="true">
              {initials(admin.displayName || admin.username)}
            </span>
            <span className="adm-me__text">
              <span className="adm-me__name">{admin.displayName || admin.username}</span>
              <span className="adm-me__role">{ROLE_LABEL[admin.role]}</span>
            </span>
          </div>
          <div className="adm-me__actions">
            <button type="button" className="adm-side-btn" onClick={() => setPwOpen(true)} aria-label="Đổi mật khẩu" title="Đổi mật khẩu">
              <Icon name="key" size={18} />
            </button>
            <button
              type="button"
              className="adm-side-btn"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
              title={theme === "dark" ? "Giao diện sáng" : "Giao diện tối"}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
            </button>
            <button type="button" className="adm-side-btn" onClick={logout} aria-label="Đăng xuất" title="Đăng xuất">
              <Icon name="logout" size={18} />
            </button>
          </div>
        </div>
      </aside>

      <main className="adm-main">
        <Outlet />
      </main>

      <ChangePasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}

/** Shown in place of a page the signed-in role can't open. */
export function NoAccess() {
  return (
    <div className="panel empty">
      <Icon name="lock" size={28} />
      <h3>Không có quyền truy cập</h3>
      <p>Vai trò của bạn không được xem mục này. Liên hệ Super admin nếu cần.</p>
    </div>
  );
}

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="page-head adm-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="page-head__aside adm-head__actions">{children}</div>}
    </div>
  );
}
