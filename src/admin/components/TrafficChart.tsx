import { useState } from "react";
import { adminFetch } from "../api";
import { num } from "../format";
import { useAsync } from "../hooks";
import "./traffic.css";

type Traffic = {
  date: string;
  timeZone: string;
  total: number;
  series: Array<{ hour: number; views: number }>;
};

function todayInVietnam(): string {
  return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
}

function hourText(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function TrafficChart() {
  const [date, setDate] = useState(todayInVietnam);
  const [active, setActive] = useState<number | null>(null);
  const { data, error, loading, reload } = useAsync(
    () => adminFetch<Traffic>("/traffic", { query: { date } }), [date],
  );
  // Never label the previous day's results with a newly selected date.
  const shown = data?.date === date && !error ? data : null;
  const peak = Math.max(0, ...(shown?.series.map((row) => row.views) ?? []));
  const max = Math.max(2, Math.ceil(peak / 2) * 2);
  const selected = active == null ? null : shown?.series[active];

  return (
    <section className="panel card-pad adm-gap adm-traffic" aria-labelledby="traffic-title" aria-busy={loading}>
      <div className="card-pad__head adm-traffic__head">
        <h2 id="traffic-title">Lượt truy cập trong ngày</h2>
        <div className="adm-traffic__controls">
          <label className="adm-select">
            Ngày
            <input type="date" aria-label="Ngày thống kê truy cập" value={date} max={todayInVietnam()}
              onChange={(event) => {
                if (event.target.value) {
                  setDate(event.target.value);
                  setActive(null);
                }
              }} />
          </label>
          <button type="button" className="btn btn--sm" disabled={loading} onClick={() => void reload()}>Làm mới</button>
        </div>
      </div>
      <p className="muted adm-small">Giờ Việt Nam (UTC+7). Mỗi lần mở hoặc chuyển trang được tính là một lượt, bao gồm khách chưa đăng nhập; bỏ qua trang admin.</p>
      {error && <div className="notice notice--error" role="alert">{error}</div>}
      {loading && !shown && <p role="status" className="muted">Đang tải lượt truy cập…</p>}
      {shown && (
        <>
          <div className="adm-traffic__summary">
            <strong>Tổng: {num(shown.total)} lượt truy cập</strong>
            <span className="muted adm-small">Rê chuột, chạm hoặc dùng Tab để xem từng giờ.</span>
          </div>
          {shown.total === 0 && <p className="muted">Chưa ghi nhận lượt truy cập trong ngày này.</p>}
          <div className="adm-traffic__scroll">
            <div className="adm-traffic__plot">
              <div className="adm-traffic__scale" aria-hidden="true">
                <span>{num(max)}</span><span>{num(Math.round(max / 2))}</span><span>0</span>
              </div>
              <div className="adm-traffic__bars" onMouseLeave={() => setActive(null)}>
                {shown.series.map((row) => (
                  <button type="button" key={row.hour}
                    className={`adm-traffic__slot${active === row.hour ? " is-active" : ""}`}
                    aria-label={`${hourText(row.hour)} – ${hourText(row.hour + 1)}: ${num(row.views)} lượt truy cập`}
                    aria-describedby={active === row.hour ? "traffic-tooltip" : undefined}
                    onMouseEnter={() => setActive(row.hour)} onFocus={() => setActive(row.hour)}
                    onBlur={() => setActive(null)} onClick={() => setActive(row.hour)}
                    onKeyDown={(event) => { if (event.key === "Escape") setActive(null); }}>
                    <span className={`adm-traffic__bar${row.views === 0 ? " is-zero" : ""}`}
                      style={{ height: `${row.views === 0 ? 2 : Math.max(3, row.views / max * 100)}%` }} />
                    <span className="adm-traffic__hour" aria-hidden="true">{String(row.hour).padStart(2, "0")}</span>
                  </button>
                ))}
                {selected && (
                  <div id="traffic-tooltip" role="tooltip" className="adm-traffic__tooltip"
                    style={{ left: `${Math.max(16, Math.min(84, (selected.hour + 0.5) / 24 * 100))}%` }}>
                    <strong>{hourText(selected.hour)} – {hourText(selected.hour + 1)}</strong>
                    <span>{num(selected.views)} lượt truy cập</span>
                    <span>{shown.total ? (selected.views / shown.total * 100).toFixed(1).replace(".", ",") : "0"}% tổng ngày</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <p className="muted adm-small">Dữ liệu bắt đầu được ghi nhận từ khi chức năng này được triển khai.</p>
        </>
      )}
    </section>
  );
}
