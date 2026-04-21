import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  BestSellerEntry,
  CustomerInsights,
  LowStockAlert,
  SalesOverview,
} from "@rimon/shared-types";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { DataTable } from "../components/DataTable";
import { LoadingState, ErrorState } from "../components/ErrorState";
import { Badge } from "../components/Badge";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { formatCurrency, orderStatusLabel } from "../lib/format";
import styles from "./DashboardPage.module.css";

type Range = "7d" | "30d" | "90d";
const RANGES: Range[] = ["7d", "30d", "90d"];
const RANGE_LABELS: Record<Range, string> = {
  "7d": "7 ימים",
  "30d": "30 יום",
  "90d": "90 יום",
};

export function DashboardPage() {
  const [range, setRange] = useState<Range>("30d");

  const sales = useAdminFetch<SalesOverview>(
    `/api/admin/analytics/overview?range=${range}`,
  );
  const customers = useAdminFetch<CustomerInsights>(
    `/api/admin/analytics/customers`,
  );
  const bestsellers = useAdminFetch<BestSellerEntry[]>(
    `/api/admin/analytics/bestsellers?limit=5`,
  );
  const lowStock = useAdminFetch<LowStockAlert[]>(
    `/api/admin/analytics/low-stock`,
  );

  return (
    <>
      <PageHeader
        title="סקירה כללית"
        description="נתוני ביצועים בזמן אמת עבור החנות."
        actions={
          <div className={styles.rangeBtns} role="radiogroup">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`${styles.rangeBtn} ${r === range ? styles.rangeBtnActive : ""}`}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>
        }
      />

      {sales.loading ? (
        <LoadingState />
      ) : sales.error ? (
        <ErrorState message={sales.error} />
      ) : sales.data ? (
        <>
          <div className={styles.grid}>
            <StatCard
              label="סך הכנסות"
              value={formatCurrency(sales.data.totalRevenue)}
              hint={`בטווח ${RANGE_LABELS[range]}`}
            />
            <StatCard
              label="הזמנות"
              value={sales.data.totalOrders.toLocaleString("he-IL")}
            />
            <StatCard
              label="ממוצע הזמנה"
              value={formatCurrency(sales.data.averageOrderValue)}
            />
            <StatCard
              label="לקוחות חדשים"
              value={sales.data.newCustomers.toLocaleString("he-IL")}
            />
            <StatCard
              label="סה״כ לקוחות"
              value={
                customers.data?.totalCustomers?.toLocaleString("he-IL") ?? "—"
              }
            />
            <StatCard
              label="לקוחות פעילים (7י׳)"
              value={
                customers.data?.activeLast7d?.toLocaleString("he-IL") ?? "—"
              }
            />
          </div>

          <div className={styles.chartCard}>
            <h3>הכנסות יומיות</h3>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={sales.data.daily}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip
                  formatter={(v) => formatCurrency(Number(v))}
                  labelFormatter={(l) => String(l)}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-primary)"
                  fill="url(#revFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className={styles.twoCol}>
            <div className={styles.chartCard}>
              <h3>התפלגות סטטוס הזמנות</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={sales.data.ordersByStatus.map((s) => ({
                    ...s,
                    label: orderStatusLabel(s.status),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className={styles.chartCard}>
              <h3>המוצרים הנמכרים ביותר</h3>
              {bestsellers.loading ? (
                <LoadingState />
              ) : bestsellers.error ? (
                <ErrorState message={bestsellers.error} />
              ) : (
                <DataTable
                  rows={bestsellers.data ?? []}
                  rowKey={(r) => r.productId}
                  emptyLabel="אין נתוני מכירות."
                  columns={[
                    { key: "name", header: "מוצר", render: (r) => r.productName },
                    {
                      key: "units",
                      header: "יחידות",
                      render: (r) => r.unitsSold.toLocaleString("he-IL"),
                    },
                    {
                      key: "rev",
                      header: "הכנסה",
                      render: (r) => formatCurrency(r.revenue),
                    },
                  ]}
                />
              )}
            </div>
          </div>

          <div className={styles.chartCard}>
            <h3>התראות מלאי נמוך</h3>
            {lowStock.loading ? (
              <LoadingState />
            ) : lowStock.error ? (
              <ErrorState message={lowStock.error} />
            ) : (
              <DataTable
                rows={lowStock.data ?? []}
                rowKey={(r) => r.variantId}
                emptyLabel="אין התראות מלאי."
                columns={[
                  { key: "product", header: "מוצר", render: (r) => r.productName },
                  { key: "variant", header: "וריאנט", render: (r) => r.variantName },
                  { key: "sku", header: "מק״ט", render: (r) => r.sku },
                  {
                    key: "stock",
                    header: "מלאי",
                    render: (r) => (
                      <Badge variant={r.stockQuantity === 0 ? "danger" : "warn"}>
                        {r.stockQuantity} / סף {r.lowStockThreshold}
                      </Badge>
                    ),
                  },
                ]}
              />
            )}
          </div>
        </>
      ) : null}
    </>
  );
}
