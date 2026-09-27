import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../shared/ui/Icon";
import { useAdminAuth } from "../AdminAuth";
import { PageHead } from "../AdminLayout";
import { adminFetch, type Overview } from "../api";
import { useAsync } from "../hooks";
import { dateTimeText, lessonTitle, num, vnd } from "../format";
import { PaymentStatusBadge } from "./PaymentsPage";

const RANGES = [7, 30, 90] as const;

function dayLabel(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

function delta(now: number, before: number): string | null {
  if (before === 0) return null;
  const pct = Math.round(((now - before) / before) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}% so với kỳ trước`;
}

function RevenueChart({ series }: { series: Array<{ date: string; amount: number }> }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...series.map((d) => d.amount));
  const total = series.reduce((a, d) => a + d.amount, 0);
  const shown = hover == null ? null : series[hover];
  const mid = series[Math.floor(series.length / 2)];

  return (
    <section className="panel card-pad">
      <div className="card-pad__head">
        <h2>Doanh thu theo ngày</h2>
        <span aria-live="polite" className="adm-chart__readout">
          {shown ? `${dayLabel(shown.date)} · ${vnd(shown.amount)}` : `Tổng ${vnd(total)}`}
        </span>
      </div>
      <div className="bars adm-bars" onMouseLeave={() => setHover(null)} aria-hidden="true">
        {series.map((d, i) => (
          <span
            key={d.date}
            className={`${d.amount === 0 ? "is-zero" : ""}${hover === i ? " is-hover" : ""}`}
            style={{ height: `${d.amount === 0 ? 3 : Math.max(6, Math.round((d.amount / max) * 190))}px` }}
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </div>
      <div className="bars-axis" aria-hidden="true">
        <span>{series[0] && dayLabel(series[0].date)}</span>
        <span>{mid && dayLabel(mid.date)}</span>
        <span>{series.length > 0 && dayLabel(series[series.length - 1]!.date)}</span>
      </div>
      <table className="visually-hidden">
        <caption>Doanh thu theo ngày</caption>
        <tbody>
          {series.map((d) => (
            <tr key={d.date}>
              <th scope="row">{dayLabel(d.date)}</th>
              <td>{vnd(d.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function OverviewPage() {
  const { can } = useAdminAuth();
  const [days, setDays] = useState<number>(30);
  const { data, error, loading } = useAsync(() => adminFetch<Overview>("/overview", { query: { days } }), [days]);

  const maxTop = Math.max(1, ...(data?.topLessons.map((l) => l.sessions) ?? [1]));
  const todo = data
    ? [
        data.payments && data.payments.pending > 0
          ? {
              to: "/admin/payments?status=pending",
              tone: "warn",
              title: `${data.payments.pending} giao dịch chờ xác nhận`,
              sub: "Kiểm tra và đối soát",
            }
          : null,
        data.content.problems.length > 0 && can("content", "read")
          ? {
              to: "/admin/content",
              tone: "bad",
              title: `${data.content.problems.length} thư mục đề không được nạp`,
              sub: data.content.problems.map((p) => p.dir).join(" · "),
            }
          : null,
        data.content.hidden > 0 && can("content", "read")
          ? { to: "/admin/content", tone: "neutral", title: `${data.content.hidden} đề đang bị ẩn`, sub: "Người học không thấy các đề này" }
          : null,
      ].filter((x): x is NonNullable<typeof x> => x !== null)
    : [];

  return (
    <>
      <PageHead title="Tổng quan" sub={`${days} ngày gần nhất`}>
        <div className="segmented" role="group" aria-label="Khoảng thời gian">
          {RANGES.map((r) => (
            <button key={r} type="button" aria-pressed={days === r} onClick={() => setDays(r)}>
              {r} ngày
            </button>
          ))}
        </div>
      </PageHead>

      {error && <div className="notice notice--error adm-gap">{error}</div>}

      {data && (
        <>
          <section className="kpi-grid" aria-label="Chỉ số chính">
            <div className="panel kpi">
              <span className="kpi__label">Tổng người dùng</span>
              <span className="kpi__value">{num(data.users.total)}</span>
              <span className="kpi__note">+{num(data.users.new)} đăng ký mới</span>
            </div>
            <div className="panel kpi">
              <span className="kpi__label">Đang luyện</span>
              <span className="kpi__value">{num(data.users.active)}</span>
              <span className="kpi__note">
                {data.users.total ? Math.round((data.users.active / data.users.total) * 100) : 0}% tổng người dùng
              </span>
            </div>
            {data.payments ? (
              <div className="panel kpi">
                <span className="kpi__label">Doanh thu</span>
                <span className="kpi__value">{vnd(data.payments.revenue)}</span>
                <span className="kpi__note">
                  {delta(data.payments.revenue, data.payments.previousRevenue) ?? `${data.payments.succeeded} giao dịch thành công`}
                </span>
              </div>
            ) : (
              <div className="panel kpi">
                <span className="kpi__label">Đề đang hiển thị</span>
                <span className="kpi__value">{data.content.published - data.content.hidden}</span>
                <span className="kpi__note">{data.content.hidden} đề bị ẩn</span>
              </div>
            )}
            <div className="panel kpi">
              <span className="kpi__label">Tài khoản trả phí</span>
              <span className="kpi__value">{num(data.users.paid)}</span>
              <span className="kpi__note">
                Tỉ lệ {data.users.total ? ((data.users.paid / data.users.total) * 100).toFixed(1).replace(".", ",") : 0}%
              </span>
            </div>
          </section>

          <div className="split-2">
            {data.payments ? (
              <RevenueChart series={data.payments.series} />
            ) : (
              <section className="panel card-pad">
                <h2>Doanh thu</h2>
                <p className="muted">Vai trò của bạn không xem được số liệu thanh toán.</p>
              </section>
            )}

            <section className="panel card-pad">
              <h2>Cần xử lý</h2>
              {todo.length === 0 ? (
                <p className="muted adm-empty-line">
                  <Icon name="check" size={18} /> Không có việc nào đang chờ.
                </p>
              ) : (
                <ul className="adm-todo">
                  {todo.map((t) => (
                    <li key={t.title}>
                      <Link to={t.to} className={`adm-todo__item adm-todo__item--${t.tone}`}>
                        <Icon name={t.tone === "warn" ? "clock" : t.tone === "bad" ? "alert" : "eyeOff"} />
                        <span className="adm-todo__text">
                          <strong>{t.title}</strong>
                          <span>{t.sub}</span>
                        </span>
                        <Icon name="chevronRight" size={16} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="split-2">
            {data.payments && (
              <section className="panel card-pad">
                <div className="card-pad__head">
                  <h2>Giao dịch gần đây</h2>
                  <Link to="/admin/payments" className="adm-link">
                    Xem tất cả
                  </Link>
                </div>
                {data.payments.recent.length === 0 ? (
                  <p className="muted">Chưa có giao dịch.</p>
                ) : (
                  <ul className="adm-list">
                    {data.payments.recent.map((p) => (
                      <li key={p.id} className="adm-list__row">
                        <span className="adm-list__main">
                          <strong>{p.userName || p.userEmail || "—"}</strong>
                          <span className="muted">
                            {dateTimeText(p.createdAt)} · {p.plan || "—"}
                          </span>
                        </span>
                        <span className="tabular adm-list__amount">{vnd(p.amount)}</span>
                        <PaymentStatusBadge status={p.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <section className="panel card-pad">
              <div className="card-pad__head">
                <h2>Đề được luyện nhiều nhất</h2>
                <span>số phiên</span>
              </div>
              {data.topLessons.length === 0 ? (
                <p className="muted">Chưa có phiên luyện nào trong khoảng này.</p>
              ) : (
                data.topLessons.map((l) => (
                  <div key={l.lessonId} className="meter">
                    <div className="meter__label">
                      <span>{lessonTitle(l.title, l.lessonId)}</span>
                      <span>{num(l.sessions)}</span>
                    </div>
                    <div className="progress">
                      <span style={{ width: `${Math.round((l.sessions / maxTop) * 100)}%` }} />
                    </div>
                  </div>
                ))
              )}
            </section>
          </div>
        </>
      )}
      {loading && !data && <div className="adm-loading">Đang tải…</div>}
    </>
  );
}
