import { useEffect, useState } from "react";
import { Icon } from "../../shared/ui/Icon";
import { useAdminAuth } from "../AdminAuth";
import { NoAccess, PageHead } from "../AdminLayout";
import {
  adminFetch,
  errorText,
  type AccessLevel,
  type AdminAccount,
  type AdminArea,
  type AdminRole,
  type AuditEntry,
  type Paged,
} from "../api";
import {
  BulkBar,
  DataTable,
  Pagination,
  RowAction,
  StatusBadge,
  useSelection,
  type Column,
} from "../components/DataTable";
import { useFeedback } from "../components/Feedback";
import { Field, FormDialog } from "../components/Modal";
import { useAsync, useDebounced } from "../hooks";
import { AUDIT_LABEL, dateText, dateTimeText, initials, relativeText, ROLE_LABEL } from "../format";

const ROLES = Object.keys(ROLE_LABEL) as AdminRole[];
const AREAS: Array<{ id: AdminArea; label: string }> = [
  { id: "users", label: "Người dùng" },
  { id: "payments", label: "Thanh toán & hoàn tiền" },
  { id: "catalog", label: "Gói & mã giảm giá" },
  { id: "content", label: "Đề thi & script" },
  { id: "admins", label: "Quản trị viên & nhật ký" },
];

/** Same table as backend/src/modules/admin/permissions.ts; the server enforces it. */
const ROLE_ACCESS: Record<AdminRole, Record<AdminArea, AccessLevel>> = {
  super_admin: { users: "write", payments: "write", catalog: "write", content: "write", admins: "write" },
  content: { users: "none", payments: "none", catalog: "none", content: "write", admins: "none" },
  support: { users: "write", payments: "read", catalog: "none", content: "read", admins: "none" },
  accountant: { users: "read", payments: "write", catalog: "write", content: "none", admins: "none" },
};

const LEVEL_TEXT: Record<AccessLevel, string> = { write: "Toàn quyền", read: "Chỉ xem", none: "Không" };

function AdminDialog({
  open,
  account,
  isSelf,
  onClose,
  onSaved,
}: {
  open: boolean;
  account: AdminAccount | null;
  isSelf: boolean;
  onClose: () => void;
  onSaved: (a: AdminAccount, created: boolean) => void;
}) {
  const [form, setForm] = useState({ username: "", displayName: "", role: "support" as AdminRole, status: "active", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      account
        ? { username: account.username, displayName: account.displayName, role: account.role, status: account.status, password: "" }
        : { username: "", displayName: "", role: "support", status: "active", password: "" },
    );
  }, [open, account]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    try {
      const d = account
        ? await adminFetch<{ admin: AdminAccount }>(`/admins/${account.id}`, {
            method: "PATCH",
            body: {
              displayName: form.displayName,
              ...(isSelf ? {} : { role: form.role, status: form.status }),
              ...(form.password ? { password: form.password } : {}),
            },
          })
        : await adminFetch<{ admin: AdminAccount }>("/admins", {
            method: "POST",
            body: { username: form.username, displayName: form.displayName, role: form.role, password: form.password },
          });
      onSaved(d.admin, !account);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open={open}
      title={account ? `Sửa ${account.username}` : "Thêm quản trị viên"}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={account ? "Lưu thay đổi" : "Tạo tài khoản"}
      busy={busy}
      error={error}
    >
      <div className="adm-form__row">
        <Field label="Tên đăng nhập" htmlFor="a-username" hint={account ? "Không đổi được." : "3–40 ký tự a-z, 0-9, . _ -"}>
          <input
            id="a-username"
            required
            pattern="[a-zA-Z0-9._\-]{3,40}"
            autoComplete="off"
            spellCheck={false}
            value={form.username}
            onChange={set("username")}
            disabled={Boolean(account)}
          />
        </Field>
        <Field label="Tên hiển thị" htmlFor="a-name">
          <input id="a-name" maxLength={100} value={form.displayName} onChange={set("displayName")} />
        </Field>
      </div>
      <div className="adm-form__row">
        <Field label="Vai trò" htmlFor="a-role" hint={isSelf ? "Không tự đổi vai trò của mình được." : undefined}>
          <select id="a-role" value={form.role} onChange={set("role")} disabled={isSelf}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
        {account && (
          <Field label="Trạng thái" htmlFor="a-status">
            <select id="a-status" value={form.status} onChange={set("status")} disabled={isSelf}>
              <option value="active">Hoạt động</option>
              <option value="disabled">Vô hiệu hoá</option>
            </select>
          </Field>
        )}
      </div>
      <Field
        label={account ? "Đặt mật khẩu mới" : "Mật khẩu"}
        htmlFor="a-password"
        hint={account ? "Để trống nếu không đổi. Đổi mật khẩu sẽ đăng xuất người đó." : "Ít nhất 8 ký tự."}
      >
        <input
          id="a-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required={!account}
          value={form.password}
          onChange={set("password")}
        />
      </Field>
    </FormDialog>
  );
}

