import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import type {
  OrderDetail,
  OrderShippingAddress,
  OrderShippingMethod,
} from "@rimon/shared-types";
import { Layout } from "../components/Layout/Layout";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import { formatPriceIls } from "../lib/formatPrice";
import styles from "./OrderDetailPage.module.css";

const FALLBACK_IMAGE =
  "https://placehold.co/600x800/FAF8F2/2C1A0E?text=%3F";

function shortOrderRef(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function shippingMethodLabel(m: OrderShippingMethod): string {
  switch (m) {
    case "home_delivery":
      return "אספקה עד הבית";
    case "self_pickup":
      return "איסוף עצמי מהחנות";
    case "pickup_point":
      return "נקודת איסוף";
    default:
      return m;
  }
}

function AddressBlock({ addr }: { addr: OrderShippingAddress }) {
  const rows: { label: string; value?: string }[] = [
    { label: "רחוב", value: addr.street },
    { label: "עיר", value: addr.city },
    { label: "מס׳ בית", value: addr.houseNumber },
    { label: "דירה", value: addr.apartment },
    { label: "מיקוד", value: addr.zipCode },
    { label: "נקודת איסוף", value: addr.pickupPointName },
    { label: "הערות", value: addr.notes },
  ];
  const filled = rows.filter((r) => r.value);
  if (filled.length === 0) return null;
  return (
    <div className={styles.shipBlock}>
      {filled.map((r) => (
        <div key={r.label}>
          <span className={styles.shipLabel}>{r.label}:</span>
          {r.value}
        </div>
      ))}
    </div>
  );
}

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { customer, accessToken, isReady } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!isReady || !accessToken || !orderId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      const res = await apiFetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        accessToken,
      });
      if (cancelled) return;
      if (res.status === 404) {
        setOrder(null);
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setOrder(null);
        setNotFound(true);
        setLoading(false);
        return;
      }
      const data = (await res.json()) as OrderDetail;
      setOrder(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isReady, accessToken, orderId]);

  if (!isReady) {
    return (
      <Layout>
        <div className={styles.loading}>טוען…</div>
      </Layout>
    );
  }

  if (!customer || !accessToken) {
    return <Navigate to="/login" replace />;
  }

  if (!orderId) {
    return <Navigate to="/account" replace />;
  }

  return (
    <Layout>
      <div className={styles.wrap}>
        <Link className={styles.back} to="/account">
          חזרה להיסטוריית הזמנות
        </Link>

        {loading ? (
          <p className={styles.loading}>טוען…</p>
        ) : notFound || !order ? (
          <p className={styles.error}>ההזמנה לא נמצאה.</p>
        ) : (
          <>
            <h1 className={styles.header}>
              הזמנה מס׳ {shortOrderRef(order.id)} | חשבונית מס׳{" "}
              {order.invoiceNumber}
            </h1>

            <section className={styles.section} aria-labelledby="ship-heading">
              <h2 id="ship-heading" className={styles.sectionTitle}>
                פרטי משלוח
              </h2>
              <p className={styles.shipBlock}>
                <span className={styles.shipLabel}>שיטת משלוח:</span>
                {shippingMethodLabel(order.shippingMethod)}
              </p>
              {order.shippingMethod === "self_pickup" ? (
                <p className={styles.shipBlock}>
                  ניתן לאסוף את ההזמנה מהחנות בשעות הפעילות.
                </p>
              ) : order.shippingAddress ? (
                <AddressBlock addr={order.shippingAddress} />
              ) : null}
            </section>

            <section className={styles.section} aria-labelledby="items-heading">
              <h2 id="items-heading" className={styles.sectionTitle}>
                פריטים
              </h2>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>מוצר</th>
                    <th>כמות</th>
                    <th>מחיר</th>
                    <th>סה״כ שורה</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => {
                    const src = item.imageUrl?.trim() || FALLBACK_IMAGE;
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className={styles.rowFlex}>
                            <img
                              src={src}
                              alt=""
                              className={styles.thumb}
                              loading="lazy"
                            />
                            <div>
                              <Link
                                to={`/product/${item.productId}`}
                                style={{
                                  color: "var(--color-primary)",
                                  fontWeight: 600,
                                  textDecoration: "none",
                                }}
                              >
                                {item.productName}
                              </Link>
                              <div className={styles.meta}>
                                {item.variantName} · {item.sku}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>{item.quantity}</td>
                        <td>{formatPriceIls(item.priceAtPurchase)}</td>
                        <td>{formatPriceIls(item.lineTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className={styles.totalRow}>
                <span>סה״כ להזמנה</span>
                <span>{formatPriceIls(order.totalAmount)}</span>
              </div>
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}
