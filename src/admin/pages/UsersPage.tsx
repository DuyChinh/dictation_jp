import { useEffect, useState } from "react";
import { Icon } from "../../shared/ui/Icon";
import { useAdminAuth } from "../AdminAuth";
import { NoAccess, PageHead } from "../AdminLayout";
import { adminFetch, errorText, type Paged, type PlanRow, type UserDetail, type UserRow } from "../api";
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
import { Field, FormDialog, Modal } from "../components/Modal";
import { useAsync, useDebounced } from "../hooks";
import {
  dateText,
  fromInput,
  initials,
  lessonTitle,
  num,
  PROVIDER_LABEL,
  relativeText,
  toDateInput,
  vnd,
} from "../format";
import { PaymentStatusBadge } from "./PaymentsPage";

type UsersResponse = Paged<UserRow> & { summary: { total: number; paid: number; locked: number } };

function usePlans(enabled: boolean) {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  useEffect(() => {
    if (!enabled) return;
    adminFetch<{ items: PlanRow[] }>("/catalog/plans")
      .then((d) => setPlans(d.items))
      .catch(() => setPlans([]));
  }, [enabled]);
  return plans;
}

export function planName(code: string, plans: PlanRow[]): string {
  if (!code || code === "free") return "Miễn phí";
  return plans.find((p) => p.code === code)?.name ?? code;
}