function AuditLog() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const query = useDebounced(q);
  useEffect(() => setPage(1), [query]);
  const { data, error, loading } = useAsync(
    () => adminFetch<Paged<AuditEntry>>("/audit", { query: { q: query, page, limit: 20 } }),
    [query, page],
  );

  const columns: Column<AuditEntry>[] = [
    { key: "time", header: "Thời gian", cell: (e) => <span title={dateTimeText(e.createdAt)}>{dateTimeText(e.createdAt)}</span> },
    { key: "who", header: "Quản trị viên", cell: (e) => <strong>{e.adminUsername || "—"}</strong> },
    { key: "action", header: "Hành động", cell: (e) => AUDIT_LABEL[e.action] ?? e.action },
    {
      key: "target",
      header: "Đối tượng",
      cell: (e) => (
        <span className="adm-user__text">
          <span>{e.target || "—"}</span>
          {e.detail && <span className="adm-clip">{e.detail}</span>}
        </span>
      ),
    },
    { key: "ip", header: "IP", cell: (e) => <span className="adm-mono">{e.ip || "—"}</span> },
  ];

  return (
    <section className="panel table-card adm-gap-top">
      <div className="table-card__head">
        <h2>Nhật ký hoạt động</h2>
        <span className="muted adm-small">Lưu 180 ngày, không sửa hay xoá được.</span>
        <label className="lesson-search adm-search adm-search--inline">
          <Icon name="search" size={18} />
          <span className="visually-hidden">Tìm trong nhật ký</span>
          <input type="search" placeholder="Tìm hành động, đối tượng, người làm" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      {error && <div className="notice notice--error">{error}</div>}
      <DataTable
        caption="Nhật ký hoạt động"
        rows={data?.items ?? []}
        columns={columns}
        rowKey={(e) => e.id}
        rowLabel={(e) => e.action}
        loading={loading}
        empty="Chưa có hoạt động nào."
      />
      {data && <Pagination page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
    </section>
  );
}

