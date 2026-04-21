import { useMemo, useState } from "react";
import type { AdminActivityEntry } from "@rimon/shared-types";
import { PageHeader } from "../components/PageHeader";
import { DataTable } from "../components/DataTable";
import { LoadingState, ErrorState } from "../components/ErrorState";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { formatDateTime } from "../lib/format";
import styles from "./common.module.css";

type ListResponse = {
  entries: AdminActivityEntry[];
  total: number;
  page: number;
  pageSize: number;
};

export function ActivityLogPage() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (action.trim()) params.set("action", action.trim());
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    return `/api/admin/activity-log?${params.toString()}`;
  }, [action, page]);

  const { data, loading, error } = useAdminFetch<ListResponse>(path);

  return (
    <>
      <PageHeader
        title="יומן פעולות"
        description="כל הפעולות שמבוצעות על-ידי מנהלים. אי-אפשר לערוך או למחוק ערכים."
      />

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="סנן לפי פעולה (למשל: order.refund)"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          dir="ltr"
        />
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <DataTable
          rows={data?.entries ?? []}
          rowKey={(r) => r.id}
          pagination={{
            page,
            pageSize,
            total: data?.total ?? 0,
            onPageChange: setPage,
          }}
          columns={[
            {
              key: "time",
              header: "זמן",
              render: (r) => formatDateTime(r.createdAt),
            },
            {
              key: "admin",
              header: "מנהל",
              render: (r) => (
                <div>
                  <div dir="ltr">{r.adminEmail ?? r.adminId}</div>
                </div>
              ),
            },
            {
              key: "action",
              header: "פעולה",
              render: (r) => <code>{r.action}</code>,
            },
            {
              key: "target",
              header: "יעד",
              render: (r) =>
                r.targetType ? (
                  <span className={styles.tag}>
                    {r.targetType} · {r.targetId?.slice(0, 8) ?? ""}
                  </span>
                ) : (
                  "—"
                ),
            },
            {
              key: "ip",
              header: "IP",
              render: (r) => <span dir="ltr">{r.ip ?? "—"}</span>,
            },
            {
              key: "diff",
              header: "שינויים",
              render: (r) =>
                r.diff ? (
                  <details>
                    <summary style={{ cursor: "pointer" }}>
                      {Object.keys(r.diff).length} שדות
                    </summary>
                    <pre
                      style={{
                        fontSize: 11,
                        background: "var(--color-gray-100)",
                        padding: 8,
                        maxWidth: 400,
                        overflow: "auto",
                      }}
                      dir="ltr"
                    >
                      {JSON.stringify(r.diff, null, 2)}
                    </pre>
                  </details>
                ) : (
                  "—"
                ),
            },
          ]}
        />
      )}
    </>
  );
}
