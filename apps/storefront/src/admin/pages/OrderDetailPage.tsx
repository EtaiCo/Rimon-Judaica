import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { OrderStatus } from "@rimon/shared-types";
import { PageHeader } from "../components/PageHeader";
import { LoadingState, ErrorState } from "../components/ErrorState";
import { Badge } from "../components/Badge";
import { DataTable } from "../components/DataTable";
import { SudoPasswordDialog } from "../components/SudoPasswordDialog";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { adminApi, AdminApiError } from "../api/client";
import {
  formatCurrency,
  formatDateTime,
  orderStatusLabel,
  orderStatusVariant,
} from "../lib/format";
import styles from "./common.module.css";

type OrderDetailResponse = {
  order: {
    id: string;
    invoice_number: string;
    user_id: string;
    status: OrderStatus;
    total_amount: number | string;
    shipping_method: string;
    tracking_number: string | null;
    notes: string | null;
    created_at: string;
    shipped_at: string | null;
    delivered_at: string | null;
    refunded_at: string | null;
    refund_amount: number | null;
    customers: {
      id: string;
      email: string;
      full_name: string;
      phone: string;
    };
  };
  items: Array<{
    id: string;
    variant_id: string;
    quantity: number;
    price_at_purchase: number | string;
    product_variants: {
      variant_name: string;
      sku: string;
      image_url: string | null;
      products: {
        id: string;
        name: string;
        slug: string;
      };
    };
  }>;
};

