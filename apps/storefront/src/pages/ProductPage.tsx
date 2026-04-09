import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ProductVariant, ProductWithVariants } from "@rimon/shared-types";
import { Layout } from "../components/Layout/Layout";
import { formatIls } from "../lib/formatIls";
import { PRODUCT_IMAGE_FALLBACK } from "../lib/productImageFallback";
import styles from "./ProductPage.module.css";

function variantImage(v: ProductVariant): string {
  const u = v.imageUrl?.trim();
  return u ? u : PRODUCT_IMAGE_FALLBACK;
}

export function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<ProductWithVariants | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("מוצר לא נמצא");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/products/${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            typeof body.error === "string" ? body.error : res.statusText,
          );
        }
        return res.json() as Promise<ProductWithVariants>;
      })
      .then((data) => {
        if (cancelled) return;
        setProduct(data);
        const first = data.variants[0];
        setSelectedId(first?.id ?? null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "שגיאת טעינה");
        setProduct(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const selected = useMemo(() => {
    if (!product?.variants.length) return null;
    const sid = selectedId ?? product.variants[0].id;
    return product.variants.find((v) => v.id === sid) ?? product.variants[0];
  }, [product, selectedId]);

  if (loading) {
    return (
      <Layout>
        <div className={styles.state}>טוען…</div>
      </Layout>
    );
  }

  if (error || !product) {
    return (
      <Layout>
        <div className={styles.state}>
          <p>{error ?? "מוצר לא נמצא"}</p>
          <Link to="/" className={styles.back}>
            חזרה לדף הבית
          </Link>
        </div>
      </Layout>
    );
  }

  if (product.variants.length === 0) {
    return (
      <Layout>
        <div className={styles.state}>
          <p>למוצר זה אין וריאנטים זמינים.</p>
          <Link to="/" className={styles.back}>
            חזרה לדף הבית
          </Link>
        </div>
      </Layout>
    );
  }

  const descRaw = product.description?.trim() ?? "";
  const description = descRaw.length > 0 ? descRaw : null;

  return (
    <Layout>
      <div className={styles.wrap}>
        <Link to="/" className={styles.breadcrumb}>
          ← ראשי
        </Link>

        <div className={styles.grid}>
          <div className={styles.gallery}>
            {selected && (
              <div className={styles.mainImageWrap}>
                <img
                  src={variantImage(selected)}
                  alt=""
                  className={styles.mainImage}
                />
              </div>
            )}
            {product.variants.length > 1 && (
              <div className={styles.thumbs} role="tablist" aria-label="וריאנטים">
                {product.variants.map((v) => {
                  const active = v.id === selected?.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={active ? styles.thumbActive : styles.thumb}
                      onClick={() => setSelectedId(v.id)}
                    >
                      <img
                        src={variantImage(v)}
                        alt=""
                        className={styles.thumbImg}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className={styles.info}>
            <h1 className={styles.title}>{product.name}</h1>
            {selected && (
              <p className={styles.price}>{formatIls(selected.price)}</p>
            )}

            <div className={styles.description}>
              {description ? (
                <p>{description}</p>
              ) : (
                <p className={styles.descriptionMuted}>אין תיאור זמין למוצר זה.</p>
              )}
            </div>

            {product.variants.length > 1 && (
              <div className={styles.variants}>
                <span className={styles.variantsLabel}>בחירת אפשרות</span>
                <div className={styles.variantButtons}>
                  {product.variants.map((v) => {
                    const active = v.id === selected?.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        className={
                          active ? styles.variantBtnActive : styles.variantBtn
                        }
                        onClick={() => setSelectedId(v.id)}
                      >
                        {v.variantName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button type="button" className={styles.addToCart}>
              הוסף לסל
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
