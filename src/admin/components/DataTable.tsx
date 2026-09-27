import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "../../shared/ui/Icon";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "right";
  /** Visually hide the header text (it still labels the column). */
  hideHeader?: boolean;
};

export type Selection = {
  selected: Set<string>;
  toggle: (id: string) => void;
  /** Selects every id given, or clears them if they are all selected already. */
  toggleAll: (ids: string[]) => void;
  clear: () => void;
};

/** Selected row ids; ids no longer in `available` drop out when the list reloads. */
export function useSelection(available: string[]): Selection {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const key = available.join(",");

  useEffect(() => {
    const keep = new Set(available);
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => keep.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [key]);

  return useMemo(
    () => ({
      selected,
      toggle: (id: string) =>
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      toggleAll: (ids: string[]) =>
        setSelected((prev) => {
          const all = ids.length > 0 && ids.every((id) => prev.has(id));
          const next = new Set(prev);
          for (const id of ids) {
            if (all) next.delete(id);
            else next.add(id);
          }
          return next;
        }),
      clear: () => setSelected(new Set()),
    }),
    [selected],
  );
}

function HeaderCheckbox({ ids, selection, label }: { ids: string[]; selection: Selection; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const count = ids.filter((id) => selection.selected.has(id)).length;
  const all = ids.length > 0 && count === ids.length;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = count > 0 && !all;
  }, [count, all]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="adm-check"
      checked={all}
      disabled={ids.length === 0}
      onChange={() => selection.toggleAll(ids)}
      aria-label={label}
    />
  );
}

type DataTableProps<T> = {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Short name of a row for screen-reader labels, e.g. the user's email. */
  rowLabel: (row: T) => string;
  selection?: Selection;
  /** Rows that can't be selected (e.g. your own admin account). */
  selectable?: (row: T) => boolean;
  actions?: (row: T) => ReactNode;
  loading?: boolean;
  empty?: ReactNode;
  caption: string;
};

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  rowLabel,
  selection,
  selectable,
  actions,
  loading,
  empty,
  caption,
}: DataTableProps<T>) {
  const selectableIds = rows.filter((r) => !selectable || selectable(r)).map(rowKey);
  const span = columns.length + (selection ? 1 : 0) + (actions ? 1 : 0);

  return (
    <div className="adm-table-wrap" aria-busy={loading || undefined}>
      <table className="data-table adm-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {selection && (
              <th className="adm-table__check" scope="col">
                <HeaderCheckbox ids={selectableIds} selection={selection} label="Chọn tất cả trên trang này" />
              </th>
            )}
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.align === "right" ? "is-right" : undefined}>
                {c.hideHeader ? <span className="visually-hidden">{c.header}</span> : c.header}
              </th>
            ))}
            {actions && (
              <th scope="col" className="is-right">
                Thao tác
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={span} className="adm-table__empty">
                {loading ? "Đang tải…" : (empty ?? "Không có dữ liệu.")}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const id = rowKey(row);
              const checked = selection?.selected.has(id) ?? false;
              const canSelect = !selectable || selectable(row);
              return (
                <tr key={id} className={checked ? "is-selected" : undefined}>
                  {selection && (
                    <td className="adm-table__check">
                      {canSelect && (
                        <input
                          type="checkbox"
                          className="adm-check"
                          checked={checked}
                          onChange={() => selection.toggle(id)}
                          aria-label={`Chọn ${rowLabel(row)}`}
                        />
                      )}
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={c.align === "right" ? "is-right num" : undefined}>
                      {c.cell(row)}
                    </td>
                  ))}
                  {actions && (
                    <td className="is-right">
                      <div className="adm-row-actions">{actions(row)}</div>
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

/** An icon-only row action with a visible tooltip and a spoken label. */
export function RowAction({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-btn adm-row-action${danger ? " is-danger" : ""}`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Icon name={icon} size={18} />
    </button>
  );
}

/** Shown while rows are selected: the count and what can be done to all of them. */
export function BulkBar({
  count,
  noun,
  onClear,
  children,
}: {
  count: number;
  noun: string;
  onClear: () => void;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="adm-bulk" role="region" aria-label="Thao tác hàng loạt">
      <span className="adm-bulk__count" aria-live="polite">
        Đã chọn {count} {noun}
      </span>
      <div className="adm-bulk__actions">
        {children}
        <button type="button" className="btn btn--ghost btn--sm" onClick={onClear}>
          Bỏ chọn
        </button>
      </div>
    </div>
  );
}

export function Pagination({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  // Up to five page numbers around the current one.
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const nums = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);

  return (
    <nav className="adm-pager" aria-label="Phân trang">
      <span className="adm-pager__info">
        {total === 0 ? "Không có kết quả" : `Hiển thị ${from}–${to} trên ${total}`}
      </span>
      <div className="adm-pager__pages">
        <button type="button" className="btn btn--outline btn--sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Trước
        </button>
        {nums.map((n) => (
          <button
            key={n}
            type="button"
            className={`btn btn--sm ${n === page ? "btn--primary" : "btn--outline"}`}
            aria-current={n === page ? "page" : undefined}
            onClick={() => onPage(n)}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          className="btn btn--outline btn--sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Sau
        </button>
      </div>
    </nav>
  );
}

export type Tone = "ok" | "warn" | "bad" | "neutral" | "info";

const TONE_ICON: Record<Tone, IconName> = {
  ok: "check",
  warn: "clock",
  bad: "close",
  neutral: "replay",
  info: "eye",
};

/** Status shown as icon + word, never colour alone. */
export function StatusBadge({ tone, children, icon }: { tone: Tone; children: ReactNode; icon?: IconName }) {
  return (
    <span className={`adm-status adm-status--${tone}`}>
      <Icon name={icon ?? TONE_ICON[tone]} size={13} strokeWidth={2.6} />
      {children}
    </span>
  );
}
