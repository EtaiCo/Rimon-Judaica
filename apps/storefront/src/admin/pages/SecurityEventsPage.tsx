import { useMemo, useState } from "react";
import type { SecurityEvent } from "@rimon/shared-types";
import { PageHeader } from "../components/PageHeader";
import { DataTable } from "../components/DataTable";
import { LoadingState, ErrorState } from "../components/ErrorState";
import { Badge } from "../components/Badge";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { formatDateTime } from "../lib/format";
import styles from "./common.module.css";

type ListResponse = {
  events: SecurityEvent[];
  total: number;
  page: number;
  pageSize: number;
};

type Severity = SecurityEvent["severity"];

const SEVERITY_VARIANT: Record<Severity, "info" | "warn" | "danger"> = {
  info: "info",
  warn: "warn",
  error: "danger",
  critical: "danger",
};

export function SecurityEventsPage() {
  const [severity, setSeverity] = useState<"" | Severity>("");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (severity) params.set("severity", severity);
    if (kind.trim()) params.set("kind", kind.trim());
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    return `/api/admin/security-events?${params.toString()}`;
  }, [severity, kind, page]);

  const { data, loading, error } = useAdminFetch<ListResponse>(path);

  return (
    <>
      <PageHeader
        title="אירועי אבטחה"
        description="כשלי אימות, חריגות קצב, ופעולות רגישות שסורבו."
      />

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="סנן לפי סוג (למשל: rate_limit_exceeded)"
          value={kind}
          dir="ltr"
          onChange={(e) => {
            setKind(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={styles.select}
          value={severity}
          onChange={(e) => {
            setSeverity(e.target.value as "" | Severity);
            setPage(1);
          }}
        >
          <option value="">כל החומרות</option>
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
          <option value="critical">critical</option>
        </select>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <DataTable
          rows={data?.events ?? []}
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
              key: "severity",
              header: "חומרה",
              render: (r) => (
                <Badge variant={SEVERITY_VARIANT[r.severity]}>
                  {r.severity}
                </Badge>
              ),
            },
            {
              key: "kind",
              header: "סוג",
              render: (r) => <code>{r.kind}</code>,
            },
            {
              key: "customer",
              header: "משתמש",
              render: (r) => (
                <span dir="ltr">
                  {r.customerId ? r.customerId.slice(0, 8) : "—"}
                </span>
              ),
            },
            {
              key: "ip",
              header: "IP",
              render: (r) => <span dir="ltr">{r.ip ?? "—"}</span>,
            },
            {
              key: "meta",
              header: "פרטים",
              render: (r) =>
                r.meta ? (
                  <details>
                    <summary style={{ cursor: "pointer" }}>הצג</summary>
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
                      {JSON.stringify(r.meta, null, 2)}
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
