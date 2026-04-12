import { useEffect } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { useCart } from "../../cart/CartContext";
import { CartLineRow } from "../CartLineRow/CartLineRow";
import type { CartLine } from "@rimon/shared-types";
import type { GuestCartLine } from "../../cart/guestCartStorage";
import styles from "./CartDrawer.module.css";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

function guestToDisplay(g: GuestCartLine) {
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

function serverToDisplay(l: CartLine) {
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

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const {
    isGuest,
    guestItems,
    serverItems,
    loading,
    lineActionId,
    refreshCart,
    incrementLine,
    decrementLine,
    removeLine,
  } = useCart();

  useEffect(() => {
    if (!open) return;
    void refreshCart();
  }, [open, refreshCart]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const linesEmpty = isGuest
    ? guestItems.length === 0
    : serverItems.length === 0;

  return (
    <>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="סגירת העגלה"
        onClick={onClose}
      />
      <aside
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
      >
        <div className={styles.head}>
          <h2 id="cart-drawer-title" className={styles.title}>
            עגלת קניות
          </h2>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="סגור"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        {isGuest ? (
          <p className={styles.noticeGuest}>
            שים לב: המלאי אינו שמור עד להתחברות/רכישה
          </p>
        ) : (
          <p className={styles.notice}>
            הפריט שמור עבורך ל־72 שעות. לאחר מכן המלאי ישוחרר אוטומטית.
          </p>
        )}
        <Link
          to="/cart"
          className={styles.fullCartLink}
          onClick={onClose}
        >
          לעגלה המלאה
        </Link>
        <div className={styles.list}>
          {loading && linesEmpty ? (
            <p className={styles.empty}>טוען…</p>
          ) : linesEmpty ? (
            <p className={styles.empty}>העגלה ריקה.</p>
          ) : isGuest ? (
            guestItems.map((line) => (
              <CartLineRow
                key={line.id}
                line={guestToDisplay(line)}
                compact
                showExpiry={false}
                busy={lineActionId === line.id}
                onIncrement={() => void incrementLine(line.id)}
                onDecrement={() => void decrementLine(line.id)}
                onRemove={() => void removeLine(line.id)}
              />
            ))
          ) : (
            serverItems.map((line) => (
              <CartLineRow
                key={line.id}
                line={serverToDisplay(line)}
                compact
                shelfStock={line.stockQuantity}
                expiresAt={line.expiresAt}
                showExpiry
                busy={lineActionId === line.id}
                onIncrement={() => void incrementLine(line.id)}
                onDecrement={() => void decrementLine(line.id)}
                onRemove={() => void removeLine(line.id)}
              />
            ))
          )}
        </div>
      </aside>
    </>
  );
}