export function AdminsPage() {
  const { admin: me, can } = useAdminAuth();
  const { confirm, toast } = useFeedback();
  const canWrite = can("admins", "write");
  const { data, error, loading, reload } = useAsync(() => adminFetch<{ items: AdminAccount[] }>("/admins"), []);
  const rows = data?.items ?? [];
  const selection = useSelection(rows.map((r) => r.id));
  const [dialog, setDialog] = useState<{ account: AdminAccount | null } | null>(null);

  if (!can("admins", "read") || !me) return <NoAccess />;

  const remove = async (ids: string[], title: string, body: string) => {
    if (!(await confirm({ title, body: <p>{body}</p>, confirmLabel: "Xoá", danger: true }))) return;
    try {
      const d =
        ids.length === 1
          ? await adminFetch<{ deleted: number }>(`/admins/${ids[0]}`, { method: "DELETE" })
          : await adminFetch<{ deleted: number }>("/admins/bulk-delete", { method: "POST", body: { ids } });
      toast(`Đã xoá ${d.deleted} quản trị viên`);
      selection.clear();
      void reload();
    } catch (err) {
      toast(errorText(err), "error");
    }
  };

  const columns: Column<AdminAccount>[] = [
    {
      key: "who",
      header: "Tài khoản",
      cell: (a) => (
        <span className="adm-user">
          <span className="adm-avatar" aria-hidden="true">
            {initials(a.displayName || a.username)}
          </span>
          <span className="adm-user__text">
            <strong>
              {a.displayName || a.username}
              {a.id === me.id && <span className="muted"> (bạn)</span>}
            </strong>
            <span className="adm-mono">{a.username}</span>
          </span>
        </span>
      ),
    },
    { key: "role", header: "Vai trò", cell: (a) => <span className="badge badge--sm">{ROLE_LABEL[a.role]}</span> },
    {
      key: "status",
      header: "Trạng thái",
      cell: (a) =>
        a.status === "active" ? (
          <StatusBadge tone="ok">Hoạt động</StatusBadge>
        ) : (
          <StatusBadge tone="bad" icon="lock">
            Vô hiệu hoá
          </StatusBadge>
        ),
    },
    { key: "login", header: "Đăng nhập gần nhất", cell: (a) => relativeText(a.lastLoginAt) },
    { key: "created", header: "Ngày tạo", cell: (a) => dateText(a.createdAt) },
  ];

  return (
    <>
      <PageHead title="Quản trị viên" sub="Tài khoản quản trị tách riêng khỏi tài khoản người học">
        {canWrite && (
          <button type="button" className="btn btn--primary" onClick={() => setDialog({ account: null })}>
            <Icon name="plus" size={18} />
            Thêm quản trị viên
          </button>
        )}
      </PageHead>

      {error && <div className="notice notice--error adm-gap">{error}</div>}

      <section className="panel table-card">
        {canWrite && (
          <BulkBar count={selection.selected.size} noun="quản trị viên" onClear={selection.clear}>
            <button
              type="button"
              className="btn btn--sm adm-btn--danger"
              onClick={() =>
                remove(
                  [...selection.selected],
                  `Xoá ${selection.selected.size} quản trị viên?`,
                  "Các tài khoản đã chọn sẽ không đăng nhập được nữa. Nhật ký của họ vẫn được giữ.",
                )
              }
            >
              Xoá đã chọn
            </button>
          </BulkBar>
        )}
        <DataTable
          caption="Danh sách quản trị viên"
          rows={rows}
          columns={columns}
          rowKey={(a) => a.id}
          rowLabel={(a) => a.username}
          selection={canWrite ? selection : undefined}
          selectable={(a) => a.id !== me.id}
          loading={loading}
          actions={
            canWrite
              ? (a) => (
                  <>
                    <RowAction icon="pencil" label={`Sửa ${a.username}`} onClick={() => setDialog({ account: a })} />
                    {a.id !== me.id && (
                      <RowAction
                        icon="trash"
                        label={`Xoá ${a.username}`}
                        danger
                        onClick={() => remove([a.id], "Xoá quản trị viên?", `Xoá tài khoản ${a.username}. Nhật ký của họ vẫn được giữ.`)}
                      />
                    )}
                  </>
                )
              : undefined
          }
        />
      </section>

      <section className="panel card-pad adm-gap-top">
        <h2>Vai trò &amp; quyền</h2>
        <div className="adm-table-wrap">
          <table className="data-table adm-table adm-matrix">
            <caption className="visually-hidden">Quyền của từng vai trò</caption>
            <thead>
              <tr>
                <th scope="col">Hạng mục</th>
                {ROLES.map((r) => (
                  <th key={r} scope="col">
                    {ROLE_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AREAS.map((area) => (
                <tr key={area.id}>
                  <th scope="row">{area.label}</th>
                  {ROLES.map((r) => {
                    const level = ROLE_ACCESS[r][area.id];
                    return (
                      <td key={r} className={`adm-level adm-level--${level}`}>
                        <Icon name={level === "write" ? "check" : level === "read" ? "eye" : "close"} size={14} strokeWidth={2.4} />
                        {LEVEL_TEXT[level]}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <AuditLog />

      <AdminDialog
        open={dialog !== null}
        account={dialog?.account ?? null}
        isSelf={dialog?.account?.id === me.id}
        onClose={() => setDialog(null)}
        onSaved={(a, created) => {
          setDialog(null);
          toast(created ? `Đã tạo ${a.username}` : `Đã lưu ${a.username}`);
          void reload();
        }}
      />
    </>
  );
}
