import { useState } from "react";
import { Icon } from "../../shared/ui/Icon";
import { useAdminAuth } from "../AdminAuth";
import { NoAccess, PageHead } from "../AdminLayout";
import { adminFetch, errorText, type ContentProblem, type LessonRow } from "../api";
import { BulkBar, DataTable, RowAction, StatusBadge, useSelection, type Column } from "../components/DataTable";
import { useFeedback } from "../components/Feedback";
import { useAsync } from "../hooks";
import { durationText, lessonTitle, num } from "../format";

function examName(l: LessonRow): string {
  const s = l.source;
  if (s.type === "jlpt" && s.year && s.month) return `JLPT ${s.level ?? ""} · ${String(s.month).padStart(2, "0")}/${s.year}`;
  return lessonTitle(l.title, l.id);
}

export function ContentPage() {
  const { can } = useAdminAuth();
  const { confirm, toast } = useFeedback();
  const canWrite = can("content", "write");
  const { data, error, loading, reload } = useAsync(
    () => adminFetch<{ lessons: LessonRow[]; problems: ContentProblem[] }>("/content"),
    [],
  );
  const rows = data?.lessons ?? [];
  const selection = useSelection(rows.map((r) => r.id));
  const [reloading, setReloading] = useState(false);

  if (!can("content", "read")) return <NoAccess />;

  const setHidden = async (ids: string[], hidden: boolean) => {
    if (hidden) {
      const ok = await confirm({
        title: ids.length === 1 ? "Ẩn đề này?" : `Ẩn ${ids.length} đề?`,
        body: <p>Người học sẽ không thấy và không mở được các đề này cho tới khi hiện lại. Tiến độ đã lưu vẫn giữ nguyên.</p>,
        confirmLabel: "Ẩn đề",
      });
      if (!ok) return;
    }
    try {
      const d = await adminFetch<{ updated: number }>("/content/visibility", { method: "POST", body: { ids, hidden } });
      toast(hidden ? `Đã ẩn ${d.updated} đề` : `Đã hiện ${d.updated} đề`);
      selection.clear();
      void reload();
    } catch (err) {
      toast(errorText(err), "error");
    }
  };

  const reloadContent = async () => {
    setReloading(true);
    try {
      const d = await adminFetch<{ loaded: number; problems: ContentProblem[] }>("/content/reload", { method: "POST" });
      toast(`Đã nạp ${d.loaded} đề${d.problems.length ? `, ${d.problems.length} thư mục lỗi` : ""}`);
      void reload();
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setReloading(false);
    }
  };

  const columns: Column<LessonRow>[] = [
    {
      key: "name",
      header: "Kỳ thi",
      cell: (l) => (
        <span className="adm-user__text">
          <strong>{examName(l)}</strong>
          <span className="adm-mono">{l.id}</span>
        </span>
      ),
    },
    { key: "q", header: "Phần / câu", align: "right", cell: (l) => `${l.counts.sections} / ${l.counts.questions}` },
    { key: "seg", header: "Câu dictation", align: "right", cell: (l) => num(l.counts.dictation_segments) },
    { key: "dur", header: "Audio", align: "right", cell: (l) => durationText(l.durationMs) },
    {
      key: "status",
      header: "Trạng thái",
      cell: (l) =>
        l.hidden ? (
          <StatusBadge tone="neutral" icon="eyeOff">
            Đã ẩn
          </StatusBadge>
        ) : l.status === "published" ? (
          <StatusBadge tone="ok">Đang phát hành</StatusBadge>
        ) : (
          <StatusBadge tone="warn">{l.status}</StatusBadge>
        ),
    },
  ];

  const hiddenCount = rows.filter((l) => l.hidden).length;
  const segments = rows.reduce((a, l) => a + l.counts.dictation_segments, 0);
  const selectedRows = rows.filter((l) => selection.selected.has(l.id));

  return (
    <>
      <PageHead title="Đề thi & script" sub="Đề đọc từ thư mục backend/content khi backend khởi động">
        {canWrite && (
          <button type="button" className="btn btn--outline" onClick={reloadContent} disabled={reloading}>
            <Icon name="refresh" size={18} />
            {reloading ? "Đang nạp…" : "Nạp lại nội dung"}
          </button>
        )}
      </PageHead>

      {error && <div className="notice notice--error adm-gap">{error}</div>}

      {data && (
        <section className="kpi-grid" aria-label="Tóm tắt nội dung">
          <div className="panel kpi">
            <span className="kpi__label">Đề đã nạp</span>
            <span className="kpi__value">{rows.length}</span>
          </div>
          <div className="panel kpi">
            <span className="kpi__label">Đang hiển thị</span>
            <span className="kpi__value">{rows.length - hiddenCount}</span>
          </div>
          <div className="panel kpi">
            <span className="kpi__label">Câu dictation</span>
            <span className="kpi__value">{num(segments)}</span>
          </div>
          <div className="panel kpi">
            <span className="kpi__label">Thư mục lỗi</span>
            <span className={`kpi__value${data.problems.length ? " adm-bad-text" : ""}`}>{data.problems.length}</span>
          </div>
        </section>
      )}

      {data && data.problems.length > 0 && (
        <div className="notice notice--error adm-problems" role="alert">
          <Icon name="alert" />
          <div>
            <strong>{data.problems.length} thư mục đề không được nạp</strong>
            <ul>
              {data.problems.map((p) => (
                <li key={p.dir}>
                  <span className="adm-mono">{p.dir}</span>: {p.messages.slice(0, 3).join("; ")}
                  {p.messages.length > 3 ? ` (+${p.messages.length - 3} lỗi khác)` : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <section className="panel table-card">
        {canWrite && (
          <BulkBar count={selection.selected.size} noun="đề" onClear={selection.clear}>
            {selectedRows.some((l) => !l.hidden) && (
              <button type="button" className="btn btn--sm btn--outline" onClick={() => setHidden(selectedRows.filter((l) => !l.hidden).map((l) => l.id), true)}>
                <Icon name="eyeOff" size={16} />
                Ẩn đã chọn
              </button>
            )}
            {selectedRows.some((l) => l.hidden) && (
              <button type="button" className="btn btn--sm btn--outline" onClick={() => setHidden(selectedRows.filter((l) => l.hidden).map((l) => l.id), false)}>
                <Icon name="eye" size={16} />
                Hiện đã chọn
              </button>
            )}
          </BulkBar>
        )}
        <DataTable
          caption="Danh sách đề"
          rows={rows}
          columns={columns}
          rowKey={(l) => l.id}
          rowLabel={(l) => examName(l)}
          selection={canWrite ? selection : undefined}
          loading={loading}
          empty="Chưa nạp được đề nào."
          actions={(l) => (
            <>
              <a
                className="icon-btn adm-row-action"
                href={`/lessons/${encodeURIComponent(l.id)}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Mở ${examName(l)} như người học (tab mới)`}
                title="Mở như người học"
              >
                <Icon name="headphones" size={18} />
              </a>
              {canWrite &&
                (l.hidden ? (
                  <RowAction icon="eye" label={`Hiện ${examName(l)}`} onClick={() => setHidden([l.id], false)} />
                ) : (
                  <RowAction icon="eyeOff" label={`Ẩn ${examName(l)}`} onClick={() => setHidden([l.id], true)} />
                ))}
            </>
          )}
        />
      </section>
      <p className="muted adm-footnote">
        Đề là file trong git (listening.json + mp3) nên không xoá hay sửa script ở đây: sửa file rồi deploy lại, hoặc bấm “Nạp lại nội dung” sau khi
        thay file trên máy chủ. Ẩn đề được lưu trong database và giữ nguyên qua các lần deploy.
      </p>
    </>
  );
}
