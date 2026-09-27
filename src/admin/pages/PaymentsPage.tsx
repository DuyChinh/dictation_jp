import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "../../shared/ui/Icon";
import { useAdminAuth } from "../AdminAuth";
import { NoAccess, PageHead } from "../AdminLayout";
import {
  adminFetch,
  errorText,
  type CouponRow,
  type Paged,
  type PaymentGateway,
  type PaymentRow,
  type PaymentStatus,
  type PlanRow,
} from "../api";
import {
  BulkBar,
  DataTable,
  Pagination,
  RowAction,
  StatusBadge,
  useSelection,
  type Column,
  type Tone,
} from "../components/DataTable";
import { useFeedback } from "../components/Feedback";
import { Field, FormDialog } from "../components/Modal";
import { useAsync, useDebounced } from "../hooks";
import {
  dateText,
  dateTimeText,
  fromInput,
  GATEWAY_LABEL,
  num,
  PAYMENT_STATUS_LABEL,
  toDateInput,
  toDateTimeInput,
  vnd,
} from "../format";

const STATUS_TONE: Record<PaymentStatus, Tone> = { succeeded: "ok", pending: "warn", failed: "bad", refunded: "neutral" };

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <StatusBadge tone={STATUS_TONE[status]}>{PAYMENT_STATUS_LABEL[status]}</StatusBadge>;
}

type Remove = { title: string; body: string; label: string; run: () => Promise<{ deleted: number }>; done: (n: number) => string };

/** Confirms, runs the delete, reports it, then reloads. */
function useRemove(reload: () => void, clear?: () => void) {
  const { confirm, toast } = useFeedback();
  return async ({ title, body, label, run, done }: Remove) => {
    if (!(await confirm({ title, body: <p>{body}</p>, confirmLabel: label, danger: true }))) return;
    try {
      const d = await run();
      toast(done(d.deleted));
      clear?.();
      reload();
    } catch (err) {
      toast(errorText(err), "error");
    }
  };
}

// ---------------------------------------------------------------- Transactions

type PaymentsResponse = Paged<PaymentRow> & {
  summary: { monthRevenue: number; monthSucceeded: number; pending: number; monthRefunded: number };
};

const EMPTY_PAYMENT = {
  userEmail: "",
  userName: "",
  plan: "",
  amount: "",
  gateway: "bank_transfer" as PaymentGateway,
  status: "pending" as PaymentStatus,
  paidAt: "",
  note: "",
};

