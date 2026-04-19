import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useCart } from "../../cart/CartContext";
import { CartLineRow } from "../CartLineRow/CartLineRow";
import type { CartLine } from "@rimon/shared-types";
import type { GuestCartLine } from "../../cart/guestCartStorage";
import styles from "./CartDrawer.module.css";

type CartDrawerProps = {
  open: boolean;
  onClose: () => void;
  highlightedVariantId?: string | null;
  onInteract?: () => void;
};

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

const PANEL_TWEEN = { type: "tween" as const, ease: "easeInOut" as const, duration: 0.4 };
const BACKDROP_TWEEN = { type: "tween" as const, ease: "easeInOut" as const, duration: 0.25 };

export function CartDrawer({
  open,
  onClose,
  highlightedVariantId,
  onInteract,
}: CartDrawerProps) {
  const navigate = useNavigate();
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
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

  const linesEmpty = isGuest
    ? guestItems.length === 0
    : serverItems.length === 0;

  const handleCheckout = useCallback(() => {
    setPendingRoute("/cart");
    onClose();
  }, [onClose]);

  const guestLineNodes = useMemo(
    () =>
      guestItems.map((line) => (
        <div
          key={line.id}
          className={`${styles.lineWrap} ${highlightedVariantId === line.variantId ? styles.lineHighlight : ""}`}
        >
          <CartLineRow
            line={guestToDisplay(line)}
            compact
            showExpiry={false}
            busy={lineActionId === line.id}
            onIncrement={() => void incrementLine(line.id)}
            onDecrement={() => void decrementLine(line.id)}
            onRemove={() => void removeLine(line.id)}
          />
        </div>
      )),
    [decrementLine, guestItems, highlightedVariantId, incrementLine, lineActionId, removeLine],
  );

  const serverLineNodes = useMemo(
    () =>
      serverItems.map((line) => (
        <div
          key={line.id}
          className={`${styles.lineWrap} ${highlightedVariantId === line.variantId ? styles.lineHighlight : ""}`}
        >
          <CartLineRow
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
        </div>
      )),
    [decrementLine, highlightedVariantId, incrementLine, lineActionId, removeLine, serverItems],
  );

  return (
    <AnimatePresence
      onExitComplete={() => {
        if (pendingRoute) {
          navigate(pendingRoute);
          setPendingRoute(null);
        }
      }}
    >
      {open ? (
        <>
          <motion.button
            type="button"
            className={styles.backdrop}
            aria-label="סגירת העגלה"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={BACKDROP_TWEEN}
          />
          <motion.aside
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-drawer-title"
            onMouseEnter={onInteract}
            onFocusCapture={onInteract}
            onClickCapture={onInteract}
            initial={{ x: "100%", opacity: 0.98 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.98 }}
            transition={PANEL_TWEEN}
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
            <div className={styles.list}>
              {loading && linesEmpty ? (
                <p className={styles.empty}>טוען…</p>
              ) : linesEmpty ? (
                <p className={styles.empty}>העגלה ריקה.</p>
              ) : isGuest ? (
                guestLineNodes
              ) : (
                serverLineNodes
              )}
            </div>
            <div className={styles.footer}>
              <button
                type="button"
                className={styles.checkoutBtn}
                onClick={handleCheckout}
              >
                מעבר לתשלום
              </button>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
