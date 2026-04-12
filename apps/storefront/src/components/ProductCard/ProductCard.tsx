<<<<<<< HEAD
import { Link } from "react-router-dom";
import type { CategoryProduct } from "@rimon/shared-types";
import { formatIls } from "../../lib/formatIls";
import { PRODUCT_IMAGE_FALLBACK } from "../../lib/productImageFallback";
import styles from "./ProductCard.module.css";

interface ProductCardProps {
  product: CategoryProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const src =
    product.imageUrl?.trim() ? product.imageUrl.trim() : PRODUCT_IMAGE_FALLBACK;

  return (
    <Link
      to={`/product/${product.id}`}
      className={styles.card}
      aria-label={product.name}
    >
      <div className={styles.imageWrap}>
        <img src={src} alt="" className={styles.image} loading="lazy" />
      </div>
      <div className={styles.footer}>
        <h3 className={styles.title}>{product.name}</h3>
        <p className={styles.price}>{formatIls(product.price)}</p>
      </div>
    </Link>
=======
import type { MouseEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import type { ProductVariant, ProductWithVariants } from "@rimon/shared-types";
import { useAuth } from "../../auth/AuthContext";
import { useCart } from "../../cart/CartContext";
import { formatPriceIls } from "../../lib/formatPrice";
import { pickDisplayVariant } from "../../lib/productDisplay";
import styles from "./ProductCard.module.css";

const FALLBACK_IMAGE =
  "https://placehold.co/600x800/FAF8F2/2C1A0E?text=%3F";

interface ProductCardProps {
  product: ProductWithVariants;
}

function StockBadge({ variant }: { variant: ProductVariant }) {
  const inStock = variant.stockQuantity > 0;
  return (
    <span
      className={`${styles.badge} ${inStock ? styles.badgeInStock : styles.badgeOut}`}
      aria-label={inStock ? "זמין במלאי" : "אזל מהמלאי"}
    >
      {inStock ? "זמין במלאי" : "אזל מהמלאי"}
    </span>
  );
}

export function ProductCard({ product }: ProductCardProps) {
  const { accessToken } = useAuth();
  const { addToCart } = useCart();
  const displayVariant = pickDisplayVariant(product.variants);
  const priceLabel =
    product.minPrice != null
      ? formatPriceIls(product.minPrice)
      : displayVariant
        ? formatPriceIls(displayVariant.price)
        : "—";

  const src =
    displayVariant?.imageUrl?.trim() ||
    product.variants.find((v) => v.imageUrl?.trim())?.imageUrl?.trim() ||
    FALLBACK_IMAGE;

  async function handleAdd(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!displayVariant) return;
    if (displayVariant.stockQuantity <= 0) return;
    const meta =
      accessToken == null
        ? {
            productId: product.id,
            productName: product.name,
            productSlug: product.slug,
            variantName: displayVariant.variantName,
            price: displayVariant.price,
            imageUrl: displayVariant.imageUrl,
          }
        : undefined;
    const result = await addToCart(displayVariant.id, 1, meta);
    if (result.ok) {
      toast.success("הפריט נוסף לעגלה");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <article className={styles.card}>
      <div className={styles.imageBlock}>
        {displayVariant ? <StockBadge variant={displayVariant} /> : null}
        <Link
          to={`/product/${product.id}`}
          className={styles.imageLink}
          aria-label={`${product.name} — ${priceLabel}`}
        >
          <img src={src} alt="" className={styles.image} loading="lazy" />
        </Link>
      </div>
      <div className={styles.footer}>
        <Link to={`/product/${product.id}`} className={styles.titleLink}>
          <h3 className={styles.name}>{product.name}</h3>
        </Link>
        <div className={styles.row}>
          <span className={styles.price}>{priceLabel}</span>
          <button
            type="button"
            className={styles.addBtn}
            disabled={!displayVariant || displayVariant.stockQuantity <= 0}
            onClick={handleAdd}
          >
            הוספה לעגלה
          </button>
        </div>
      </div>
    </article>
>>>>>>> Cart
  );
}
