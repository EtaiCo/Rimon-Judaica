import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { toast } from "sonner";
import type { OrderSummary, WishlistLine } from "@rimon/shared-types";
import { Layout } from "../components/Layout/Layout";
import { useAuth } from "../auth/AuthContext";
import { useWishlist } from "../wishlist/WishlistContext";
import { apiFetch } from "../lib/api";
import { formatPriceIls } from "../lib/formatPrice";
import styles from "./AccountPage.module.css";

const FALLBACK_IMAGE =
  "https://placehold.co/600x800/FFFFFF/5C2330?text=%3F";

type TabId = "wishlist" | "orders";

function formatOrderDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("he-IL", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function AccountPage() {
  const { customer, accessToken, isReady } = useAuth();
  const { lines: wishlistLines, loading: wishLoading, removeByLineId } =
    useWishlist();
  const [tab, setTab] = useState<TabId>("wishlist");
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!accessToken) return;
    setOrdersLoading(true);
    try {
      const res = await apiFetch("/api/orders", { accessToken });
      if (!res.ok) {
        setOrders([]);
        return;
      }
      const data = (await res.json()) as unknown;
      setOrders(Array.isArray(data) ? (data as OrderSummary[]) : []);
    } finally {
      setOrdersLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!isReady || !accessToken || tab !== "orders") return;
    void loadOrders();
  }, [isReady, accessToken, tab, loadOrders]);

  async function handleRemoveWish(lineId: string) {
    const r = await removeByLineId(lineId);
    if (!r.ok) toast.error(r.error);
  }

  if (!isReady) {
    return (
      <Layout>
        <div className={styles.wrap}>
          <h1 className={styles.title}>האזור האישי</h1>
          <div className={styles.tabs} role="tablist" aria-label="תפריט אזור אישי">
            <span className={styles.tabActive}>הרשימה שלי</span>
            <span className={styles.tab}>היסטוריית הזמנות</span>
          </div>
          <div className={styles.card}>
            <p className={styles.loading}>טוען…</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!customer || !accessToken) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout>
      <div className={styles.wrap}>
        <h1 className={styles.title}>האזור האישי</h1>

        <div className={styles.tabs} role="tablist" aria-label="תפריט אזור אישי">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "wishlist"}
            className={tab === "wishlist" ? styles.tabActive : styles.tab}
            onClick={() => setTab("wishlist")}
          >
            הרשימה שלי
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "orders"}
            className={tab === "orders" ? styles.tabActive : styles.tab}
            onClick={() => setTab("orders")}
          >
            היסטוריית הזמנות
          </button>
        </div>

        {tab === "wishlist" ? (
          <div className={styles.card} role="tabpanel">
            {wishLoading ? (
              <p className={styles.loading}>טוען…</p>
            ) : wishlistLines.length === 0 ? (
              <p className={styles.empty}>אין פריטים ברשימה שלך.</p>
            ) : (
              <div className={styles.wishGrid}>
                {wishlistLines.map((line) => (
                  <WishlistCard
                    key={line.id}
                    line={line}
                    onRemove={() => void handleRemoveWish(line.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className={styles.card} role="tabpanel">
            {ordersLoading ? (
              <p className={styles.loading}>טוען…</p>
            ) : orders.length === 0 ? (
              <p className={styles.empty}>אין הזמנות להצגה.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>חשבונית #</th>
                      <th>תאריך</th>
                      <th>סטטוס</th>
                      <th>סה״כ</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td className={styles.mono}>{o.invoiceNumber}</td>
                        <td className={styles.mono}>
                          {formatOrderDate(o.createdAt)}
                        </td>
                        <td>{o.status}</td>
                        <td className={styles.mono}>
                          {formatPriceIls(o.totalAmount)}
                        </td>
                        <td>
                          <Link
                            className={styles.link}
                            to={`/account/orders/${o.id}`}
                          >
                            פרטים
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function WishlistCard({
  line,
  onRemove,
}: {
  line: WishlistLine;
  onRemove: () => void;
}) {
  const src = line.imageUrl?.trim() || FALLBACK_IMAGE;
  return (
    <article className={styles.wishCard}>
      <Link to={`/product/${line.productId}`}>
        <img
          src={src}
          alt=""
          className={styles.wishImg}
          loading="lazy"
          decoding="async"
        />
      </Link>
      <div className={styles.wishBody}>
        <Link
          to={`/product/${line.productId}`}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <h3 className={styles.wishName}>{line.productName}</h3>
        </Link>
        <div className={styles.wishMeta}>{line.variantName}</div>
        <div className={styles.wishRow}>
          <span className={styles.price}>{formatPriceIls(line.price)}</span>
          <button type="button" className={styles.removeBtn} onClick={onRemove}>
            הסרה
          </button>
        </div>
      </div>
    </article>
  );
}
