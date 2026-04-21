import type { ReactNode } from "react";
import styles from "./DataTable.module.css";

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  width?: string | number;
};

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  emptyLabel = "אין נתונים להצגה.",
  onRowClick,
  pagination,
}: {
  rows: T[];
  columns: Array<DataTableColumn<T>>;
  rowKey: (row: T) => string;
  emptyLabel?: string;
  onRowClick?: (row: T) => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
}) {
  const totalPages =
    pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1;

  return (
    <div className={styles.wrap}>
      {rows.length === 0 ? (
        <div className={styles.empty}>{emptyLabel}</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={col.width ? { width: col.width } : undefined}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={onRowClick ? styles.rowClickable : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key}>{col.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {pagination ? (
        <div className={styles.pagination}>
          <div>
            סה״כ {pagination.total} · עמוד {pagination.page} מתוך {totalPages}
          </div>
          <div style={{ display: "flex", gap: "var(--space-sm)" }}>
            <button
              type="button"
              className={styles.paginationBtn}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              הקודם
            </button>
            <button
              type="button"
              className={styles.paginationBtn}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= totalPages}
            >
              הבא
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
