import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import styles from "./CartLineRow.module.css";

const FALLBACK_IMAGE =
  "https://placehold.co/120x160/FAF8F2/2C1A0E?text=%3F";

export interface CartLineRowDisplay {
  id: string;
  productId: string;
  productName: string;
  variantName: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

interface CartLineRowProps {
  line: CartLineRowDisplay;
  shelfStock?: number;
  expiresAt?: string;
  showExpiry?: boolean;
  compact?: boolean;
  busy?: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}

function formatExpiryHe(iso: string): string {
  try {
    return new Date(iso).toLocaleString("he-IL", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function CartLineRow({
  line,
  shelfStock,
  expiresAt,
  showExpiry,
  compact,
  busy,
  onIncrement,
  onDecrement,
  onRemove,
}: CartLineRowProps) {
  const src = line.imageUrl?.trim() || FALLBACK_IMAGE;
  const lineTotal = line.price * line.quantity;
  const canPlus = shelfStock === undefined ? true : shelfStock > 0;

  const qtyControls = (
    <div className={styles.qtyRow}>
      <button
        type="button"
        className={styles.qtyBtn}
        aria-label="הפחתת כמות"
        disabled={busy}
        onClick={onDecrement}
      >
        <Minus size={16} aria-hidden />
      </button>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={line.quantity}
          className={styles.qtyValue}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.18 }}
        >
          {line.quantity}
        </motion.span>
      </AnimatePresence>
      <button
        type="button"
        className={styles.qtyBtn}
        aria-label="הוספת כמות"
        disabled={busy || !canPlus}
        onClick={onIncrement}
      >
        <Plus size={16} aria-hidden />
      </button>
    </div>
  );

  const removeControl = (
    <button
      type="button"
      className={styles.removeBtn}
      aria-label="הסרת פריט"
      disabled={busy}
      onClick={onRemove}
    >
      <Trash2 size={16} aria-hidden />
      הסר
    </button>
  );

  return (
    <div
      className={`${styles.row} ${compact ? styles.rowCompact : ""}`}
      data-line-id={line.id}
    >
      <div
        className={`${styles.thumbWrap} ${compact ? styles.thumbWrapCompact : ""}`}
      >
        <img src={src} alt="" className={styles.thumb} />
      </div>
      <div className={styles.main}>
        <div className={styles.topRow}>
          <div className={styles.body}>
            <h3 className={styles.name}>
              <Link
                to={`/product/${line.productId}`}
                className={styles.nameLink}
              >
                {line.productName}
              </Link>
            </h3>
            <p className={styles.meta}>{line.variantName}</p>
            {showExpiry && expiresAt ? (
              <p className={styles.expiry}>
                שמירה עד {formatExpiryHe(expiresAt)}
              </p>
            ) : null}
          </div>
          {!compact ? (
            <div className={styles.priceBlock}>
              <p className={styles.unitPrice}>
                מחיר יחידה: ₪{line.price.toFixed(2)}
              </p>
              <p className={styles.lineTotal}>₪{lineTotal.toFixed(2)}</p>
            </div>
          ) : (
            <p className={styles.lineTotalCompact}>₪{lineTotal.toFixed(2)}</p>
          )}
        </div>
        <div className={styles.bottomRow}>
          {qtyControls}
          {removeControl}
        </div>
      </div>
    </div>
  );
}
