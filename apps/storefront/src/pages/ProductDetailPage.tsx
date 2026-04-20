import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import type { ProductVariant, ProductWithVariants } from "@rimon/shared-types";
import { Layout } from "../components/Layout/Layout";
import { useAuth } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";
import { formatPriceIls } from "../lib/formatPrice";
import { CACHE_KEYS } from "../lib/cacheService";
import { apiUrl } from "../lib/api";
import { useStaleWhileRevalidate } from "../hooks/useStaleWhileRevalidate";
import styles from "./ProductDetailPage.module.css";

const FALLBACK_IMAGE =
  "https://placehold.co/800x1000/FFFFFF/5C2330?text=%3F";

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const { addToCart } = useCart();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const cacheKey = id ? CACHE_KEYS.product(id) : null;
  const fetcher = useCallback(async (): Promise<ProductWithVariants | null> => {
    if (!id) return null;
    const res = await fetch(apiUrl(`/api/products/${encodeURIComponent(id)}`));
    if (!res.ok) return null;
    return (await res.json()) as ProductWithVariants;
  }, [id]);

  const { data: product, isValidating, hadCache } =
    useStaleWhileRevalidate<ProductWithVariants>(cacheKey, cacheKey ? fetcher : null);

  useEffect(() => {
    if (!product?.variants.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev && product.variants.some((v) => v.id === prev)) return prev;
      return product.variants[0]!.id;
    });
  }, [product]);

  const variants = product?.variants ?? [];
  const selected: ProductVariant | null =
    variants.find((v) => v.id === selectedId) ?? variants[0] ?? null;

  const imageSrc =
    selected?.imageUrl?.trim() ||
    variants.find((v) => v.imageUrl?.trim())?.imageUrl?.trim() ||
    FALLBACK_IMAGE;

  const inStock = selected ? selected.stockQuantity > 0 : false;

  async function handleAddToCart() {
    if (!selected || !product) return;
    if (selected.stockQuantity <= 0) return;
    const meta =
      accessToken == null
        ? {
            productId: product.id,
            productName: product.name,
            productSlug: product.slug,
            variantName: selected.variantName,
            price: selected.price,
            imageUrl: selected.imageUrl,
          }
        : undefined;
    const result = await addToCart(selected.id, 1, meta);
    if (result.ok) {
      toast.success("הפריט נוסף לעגלה");
    } else {
      toast.error(result.error);
    }
  }

  const showLoading = !product && isValidating;

  return (
    <Layout>
      <div className={styles.wrap}>
        <Link to="/" className={styles.back}>
          ← חזרה לדף הבית
        </Link>

        {showLoading ? (
          <div className={styles.grid}>
            <div className={styles.imageCol}>
              <div className={styles.imageWrap}>
                {!hadCache && (
                  <span className={styles.loading}>טוען…</span>
                )}
              </div>
            </div>
            <div>
              <div className={styles.skeletonTitle} aria-hidden />
              <div className={styles.skeletonDesc} aria-hidden />
              <div className={styles.skeletonPrice} aria-hidden />
            </div>
          </div>
        ) : !product ? (
          <p className={styles.error}>מוצר לא נמצא.</p>
        ) : (
          <div className={styles.grid}>
            <div className={styles.imageCol}>
              <div className={styles.imageWrap}>
                {selected ? (
                  <span
                    className={`${styles.badge} ${inStock ? styles.badgeInStock : styles.badgeOut}`}
                  >
                    {inStock ? "זמין במלאי" : "אזל מהמלאי"}
                  </span>
                ) : null}
                <img
                  src={imageSrc}
                  alt=""
                  className={styles.image}
                  decoding="async"
                />
              </div>
            </div>
            <div>
              <h1 className={styles.title}>{product.name}</h1>
              {product.description ? (
                <p className={styles.desc}>{product.description}</p>
              ) : null}

              {variants.length > 1 ? (
                <>
                  <p className={styles.variantLabel}>בחירת וריאנט</p>
                  <div className={styles.variantList} role="list">
                    {variants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        role="listitem"
                        className={`${styles.variantBtn} ${selected?.id === v.id ? styles.variantBtnActive : ""}`}
                        onClick={() => setSelectedId(v.id)}
                      >
                        {v.variantName} · {formatPriceIls(v.price)}
                        {v.stockQuantity <= 0 ? " · אזל" : ""}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              <div className={styles.priceRow}>
                {selected ? (
                  <span className={styles.price}>
                    {formatPriceIls(selected.price)}
                  </span>
                ) : null}
                <button
                  type="button"
                  className={styles.addBtn}
                  disabled={!selected || selected.stockQuantity <= 0}
                  onClick={handleAddToCart}
                >
                  הוספה לעגלה
                </button>
              </div>
              <p className={styles.holdNote}>
                {accessToken
                  ? "הפריט שמור עבורך ל־72 שעות לאחר ההוספה לעגלה. לאחר מכן המלאי ישוחרר אוטומטית."
                  : "שים לב: המלאי אינו שמור עד להתחברות או רכישה. התחברו כדי לשריין את הפריט ל־72 שעות."}
              </p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