function UserEditDialog({
  user,
  plans,
  onClose,
  onSaved,
}: {
  user: UserRow | null;
  plans: PlanRow[];
  onClose: () => void;
  onSaved: (u: UserRow) => void;
}) {
  const [form, setForm] = useState({ displayName: "", email: "", plan: "free", premiumUntil: "", status: "active" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setForm({
      displayName: user.displayName,
      email: user.email,
      plan: user.plan,
      premiumUntil: toDateInput(user.premiumUntil),
      status: user.status,
    });
    setError(null);
  }, [user]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  // Keep the current code selectable even if its plan was renamed or removed.
  const planOptions = [
    { code: "free", name: "Miễn phí" },
    ...plans.filter((p) => p.code !== "free"),
    ...(form.plan && form.plan !== "free" && !plans.some((p) => p.code === form.plan) ? [{ code: form.plan, name: form.plan }] : []),
  ];

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const d = await adminFetch<{ user: UserRow }>(`/users/${user.id}`, {
        method: "PATCH",
        body: {
          displayName: form.displayName,
          email: form.email,
          plan: form.plan,
          premiumUntil: form.plan === "free" ? null : fromInput(form.premiumUntil, true),
          status: form.status,
        },
      });
      onSaved(d.user);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog open={user !== null} title="Sửa người dùng" onClose={onClose} onSubmit={submit} submitLabel="Lưu thay đổi" busy={busy} error={error}>
      <Field label="Tên hiển thị" htmlFor="u-name">
        <input id="u-name" required maxLength={100} value={form.displayName} onChange={set("displayName")} />
      </Field>
      <Field label="Email" htmlFor="u-email">
        <input id="u-email" type="email" required value={form.email} onChange={set("email")} />
      </Field>
      <div className="adm-form__row">
        <Field label="Gói" htmlFor="u-plan">
          <select id="u-plan" value={form.plan} onChange={set("plan")}>
            {planOptions.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Hết hạn gói" htmlFor="u-until" hint="Để trống nếu không hết hạn.">
          <input id="u-until" type="date" value={form.premiumUntil} onChange={set("premiumUntil")} disabled={form.plan === "free"} />
        </Field>
      </div>
      <Field label="Trạng thái" htmlFor="u-status" hint="Tài khoản bị khoá không đăng nhập được.">
        <select id="u-status" value={form.status} onChange={set("status")}>
          <option value="active">Hoạt động</option>
          <option value="locked">Đã khoá</option>
        </select>
      </Field>
    </FormDialog>
  );
}

function UserDetailDrawer({ userId, plans, onClose }: { userId: string | null; plans: PlanRow[]; onClose: () => void }) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDetail(null);
    setError(null);
    if (!userId) return;
    adminFetch<UserDetail>(`/users/${userId}`)
      .then(setDetail)
      .catch((err) => setError(errorText(err)));
  }, [userId]);

  const u = detail?.user;
  return (
    <Modal open={userId !== null} title={u?.displayName ?? "Người dùng"} onClose={onClose} variant="drawer">
      {error && <div className="alert">{error}</div>}
      {!detail && !error && <p className="muted">Đang tải…</p>}
      {detail && u && (
        <div className="adm-detail">
          <div className="adm-detail__who">
            <span className="adm-avatar adm-avatar--lg" aria-hidden="true">
              {u.avatar ? <img src={u.avatar} alt="" /> : initials(u.displayName)}
            </span>
            <span className="muted">{u.email}</span>
          </div>
          <dl className="adm-dl">
            <div>
              <dt>Đăng nhập bằng</dt>
              <dd>{PROVIDER_LABEL[u.authProvider]}</dd>
            </div>
            <div>
              <dt>Gói</dt>
              <dd>{planName(u.plan, plans)}</dd>
            </div>
            <div>
              <dt>Ngày tạo</dt>
              <dd>{dateText(u.createdAt)}</dd>
            </div>
            <div>
              <dt>Hết hạn gói</dt>
              <dd>{dateText(u.premiumUntil)}</dd>
            </div>
          </dl>
          <div className="adm-stats">
            <div>
              <span>Phiên luyện</span>
              <strong>{num(detail.stats.sessions)}</strong>
            </div>
            <div>
              <span>Câu dictation đúng</span>
              <strong>
                {num(detail.stats.correct)}/{num(detail.stats.attempted)}
              </strong>
            </div>
            <div>
              <span>Câu nghe đúng</span>
              <strong>
                {num(detail.stats.listeningCorrect)}/{num(detail.stats.listeningTotal)}
              </strong>
            </div>
          </div>
          <section>
            <h3 className="adm-subhead">Tiến độ dictation theo đề</h3>
            {detail.lessons.length === 0 ? (
              <p className="muted">Chưa luyện đề nào.</p>
            ) : (
              detail.lessons.map((l) => {
                const pct = l.total ? Math.round((l.correct / l.total) * 100) : 0;
                return (
                  <div key={l.lessonId} className="meter">
                    <div className="meter__label">
                      <span>{lessonTitle(l.title, l.lessonId)}</span>
                      <span>
                        {l.correct}/{l.total || "?"} · {pct}%
                      </span>
                    </div>
                    <div className="progress">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </section>
          {detail.payments.length > 0 && (
            <section>
              <h3 className="adm-subhead">Giao dịch gần đây</h3>
              <ul className="adm-list">
                {detail.payments.map((p) => (
                  <li key={p.id} className="adm-list__row">
                    <span className="adm-list__main">
                      <strong className="adm-mono">{p.code}</strong>
                      <span className="muted">{dateText(p.createdAt)}</span>
                    </span>
                    <span className="tabular adm-list__amount">{vnd(p.amount)}</span>
                    <PaymentStatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}

export function UsersPage() {
  const { can } = useAdminAuth();
  const { confirm, toast } = useFeedback();
  const canWrite = can("users", "write");
  const plans = usePlans(can("users", "read"));

  const [q, setQ] = useState("");
  const [provider, setProvider] = useState("");
  const [plan, setPlan] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const query = useDebounced(q);

  useEffect(() => setPage(1), [query, provider, plan, status]);

  const { data, error, loading, reload } = useAsync(
    () => adminFetch<UsersResponse>("/users", { query: { q: query, provider, plan, status, page, limit: 20 } }),
    [query, provider, plan, status, page],
  );
  const rows = data?.items ?? [];
  const selection = useSelection(rows.map((r) => r.id));
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  if (!can("users", "read")) return <NoAccess />;

  const removeOne = async (u: UserRow) => {
    const ok = await confirm({
      title: "Xoá người dùng?",
      body: (
        <p>
          Xoá <strong>{u.email}</strong> cùng toàn bộ tiến độ luyện tập. Giao dịch của người này vẫn được giữ lại. Không thể hoàn tác.
        </p>
      ),
      confirmLabel: "Xoá người dùng",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminFetch(`/users/${u.id}`, { method: "DELETE" });
      toast(`Đã xoá ${u.email}`);
      void reload();
    } catch (err) {
      toast(errorText(err), "error");
    }
  };

  const removeSelected = async () => {
    const ids = [...selection.selected];
    const ok = await confirm({
      title: `Xoá ${ids.length} người dùng?`,
      body: <p>Các tài khoản đã chọn và toàn bộ tiến độ luyện tập của họ sẽ bị xoá. Giao dịch vẫn được giữ lại. Không thể hoàn tác.</p>,
      confirmLabel: `Xoá ${ids.length} người dùng`,
      danger: true,
    });
    if (!ok) return;
    try {
      const d = await adminFetch<{ deleted: number }>("/users/bulk-delete", { method: "POST", body: { ids } });
      toast(`Đã xoá ${d.deleted} người dùng`);
      selection.clear();
      void reload();
    } catch (err) {
      toast(errorText(err), "error");
    }
  };

  const columns: Column<UserRow>[] = [
    {
      key: "user",
      header: "Người dùng",
      cell: (u) => (
        <button type="button" className="adm-user" onClick={() => setViewing(u.id)}>
          <span className="adm-avatar" aria-hidden="true">
            {u.avatar ? <img src={u.avatar} alt="" /> : initials(u.displayName)}
          </span>
          <span className="adm-user__text">
            <strong>{u.displayName}</strong>
            <span>{u.email}</span>
          </span>
        </button>
      ),
    },
    { key: "provider", header: "Đăng nhập", cell: (u) => PROVIDER_LABEL[u.authProvider] },
    {
      key: "plan",
      header: "Gói",
      cell: (u) => (
        <span className="adm-stack">
          <span className={`badge badge--sm${u.plan === "free" ? " adm-badge--muted" : ""}`}>{planName(u.plan, plans)}</span>
          {u.premiumUntil && <span className="adm-sub">đến {dateText(u.premiumUntil)}</span>}
        </span>
      ),
    },
    { key: "lessons", header: "Đề đã luyện", align: "right", cell: (u) => u.lessonsPracticed },
    { key: "last", header: "Hoạt động", cell: (u) => (u.lastActiveAt ? relativeText(u.lastActiveAt) : "Chưa luyện") },
    { key: "created", header: "Ngày tạo", cell: (u) => dateText(u.createdAt) },
    {
      key: "status",
      header: "Trạng thái",
      cell: (u) =>
        u.status === "locked" ? (
          <StatusBadge tone="bad" icon="lock">
            Đã khoá
          </StatusBadge>
        ) : (
          <StatusBadge tone="ok">Hoạt động</StatusBadge>
        ),
    },
  ];

  const summary = data?.summary;

  return (
    <>
      <PageHead
        title="Người dùng"
        sub={summary ? `${num(summary.total)} tài khoản · ${num(summary.paid)} trả phí · ${num(summary.locked)} bị khoá` : undefined}
      />

      <div className="adm-filters">
        <label className="lesson-search adm-search">
          <Icon name="search" size={18} />
          <span className="visually-hidden">Tìm người dùng</span>
          <input type="search" placeholder="Tìm theo tên hoặc email" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </label>
        <label className="adm-select">
          <span>Đăng nhập</span>
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="">Tất cả</option>
            <option value="google">Google</option>
            <option value="local">Email</option>
          </select>
        </label>
        <label className="adm-select">
          <span>Gói</span>
          <select value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="">Tất cả</option>
            <option value="free">Miễn phí</option>
            <option value="paid">Trả phí</option>
            {plans
              .filter((p) => p.code !== "free")
              .map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <label className="adm-select">
          <span>Trạng thái</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả</option>
            <option value="active">Hoạt động</option>
            <option value="locked">Đã khoá</option>
          </select>
        </label>
      </div>

      {error && <div className="notice notice--error adm-gap">{error}</div>}

      <section className="panel table-card">
        {canWrite && (
          <BulkBar count={selection.selected.size} noun="người dùng" onClear={selection.clear}>
            <button type="button" className="btn btn--sm adm-btn--danger" onClick={removeSelected}>
              Xoá đã chọn
            </button>
          </BulkBar>
        )}
        <DataTable
          caption="Danh sách người dùng"
          rows={rows}
          columns={columns}
          rowKey={(u) => u.id}
          rowLabel={(u) => u.email}
          selection={canWrite ? selection : undefined}
          loading={loading}
          empty="Không có người dùng nào khớp bộ lọc."
          actions={(u) => (
            <>
              <RowAction icon="eye" label={`Xem ${u.email}`} onClick={() => setViewing(u.id)} />
              {canWrite && <RowAction icon="pencil" label={`Sửa ${u.email}`} onClick={() => setEditing(u)} />}
              {canWrite && <RowAction icon="trash" label={`Xoá ${u.email}`} onClick={() => removeOne(u)} danger />}
            </>
          )}
        />
        {data && <Pagination page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
      </section>

      <UserEditDialog
        user={editing}
        plans={plans}
        onClose={() => setEditing(null)}
        onSaved={(u) => {
          setEditing(null);
          toast(`Đã lưu ${u.email}`);
          void reload();
        }}
      />
      <UserDetailDrawer userId={viewing} plans={plans} onClose={() => setViewing(null)} />
    </>
  );
}
