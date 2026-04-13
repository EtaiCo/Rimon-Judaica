import type { MouseEvent } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import type { ProductVariant, ProductWithVariants } from "@rimon/shared-types";

type ProductCardProduct = Pick<
  ProductWithVariants,
  "id" | "name" | "slug" | "variants" | "minPrice"
>;
import { useAuth } from "../../auth/AuthContext";
import { useCart } from "../../cart/CartContext";
import { useWishlist } from "../../wishlist/WishlistContext";
import { formatPriceIls } from "../../lib/formatPrice";
import { pickDisplayVariant } from "../../lib/productDisplay";
import styles from "./ProductCard.module.css";

const FALLBACK_IMAGE =
  "https://placehold.co/600x800/FAF8F2/2C1A0E?text=%3F";

interface ProductCardProps {
  product: ProductCardProduct;
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
  const { isWishlisted, toggleWishlist } = useWishlist();
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

  async function handleWishlist(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!displayVariant) return;
    if (!accessToken) {
      toast.error("התחברו כדי לשמור מוצרים לרשימה.");
      return;
    }
    const wasWishlisted = isWishlisted(displayVariant.id);
    const result = await toggleWishlist(displayVariant.id);
    if (result.ok) {
      toast.success(
        wasWishlisted ? "הוסר מהרשימה" : "נוסף לרשימה שלך",
      );
    } else {
      toast.error(result.error);
    }
  }

  const wishlisted =
    displayVariant != null && isWishlisted(displayVariant.id);

  return (
    <article className={styles.card}>
      <div className={styles.imageBlock}>
        {displayVariant ? <StockBadge variant={displayVariant} /> : null}
        {displayVariant ? (
          <button
            type="button"
            className={`${styles.wishBtn} ${wishlisted ? styles.wishBtnActive : ""}`}
            aria-label={
              wishlisted ? "הסרה מהרשימה שלי" : "הוספה לרשימה שלי"
            }
            aria-pressed={wishlisted}
            onClick={handleWishlist}
          >
            <Heart
              size={18}
              strokeWidth={1.75}
              aria-hidden
              fill={wishlisted ? "currentColor" : "none"}
            />
          </button>
        ) : null}
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
  );
}
