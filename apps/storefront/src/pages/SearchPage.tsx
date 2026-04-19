import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { ProductSearchResponse } from "@rimon/shared-types";
import { Layout } from "../components/Layout/Layout";
import { ProductCard } from "../components/ProductCard/ProductCard";
import { useBootstrap } from "../context/BootstrapContext";
import styles from "./SearchPage.module.css";

export function SearchPage() {
  const [params] = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const { categories } = useBootstrap();
  const [products, setProducts] = useState<ProductSearchResponse["products"]>([]);
  const [loading, setLoading] = useState(false);

  const popularSubs = useMemo(
    () =>
      categories
        .flatMap((c) =>
          (c.subCategories ?? []).map((sub) => ({
            id: sub.id,
            name: sub.name,
            parentSlug: c.slug,
            slug: sub.slug,
          })),
        )
        .slice(0, 8),
    [categories],
  );

  useEffect(() => {
    if (q.length < 2) {
      setProducts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/products/search?q=${encodeURIComponent(q)}&limit=24`)
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as ProductSearchResponse;
      })
      .then((payload) => {
        if (cancelled || !payload) return;
        setProducts(payload.products);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [q]);

  return (
    <Layout>
      <section className={styles.wrap}>
        <h1 className={styles.title}>תוצאות חיפוש</h1>
        {q.length > 0 && (
          <p className={styles.meta}>
            מחפשים: <strong>{q}</strong>
          </p>
        )}

        {q.length < 2 ? (
          <p className={styles.empty}>הקלידו לפחות 2 תווים כדי להתחיל חיפוש.</p>
        ) : loading ? (
          <p className={styles.empty}>טוען…</p>
        ) : products.length === 0 ? (
          <div className={styles.emptyBlock}>
            <p className={styles.empty}>
              לא מצאנו בדיוק את מה שחיפשת, אולי יעניין אותך...
            </p>
            <div className={styles.pills}>
              {popularSubs.map((sub) => (
                <Link
                  key={sub.id}
                  to={`/category/${sub.parentSlug}/${sub.slug}`}
                  className={styles.pill}
                >
                  {sub.name}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.grid}>
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