const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["paid", "cancelled"],
  paid: ["preparing", "cancelled"],
  preparing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
  refunded: [],
};

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAdminAuth();
  const detail = useAdminFetch<OrderDetailResponse>(
    id ? `/api/admin/orders/${id}` : null,
  );

  const [tracking, setTracking] = useState("");
  const [notes, setNotes] = useState("");
  const [savingShip, setSavingShip] = useState(false);
  const [shipError, setShipError] = useState<string | null>(null);

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundError, setRefundError] = useState<string | null>(null);

  useEffect(() => {
    if (detail.data?.order) {
      setTracking(detail.data.order.tracking_number ?? "");
      setNotes(detail.data.order.notes ?? "");
    }
  }, [detail.data?.order]);

  if (detail.loading || !id) return <LoadingState />;
  if (detail.error) return <ErrorState message={detail.error} />;
  if (!detail.data) return <ErrorState message="ההזמנה לא נמצאה." />;

  const { order, items } = detail.data;

  async function changeStatus(next: OrderStatus) {
    try {
      await adminApi.patch(accessToken, `/api/admin/orders/${id}/status`, {
        status: next,
      });
      detail.refresh();
    } catch (e) {
      alert(
        e instanceof AdminApiError ? e.message : "שגיאה בעדכון סטטוס.",
      );
    }
  }

  async function saveShipping() {
    setSavingShip(true);
    setShipError(null);
    try {
      await adminApi.patch(accessToken, `/api/admin/orders/${id}/shipping`, {
        trackingNumber: tracking.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      detail.refresh();
    } catch (e) {
      setShipError(
        e instanceof AdminApiError ? e.message : "שגיאה בשמירת פרטי המשלוח.",
      );
    } finally {
      setSavingShip(false);
    }
  }

  async function submitRefund(sudoPassword: string) {
    if (refundAmount <= 0) {
      throw new Error("סכום חייב להיות חיובי.");
    }
    try {
      await adminApi.post(
        accessToken,
        `/api/admin/orders/${id}/refund`,
        { amount: refundAmount },
        { sudoPassword },
      );
      detail.refresh();
      setRefundAmount(0);
      setRefundError(null);
    } catch (e) {
      const msg =
        e instanceof AdminApiError ? e.message : "שגיאה בהחזר.";
      setRefundError(msg);
      throw new Error(msg);
    }
  }

  return (
    <>
      <PageHeader
        title={`הזמנה ${order.invoice_number}`}
        description={`נוצרה ${formatDateTime(order.created_at)}`}
        actions={
          <Link to="/admin/orders" className={styles.btn}>
            ← חזרה לרשימה
          </Link>
        }
      />

      <div className={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <dl className={styles.kvList}>
            <dt>סטטוס</dt>
            <dd>
              <Badge variant={orderStatusVariant(order.status)}>
                {orderStatusLabel(order.status)}
              </Badge>
            </dd>
            <dt>סה״כ</dt>
            <dd>
              <strong>{formatCurrency(order.total_amount)}</strong>
            </dd>
            <dt>שיטת משלוח</dt>
            <dd>{order.shipping_method}</dd>
            <dt>נשלח ב-</dt>
            <dd>{formatDateTime(order.shipped_at)}</dd>
            <dt>נמסר ב-</dt>
            <dd>{formatDateTime(order.delivered_at)}</dd>
            {order.refunded_at ? (
              <>
                <dt>הוחזר ב-</dt>
                <dd>
                  {formatDateTime(order.refunded_at)} (
                  {formatCurrency(order.refund_amount)})
                </dd>
              </>
            ) : null}
          </dl>
          <dl className={styles.kvList}>
            <dt>לקוח</dt>
            <dd>
              <Link
                to={`/admin/customers/${order.customers.id}`}
                className={styles.link}
              >
                {order.customers.full_name || order.customers.email}
              </Link>
            </dd>
            <dt>אימייל</dt>
            <dd dir="ltr">{order.customers.email}</dd>
            <dt>טלפון</dt>
            <dd dir="ltr">{order.customers.phone}</dd>
          </dl>
        </div>

        <div style={{ marginTop: 24, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {NEXT_STATUS[order.status].map((next) => (
            <button
              key={next}
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => changeStatus(next)}
            >
              העבר ל-{orderStatusLabel(next)}
            </button>
          ))}
          {order.status !== "refunded" &&
          order.status !== "cancelled" &&
          order.status !== "pending" ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={() => {
                setRefundAmount(Number(order.total_amount));
                setRefundOpen(true);
              }}
            >
              החזר כספי…
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>פריטים</h3>
        <DataTable
          rows={items}
          rowKey={(r) => r.id}
          columns={[
            {
              key: "image",
              header: "",
              width: 64,
              render: (r) =>
                r.product_variants.image_url ? (
                  <img
                    className={styles.imageThumb}
                    src={r.product_variants.image_url}
                    alt=""
                  />
                ) : null,
            },
            {
              key: "product",
              header: "מוצר",
              render: (r) => (
                <div>
                  <div>{r.product_variants.products.name}</div>
                  <small style={{ color: "var(--color-text-secondary)" }}>
                    {r.product_variants.variant_name} · {r.product_variants.sku}
                  </small>
                </div>
              ),
            },
            { key: "qty", header: "כמות", render: (r) => r.quantity },
            {
              key: "price",
              header: "מחיר יחידה",
              render: (r) => formatCurrency(r.price_at_purchase),
            },
            {
              key: "subtotal",
              header: "סה״כ",
              render: (r) =>
                formatCurrency(
                  Number(r.quantity) * Number(r.price_at_purchase),
                ),
            },
          ]}
        />
      </div>

      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>משלוח והערות</h3>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label>מספר מעקב</label>
            <input
              dir="ltr"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
            />
          </div>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label>הערות פנימיות</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        {shipError ? <div className={styles.fieldError}>{shipError}</div> : null}
        <div className={styles.actionsRow}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={saveShipping}
            disabled={savingShip}
          >
            {savingShip ? "שומר…" : "שמור פרטי משלוח"}
          </button>
        </div>
      </div>

      <SudoPasswordDialog
        open={refundOpen}
        onOpenChange={setRefundOpen}
        title="החזר כספי"
        description={
          <div>
            <div style={{ marginBottom: 12 }}>
              סכום להחזר (עד סכום ההזמנה: {formatCurrency(order.total_amount)}).
            </div>
            <div className={styles.field}>
              <label>סכום</label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={Number(order.total_amount)}
                value={refundAmount}
                onChange={(e) => setRefundAmount(Number(e.target.value))}
              />
            </div>
            {refundError ? (
              <div className={styles.fieldError}>{refundError}</div>
            ) : null}
          </div>
        }
        confirmLabel="בצע החזר"
        destructive
        onConfirm={submitRefund}
      />
    </>
  );
}
