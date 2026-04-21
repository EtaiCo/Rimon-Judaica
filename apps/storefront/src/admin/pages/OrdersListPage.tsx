import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AdminOrderListResponse, OrderStatus } from "@rimon/shared-types";
import { PageHeader } from "../components/PageHeader";
import { DataTable } from "../components/DataTable";
import { LoadingState, ErrorState } from "../components/ErrorState";
import { Badge } from "../components/Badge";
import { useAdminFetch } from "../hooks/useAdminFetch";
import {
  formatCurrency,
  formatDateTime,
  orderStatusLabel,
  orderStatusVariant,
} from "../lib/format";
import styles from "./common.module.css";

const STATUS_OPTIONS: Array<"" | OrderStatus> = [
  "",
  "pending",
  "paid",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

export function OrdersListPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | OrderStatus>("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const navigate = useNavigate();

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    return `/api/admin/orders?${params.toString()}`;
  }, [q, status, page]);

  const { data, loading, error } = useAdminFetch<AdminOrderListResponse>(path);

  return (
    <>
      <PageHeader
        title="ניהול הזמנות"
        description="מעקב, סינון וטיפול בהזמנות."
      />

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="חיפוש לפי מספר חשבונית…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={styles.select}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "" | OrderStatus);
            setPage(1);
          }}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === "" ? "כל הסטטוסים" : orderStatusLabel(s)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <DataTable
          rows={data?.orders ?? []}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/admin/orders/${r.id}`)}
          pagination={{
            page,
            pageSize,
            total: data?.total ?? 0,
            onPageChange: setPage,
          }}
          columns={[
            {
              key: "invoice",
              header: "חשבונית",
              render: (r) => <strong>{r.invoiceNumber}</strong>,
            },
            {
              key: "created",
              header: "תאריך",
              render: (r) => formatDateTime(r.createdAt),
            },
            {
              key: "customer",
              header: "לקוח",
              render: (r) => (
                <>
                  <div>{r.customerName || "—"}</div>
                  <small style={{ color: "var(--color-text-secondary)" }}>
                    {r.customerEmail}
                  </small>
                </>
              ),
            },
            {
              key: "status",
              header: "סטטוס",
              render: (r) => (
                <Badge variant={orderStatusVariant(r.status)}>
                  {orderStatusLabel(r.status)}
                </Badge>
              ),
            },
            {
              key: "total",
              header: "סה״כ",
              render: (r) => <strong>{formatCurrency(r.totalAmount)}</strong>,
            },
            {
              key: "tracking",
              header: "מעקב",
              render: (r) => r.trackingNumber ?? "—",
            },
          ]}
        />
      )}
    </>
  );
}
