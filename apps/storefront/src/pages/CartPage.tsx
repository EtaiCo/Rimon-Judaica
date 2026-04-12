import { useMemo } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import type { CartLine } from "@rimon/shared-types";
import { Layout } from "../components/Layout/Layout";
import {
  CartLineRow,
  type CartLineRowDisplay,
} from "../components/CartLineRow/CartLineRow";
import { useCart } from "../cart/CartContext";
import type { GuestCartLine } from "../cart/guestCartStorage";
import styles from "./CartPage.module.css";

function guestToDisplay(g: GuestCartLine): CartLineRowDisplay {
  return {
    id: g.id,
    productId: g.productId,
    productName: g.productName,
    variantName: g.variantName,
    price: g.price,
    quantity: g.quantity,
    imageUrl: g.imageUrl,
  };
}

function serverToDisplay(l: CartLine): CartLineRowDisplay {
  return {
    id: l.id,
    productId: l.productId,
    productName: l.productName,
    variantName: l.variantName,
    price: l.price,
    quantity: l.quantity,
    imageUrl: l.imageUrl,
  };
}

export function CartPage() {
  const {
    isGuest,
    guestItems,
    serverItems,
    loading,
    lineActionId,
    incrementLine,
    decrementLine,
    removeLine,
  } = useCart();

  const lines = useMemo(
    () =>
      isGuest
        ? guestItems.map(guestToDisplay)
        : serverItems.map(serverToDisplay),
    [isGuest, guestItems, serverItems],
  );

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + l.price * l.quantity, 0),
    [lines],
  );

  async function handleInc(id: string) {
    const r = await incrementLine(id);
    if (!r.ok && !isGuest) toast.error(r.error);
  }

  async function handleDec(id: string) {
    const r = await decrementLine(id, 1);
    if (!r.ok) toast.error(r.error);
  }

  async function handleRemove(id: string) {
    const r = await removeLine(id);
    if (!r.ok) toast.error(r.error);
  }

  return (
    <Layout>
      <div className={styles.wrap}>
        <h1 className={styles.title}>עגלת קניות</h1>

        {loading && lines.length === 0 ? (
          <p className={styles.emptyText}>טוען…</p>
        ) : lines.length === 0 ? (
          <div className={styles.empty}>
            <h2 className={styles.emptyTitle}>הסל שלך ריק</h2>
            <p className={styles.emptyText}>
              עדיין לא בחרת מוצרים. חזרו לחנות כדי להמשיך.
            </p>
            <Link to="/" className={styles.shopLink}>
              חזרה לחנות
            </Link>
          </div>
        ) : (
          <div className={styles.grid}>
            <section className={styles.linesCard} aria-label="פריטים בעגלה">
              {lines.map((line) => {
                const serverLine = !isGuest
                  ? serverItems.find((s) => s.id === line.id)
                  : undefined;
                return (
                  <CartLineRow
                    key={line.id}
                    line={line}
                    shelfStock={serverLine?.stockQuantity}
                    expiresAt={serverLine?.expiresAt}
                    showExpiry={!isGuest}
                    busy={lineActionId === line.id}
                    onIncrement={() => handleInc(line.id)}
                    onDecrement={() => handleDec(line.id)}
                    onRemove={() => handleRemove(line.id)}
                  />
                );
              })}
            </section>

            <aside className={styles.summary} aria-label="סיכום הזמנה">
              <h2 className={styles.summaryTitle}>סיכום</h2>
              <div className={styles.summaryRow}>
                <span>סכום ביניים</span>
                <span className={styles.value}>₪{subtotal.toFixed(2)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>משלוח</span>
                <span className={styles.value}>לפי מיקום</span>
              </div>
              <div className={styles.summaryRowStrong}>
                <span>סה&quot;כ</span>
                <span className={styles.value}>₪{subtotal.toFixed(2)}</span>
              </div>
              <button type="button" className={styles.checkoutBtn}>
                המשך לתשלום
              </button>
            </aside>
          </div>
        )}
      </div>
    </Layout>
  );
}