function PaymentDialog({
  open,
  payment,
  plans,
  onClose,
  onSaved,
}: {
  open: boolean;
  payment: PaymentRow | null;
  plans: PlanRow[];
  onClose: () => void;
  onSaved: (p: PaymentRow, created: boolean) => void;
}) {
  const [form, setForm] = useState(EMPTY_PAYMENT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      payment
        ? {
            userEmail: payment.userEmail,
            userName: payment.userName,
            plan: payment.plan,
            amount: String(payment.amount),
            gateway: payment.gateway,
            status: payment.status,
            paidAt: toDateTimeInput(payment.paidAt),
            note: payment.note,
          }
        : EMPTY_PAYMENT,
    );
  }, [open, payment]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pickPlan = (code: string) => {
    const p = plans.find((x) => x.code === code);
    setForm((f) => ({ ...f, plan: code, amount: !f.amount && p ? String(p.price) : f.amount }));
  };

  const submit = async () => {
    setBusy(true);
    try {
      const body = {
        userEmail: form.userEmail,
        userName: form.userName,
        plan: form.plan,
        amount: Number(form.amount),
        gateway: form.gateway,
        status: form.status,
        note: form.note,
        // Left empty, the server dates it when the payment becomes successful.
        paidAt: form.paidAt ? fromInput(form.paidAt) : undefined,
      };
      const d = payment
        ? await adminFetch<{ payment: PaymentRow }>(`/payments/${payment.id}`, { method: "PATCH", body })
        : await adminFetch<{ payment: PaymentRow }>("/payments", { method: "POST", body });
      onSaved(d.payment, !payment);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open={open}
      title={payment ? `Sửa giao dịch ${payment.code}` : "Thêm giao dịch"}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={payment ? "Lưu thay đổi" : "Thêm giao dịch"}
      busy={busy}
      error={error}
    >
      <div className="adm-form__row">
        <Field label="Email người dùng" htmlFor="p-email" hint="Trùng email tài khoản thì giao dịch được gắn với tài khoản đó.">
          <input id="p-email" type="email" value={form.userEmail} onChange={set("userEmail")} />
        </Field>
        <Field label="Tên người trả" htmlFor="p-name">
          <input id="p-name" value={form.userName} onChange={set("userName")} maxLength={200} />
        </Field>
      </div>
      <div className="adm-form__row">
        <Field label="Gói" htmlFor="p-plan">
          <select id="p-plan" value={form.plan} onChange={(e) => pickPlan(e.target.value)}>
            <option value="">—</option>
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
            {form.plan && !plans.some((p) => p.code === form.plan) && <option value={form.plan}>{form.plan}</option>}
          </select>
        </Field>
        <Field label="Số tiền (₫)" htmlFor="p-amount">
          <input id="p-amount" type="number" min={0} step={1000} required value={form.amount} onChange={set("amount")} />
        </Field>
      </div>
      <div className="adm-form__row">
        <Field label="Cổng thanh toán" htmlFor="p-gateway">
          <select id="p-gateway" value={form.gateway} onChange={set("gateway")}>
            {(Object.keys(GATEWAY_LABEL) as PaymentGateway[]).map((g) => (
              <option key={g} value={g}>
                {GATEWAY_LABEL[g]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Trạng thái" htmlFor="p-status">
          <select id="p-status" value={form.status} onChange={set("status")}>
            {(Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[]).map((s) => (
              <option key={s} value={s}>
                {PAYMENT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Thời điểm thanh toán" htmlFor="p-paid" hint="Để trống: tự điền khi chuyển sang Thành công.">
        <input id="p-paid" type="datetime-local" value={form.paidAt} onChange={set("paidAt")} />
      </Field>
      <Field label="Ghi chú" htmlFor="p-note" hint="Ví dụ: nội dung chuyển khoản, lý do hoàn tiền.">
        <textarea id="p-note" rows={3} maxLength={1000} value={form.note} onChange={set("note")} />
      </Field>
    </FormDialog>
  );
}

function TransactionsTab({ plans, initialStatus }: { plans: PlanRow[]; initialStatus: string }) {
  const { can } = useAdminAuth();
  const { toast } = useFeedback();
  const canWrite = can("payments", "write");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [gateway, setGateway] = useState("");
  const [from, setFrom] = useState("");
  const [page, setPage] = useState(1);
  const query = useDebounced(q);
  useEffect(() => setPage(1), [query, status, gateway, from]);

  const { data, error, loading, reload } = useAsync(
    () => adminFetch<PaymentsResponse>("/payments", { query: { q: query, status, gateway, from, page, limit: 20 } }),
    [query, status, gateway, from, page],
  );
  const rows = data?.items ?? [];
  const selection = useSelection(rows.map((r) => r.id));
  const remove = useRemove(() => void reload(), selection.clear);
  const [dialog, setDialog] = useState<{ payment: PaymentRow | null } | null>(null);

  const confirmPaid = async (p: PaymentRow) => {
    try {
      await adminFetch(`/payments/${p.id}`, { method: "PATCH", body: { status: "succeeded" } });
      toast(`Đã xác nhận ${p.code}`);
      void reload();
    } catch (err) {
      toast(errorText(err), "error");
    }
  };

  const columns: Column<PaymentRow>[] = [
    { key: "code", header: "Mã GD", cell: (p) => <span className="adm-mono">{p.code}</span> },
    {
      key: "user",
      header: "Người dùng",
      cell: (p) => (
        <span className="adm-user__text">
          <strong>{p.userName || "—"}</strong>
          <span>{p.userEmail || "Không có email"}</span>
        </span>
      ),
    },
    { key: "plan", header: "Gói", cell: (p) => plans.find((x) => x.code === p.plan)?.name ?? (p.plan || "—") },
    { key: "amount", header: "Số tiền", align: "right", cell: (p) => <strong>{vnd(p.amount)}</strong> },
    { key: "gateway", header: "Cổng", cell: (p) => GATEWAY_LABEL[p.gateway] },
    { key: "status", header: "Trạng thái", cell: (p) => <PaymentStatusBadge status={p.status} /> },
    { key: "time", header: "Thời gian", cell: (p) => dateTimeText(p.createdAt) },
  ];

  const s = data?.summary;

  return (
    <>
      {s && (
        <section className="kpi-grid" aria-label="Chỉ số thanh toán">
          <div className="panel kpi">
            <span className="kpi__label">Doanh thu tháng này</span>
            <span className="kpi__value">{vnd(s.monthRevenue)}</span>
          </div>
          <div className="panel kpi">
            <span className="kpi__label">Giao dịch thành công (tháng)</span>
            <span className="kpi__value">{num(s.monthSucceeded)}</span>
          </div>
          <div className="panel kpi">
            <span className="kpi__label">Chờ xác nhận</span>
            <span className={`kpi__value${s.pending ? " adm-warn-text" : ""}`}>{num(s.pending)}</span>
          </div>
          <div className="panel kpi">
            <span className="kpi__label">Hoàn tiền (tháng)</span>
            <span className="kpi__value">{num(s.monthRefunded)}</span>
          </div>
        </section>
      )}

      <div className="adm-filters">
        <label className="lesson-search adm-search">
          <Icon name="search" size={18} />
          <span className="visually-hidden">Tìm giao dịch</span>
          <input type="search" placeholder="Mã giao dịch, email, tên, ghi chú" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </label>
        <label className="adm-select">
          <span>Trạng thái</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả</option>
            {(Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[]).map((k) => (
              <option key={k} value={k}>
                {PAYMENT_STATUS_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="adm-select">
          <span>Cổng</span>
          <select value={gateway} onChange={(e) => setGateway(e.target.value)}>
            <option value="">Tất cả</option>
            {(Object.keys(GATEWAY_LABEL) as PaymentGateway[]).map((k) => (
              <option key={k} value={k}>
                {GATEWAY_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="adm-select">
          <span>Từ ngày</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        {canWrite && (
          <button type="button" className="btn btn--primary" onClick={() => setDialog({ payment: null })}>
            <Icon name="plus" size={18} />
            Thêm giao dịch
          </button>
        )}
      </div>

      {error && <div className="notice notice--error adm-gap">{error}</div>}

      <section className="panel table-card">
        {canWrite && (
          <BulkBar count={selection.selected.size} noun="giao dịch" onClear={selection.clear}>
            <button
              type="button"
              className="btn btn--sm adm-btn--danger"
              onClick={() =>
                remove({
                  title: `Xoá ${selection.selected.size} giao dịch?`,
                  body: "Các giao dịch đã chọn sẽ bị xoá khỏi sổ. Không thể hoàn tác.",
                  label: "Xoá giao dịch",
                  run: () => adminFetch("/payments/bulk-delete", { method: "POST", body: { ids: [...selection.selected] } }),
                  done: (n) => `Đã xoá ${n} giao dịch`,
                })
              }
            >
              Xoá đã chọn
            </button>
          </BulkBar>
        )}
        <DataTable
          caption="Danh sách giao dịch"
          rows={rows}
          columns={columns}
          rowKey={(p) => p.id}
          rowLabel={(p) => p.code}
          selection={canWrite ? selection : undefined}
          loading={loading}
          empty="Chưa có giao dịch nào khớp bộ lọc."
          actions={
            canWrite
              ? (p) => (
                  <>
                    {p.status === "pending" && (
                      <RowAction icon="check" label={`Xác nhận đã nhận tiền ${p.code}`} onClick={() => confirmPaid(p)} />
                    )}
                    <RowAction icon="pencil" label={`Sửa ${p.code}`} onClick={() => setDialog({ payment: p })} />
                    <RowAction
                      icon="trash"
                      label={`Xoá ${p.code}`}
                      danger
                      onClick={() =>
                        remove({
                          title: "Xoá giao dịch?",
                          body: `Xoá ${p.code} (${vnd(p.amount)}) khỏi sổ. Không thể hoàn tác.`,
                          label: "Xoá giao dịch",
                          run: () => adminFetch(`/payments/${p.id}`, { method: "DELETE" }),
                          done: () => `Đã xoá ${p.code}`,
                        })
                      }
                    />
                  </>
                )
              : undefined
          }
        />
        {data && <Pagination page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
      </section>

      <PaymentDialog
        open={dialog !== null}
        payment={dialog?.payment ?? null}
        plans={plans}
        onClose={() => setDialog(null)}
        onSaved={(p, created) => {
          setDialog(null);
          toast(created ? `Đã thêm ${p.code}` : `Đã lưu ${p.code}`);
          void reload();
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------- Plans

const EMPTY_PLAN = { code: "", name: "", price: "0", durationDays: "30", features: "", active: true, sortOrder: "0" };

function PlanDialog({
  open,
  plan,
  onClose,
  onSaved,
}: {
  open: boolean;
  plan: PlanRow | null;
  onClose: () => void;
  onSaved: (p: PlanRow, created: boolean) => void;
}) {
  const [form, setForm] = useState(EMPTY_PLAN);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      plan
        ? {
            code: plan.code,
            name: plan.name,
            price: String(plan.price),
            durationDays: String(plan.durationDays),
            features: plan.features.join("\n"),
            active: plan.active,
            sortOrder: String(plan.sortOrder),
          }
        : EMPTY_PLAN,
    );
  }, [open, plan]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    try {
      const body = {
        name: form.name,
        price: Number(form.price),
        durationDays: Number(form.durationDays),
        features: form.features
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
        active: form.active,
        sortOrder: Number(form.sortOrder),
      };
      const d = plan
        ? await adminFetch<{ plan: PlanRow }>(`/catalog/plans/${plan.id}`, { method: "PATCH", body })
        : await adminFetch<{ plan: PlanRow }>("/catalog/plans", { method: "POST", body: { ...body, code: form.code } });
      onSaved(d.plan, !plan);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open={open}
      title={plan ? `Sửa gói ${plan.name}` : "Thêm gói"}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={plan ? "Lưu thay đổi" : "Thêm gói"}
      busy={busy}
      error={error}
    >
      <div className="adm-form__row">
        <Field label="Tên gói" htmlFor="pl-name">
          <input id="pl-name" required maxLength={100} value={form.name} onChange={set("name")} />
        </Field>
        <Field label="Mã gói" htmlFor="pl-code" hint={plan ? "Không đổi được sau khi tạo." : "a-z, 0-9, _ hoặc -. Ví dụ: premium_month"}>
          <input
            id="pl-code"
            required
            pattern="[a-zA-Z0-9_\-]{2,40}"
            value={form.code}
            onChange={set("code")}
            disabled={Boolean(plan)}
            spellCheck={false}
          />
        </Field>
      </div>
      <div className="adm-form__row">
        <Field label="Giá (₫)" htmlFor="pl-price">
          <input id="pl-price" type="number" min={0} step={1000} required value={form.price} onChange={set("price")} />
        </Field>
        <Field label="Thời hạn (ngày)" htmlFor="pl-days" hint="0 = không hết hạn.">
          <input id="pl-days" type="number" min={0} max={3650} required value={form.durationDays} onChange={set("durationDays")} />
        </Field>
      </div>
      <Field label="Quyền lợi" htmlFor="pl-features" hint="Mỗi dòng một quyền lợi.">
        <textarea id="pl-features" rows={4} value={form.features} onChange={set("features")} />
      </Field>
      <div className="adm-form__row">
        <Field label="Thứ tự hiển thị" htmlFor="pl-order">
          <input id="pl-order" type="number" min={0} max={1000} value={form.sortOrder} onChange={set("sortOrder")} />
        </Field>
        <label className="adm-toggle">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
          Đang bán
        </label>
      </div>
    </FormDialog>
  );
}

function PlansTab({ onChanged }: { onChanged: () => void }) {
  const { can } = useAdminAuth();
  const { toast } = useFeedback();
  const canWrite = can("catalog", "write");
  const { data, error, loading, reload } = useAsync(
    () => adminFetch<{ items: PlanRow[]; freeUsers: number }>("/catalog/plans"),
    [],
  );
  const rows = data?.items ?? [];
  const selection = useSelection(rows.map((r) => r.id));
  const refresh = () => {
    void reload();
    onChanged();
  };
  const remove = useRemove(refresh, selection.clear);
  const [dialog, setDialog] = useState<{ plan: PlanRow | null } | null>(null);

  const columns: Column<PlanRow>[] = [
    {
      key: "name",
      header: "Gói",
      cell: (p) => (
        <span className="adm-user__text">
          <strong>{p.name}</strong>
          <span className="adm-mono">{p.code}</span>
        </span>
      ),
    },
    { key: "price", header: "Giá", align: "right", cell: (p) => <strong>{vnd(p.price)}</strong> },
    { key: "days", header: "Thời hạn", cell: (p) => (p.durationDays ? `${p.durationDays} ngày` : "Không hết hạn") },
    { key: "features", header: "Quyền lợi", cell: (p) => (p.features.length ? p.features.join(" · ") : "—") },
    { key: "users", header: "Người dùng", align: "right", cell: (p) => num(p.users) },
    {
      key: "active",
      header: "Trạng thái",
      cell: (p) => (p.active ? <StatusBadge tone="ok">Đang bán</StatusBadge> : <StatusBadge tone="neutral" icon="eyeOff">Ngừng bán</StatusBadge>),
    },
  ];

  return (
    <>
      <div className="adm-filters">
        <p className="muted adm-filters__note">
          {data ? `${num(data.freeUsers)} người dùng đang ở gói Miễn phí (mặc định, không cần tạo).` : " "}
        </p>
        {canWrite && (
          <button type="button" className="btn btn--primary" onClick={() => setDialog({ plan: null })}>
            <Icon name="plus" size={18} />
            Thêm gói
          </button>
        )}
      </div>
      {error && <div className="notice notice--error adm-gap">{error}</div>}
      <section className="panel table-card">
        {canWrite && (
          <BulkBar count={selection.selected.size} noun="gói" onClear={selection.clear}>
            <button
              type="button"
              className="btn btn--sm adm-btn--danger"
              onClick={() =>
                remove({
                  title: `Xoá ${selection.selected.size} gói?`,
                  body: "Chỉ xoá được gói không còn người dùng. Không thể hoàn tác.",
                  label: "Xoá gói",
                  run: () => adminFetch("/catalog/plans/bulk-delete", { method: "POST", body: { ids: [...selection.selected] } }),
                  done: (n) => `Đã xoá ${n} gói`,
                })
              }
            >
              Xoá đã chọn
            </button>
          </BulkBar>
        )}
        <DataTable
          caption="Danh sách gói đăng ký"
          rows={rows}
          columns={columns}
          rowKey={(p) => p.id}
          rowLabel={(p) => p.name}
          selection={canWrite ? selection : undefined}
          loading={loading}
          empty="Chưa có gói trả phí nào. Bấm “Thêm gói” để tạo."
          actions={
            canWrite
              ? (p) => (
                  <>
                    <RowAction icon="pencil" label={`Sửa ${p.name}`} onClick={() => setDialog({ plan: p })} />
                    <RowAction
                      icon="trash"
                      label={`Xoá ${p.name}`}
                      danger
                      onClick={() =>
                        remove({
                          title: "Xoá gói?",
                          body: p.users
                            ? `${p.name} còn ${p.users} người dùng; hãy chuyển họ sang gói khác trước.`
                            : `Xoá gói ${p.name}. Không thể hoàn tác.`,
                          label: "Xoá gói",
                          run: () => adminFetch(`/catalog/plans/${p.id}`, { method: "DELETE" }),
                          done: () => `Đã xoá ${p.name}`,
                        })
                      }
                    />
                  </>
                )
              : undefined
          }
        />
      </section>
      <PlanDialog
        open={dialog !== null}
        plan={dialog?.plan ?? null}
        onClose={() => setDialog(null)}
        onSaved={(p, created) => {
          setDialog(null);
          toast(created ? `Đã thêm gói ${p.name}` : `Đã lưu gói ${p.name}`);
          refresh();
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------- Coupons

const EMPTY_COUPON = {
  code: "",
  description: "",
  discountType: "percent" as "percent" | "fixed",
  discountValue: "",
  maxUses: "",
  expiresAt: "",
  active: true,
};

function CouponDialog({
  open,
  coupon,
  onClose,
  onSaved,
}: {
  open: boolean;
  coupon: CouponRow | null;
  onClose: () => void;
  onSaved: (c: CouponRow, created: boolean) => void;
}) {
  const [form, setForm] = useState(EMPTY_COUPON);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      coupon
        ? {
            code: coupon.code,
            description: coupon.description,
            discountType: coupon.discountType,
            discountValue: String(coupon.discountValue),
            maxUses: coupon.maxUses == null ? "" : String(coupon.maxUses),
            expiresAt: toDateInput(coupon.expiresAt),
            active: coupon.active,
          }
        : EMPTY_COUPON,
    );
  }, [open, coupon]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    try {
      const body = {
        code: form.code,
        description: form.description,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        expiresAt: fromInput(form.expiresAt, true),
        active: form.active,
      };
      const d = coupon
        ? await adminFetch<{ coupon: CouponRow }>(`/catalog/coupons/${coupon.id}`, { method: "PATCH", body })
        : await adminFetch<{ coupon: CouponRow }>("/catalog/coupons", { method: "POST", body });
      onSaved(d.coupon, !coupon);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open={open}
      title={coupon ? `Sửa mã ${coupon.code}` : "Tạo mã giảm giá"}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={coupon ? "Lưu thay đổi" : "Tạo mã"}
      busy={busy}
      error={error}
    >
      <div className="adm-form__row">
        <Field label="Mã" htmlFor="c-code" hint="A-Z, 0-9, _ hoặc -.">
          <input
            id="c-code"
            required
            pattern="[a-zA-Z0-9_\-]{2,40}"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            spellCheck={false}
          />
        </Field>
        <Field label="Áp dụng / mô tả" htmlFor="c-desc">
          <input id="c-desc" maxLength={300} value={form.description} onChange={set("description")} />
        </Field>
      </div>
      <div className="adm-form__row">
        <Field label="Kiểu giảm" htmlFor="c-type">
          <select id="c-type" value={form.discountType} onChange={set("discountType")}>
            <option value="percent">Phần trăm (%)</option>
            <option value="fixed">Số tiền (₫)</option>
          </select>
        </Field>
        <Field label={form.discountType === "percent" ? "Giảm (%)" : "Giảm (₫)"} htmlFor="c-value">
          <input
            id="c-value"
            type="number"
            required
            min={0}
            max={form.discountType === "percent" ? 100 : undefined}
            step={form.discountType === "percent" ? 1 : 1000}
            value={form.discountValue}
            onChange={set("discountValue")}
          />
        </Field>
      </div>
      <div className="adm-form__row">
        <Field label="Giới hạn lượt dùng" htmlFor="c-max" hint="Để trống = không giới hạn.">
          <input id="c-max" type="number" min={1} value={form.maxUses} onChange={set("maxUses")} />
        </Field>
        <Field label="Hết hạn" htmlFor="c-exp" hint="Để trống = không hết hạn.">
          <input id="c-exp" type="date" value={form.expiresAt} onChange={set("expiresAt")} />
        </Field>
      </div>
      <label className="adm-toggle">
        <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
        Đang bật
      </label>
    </FormDialog>
  );
}

function couponState(c: CouponRow): { tone: Tone; label: string } {
  if (!c.active) return { tone: "neutral", label: "Đã tắt" };
  if (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()) return { tone: "bad", label: "Hết hạn" };
  if (c.maxUses != null && c.usedCount >= c.maxUses) return { tone: "warn", label: "Hết lượt" };
  return { tone: "ok", label: "Đang bật" };
}

function CouponsTab() {
  const { can } = useAdminAuth();
  const { toast } = useFeedback();
  const canWrite = can("catalog", "write");
  const { data, error, loading, reload } = useAsync(() => adminFetch<{ items: CouponRow[] }>("/catalog/coupons"), []);
  const rows = data?.items ?? [];
  const selection = useSelection(rows.map((r) => r.id));
  const remove = useRemove(() => void reload(), selection.clear);
  const [dialog, setDialog] = useState<{ coupon: CouponRow | null } | null>(null);

  const columns: Column<CouponRow>[] = [
    { key: "code", header: "Mã", cell: (c) => <strong className="adm-mono">{c.code}</strong> },
    { key: "desc", header: "Áp dụng", cell: (c) => c.description || "—" },
    {
      key: "off",
      header: "Giảm",
      align: "right",
      cell: (c) => <strong>{c.discountType === "percent" ? `-${c.discountValue}%` : `-${vnd(c.discountValue)}`}</strong>,
    },
    { key: "used", header: "Đã dùng", align: "right", cell: (c) => `${num(c.usedCount)} / ${c.maxUses == null ? "∞" : num(c.maxUses)}` },
    { key: "exp", header: "Hết hạn", cell: (c) => (c.expiresAt ? dateText(c.expiresAt) : "Không hết hạn") },
    {
      key: "state",
      header: "Trạng thái",
      cell: (c) => {
        const s = couponState(c);
        return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
      },
    },
  ];

  return (
    <>
      <div className="adm-filters">
        <p className="muted adm-filters__note">Mã giảm giá áp dụng khi có trang thanh toán; hiện dùng để theo dõi thủ công.</p>
        {canWrite && (
          <button type="button" className="btn btn--primary" onClick={() => setDialog({ coupon: null })}>
            <Icon name="plus" size={18} />
            Tạo mã giảm giá
          </button>
        )}
      </div>
      {error && <div className="notice notice--error adm-gap">{error}</div>}
      <section className="panel table-card">
        {canWrite && (
          <BulkBar count={selection.selected.size} noun="mã" onClear={selection.clear}>
            <button
              type="button"
              className="btn btn--sm adm-btn--danger"
              onClick={() =>
                remove({
                  title: `Xoá ${selection.selected.size} mã giảm giá?`,
                  body: "Các mã đã chọn sẽ không dùng được nữa. Không thể hoàn tác.",
                  label: "Xoá mã",
                  run: () => adminFetch("/catalog/coupons/bulk-delete", { method: "POST", body: { ids: [...selection.selected] } }),
                  done: (n) => `Đã xoá ${n} mã giảm giá`,
                })
              }
            >
              Xoá đã chọn
            </button>
          </BulkBar>
        )}
        <DataTable
          caption="Danh sách mã giảm giá"
          rows={rows}
          columns={columns}
          rowKey={(c) => c.id}
          rowLabel={(c) => c.code}
          selection={canWrite ? selection : undefined}
          loading={loading}
          empty="Chưa có mã giảm giá nào."
          actions={
            canWrite
              ? (c) => (
                  <>
                    <RowAction icon="pencil" label={`Sửa ${c.code}`} onClick={() => setDialog({ coupon: c })} />
                    <RowAction
                      icon="trash"
                      label={`Xoá ${c.code}`}
                      danger
                      onClick={() =>
                        remove({
                          title: "Xoá mã giảm giá?",
                          body: `Xoá mã ${c.code}. Không thể hoàn tác.`,
                          label: "Xoá mã",
                          run: () => adminFetch(`/catalog/coupons/${c.id}`, { method: "DELETE" }),
                          done: () => `Đã xoá ${c.code}`,
                        })
                      }
                    />
                  </>
                )
              : undefined
          }
        />
      </section>
      <CouponDialog
        open={dialog !== null}
        coupon={dialog?.coupon ?? null}
        onClose={() => setDialog(null)}
        onSaved={(c, created) => {
          setDialog(null);
          toast(created ? `Đã tạo mã ${c.code}` : `Đã lưu mã ${c.code}`);
          void reload();
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------- Page

type TabId = "transactions" | "plans" | "coupons";

export function PaymentsPage() {
  const { can } = useAdminAuth();
  const [params, setParams] = useSearchParams();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [plansVersion, setPlansVersion] = useState(0);

  const tabs: Array<{ id: TabId; label: string; visible: boolean }> = [
    { id: "transactions", label: "Giao dịch", visible: can("payments", "read") },
    { id: "plans", label: "Gói đăng ký", visible: can("catalog", "read") },
    { id: "coupons", label: "Mã giảm giá", visible: can("catalog", "read") },
  ];
  const visible = tabs.filter((t) => t.visible);
  const requested = params.get("tab") as TabId | null;
  const tab = visible.find((t) => t.id === requested)?.id ?? visible[0]?.id;

  useEffect(() => {
    if (!can("payments", "read") && !can("catalog", "read") && !can("users", "read")) return;
    adminFetch<{ items: PlanRow[] }>("/catalog/plans")
      .then((d) => setPlans(d.items))
      .catch(() => setPlans([]));
  }, [can, plansVersion]);

  if (!tab) return <NoAccess />;

  return (
    <>
      <PageHead title="Thanh toán" sub="Giao dịch, gói đăng ký và mã giảm giá" />
      <div className="adm-tabs" role="tablist" aria-label="Mục thanh toán">
        {visible.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setParams(t.id === "transactions" ? {} : { tab: t.id }, { replace: true })}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "transactions" && <TransactionsTab plans={plans} initialStatus={params.get("status") ?? ""} />}
        {tab === "plans" && <PlansTab onChanged={() => setPlansVersion((v) => v + 1)} />}
        {tab === "coupons" && <CouponsTab />}
      </div>
    </>
  );
}
