import { useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import type { CategoryProductsResponse } from "@rimon/shared-types";
import { Layout } from "../components/Layout/Layout";
import { ProductCard } from "../components/ProductCard/ProductCard";
import { CACHE_KEYS } from "../lib/cacheService";
import { apiUrl } from "../lib/api";
import { useStaleWhileRevalidate } from "../hooks/useStaleWhileRevalidate";
import styles from "./SubCategoryPage.module.css";

export function SubCategoryPage() {
  const { categorySlug, subCategorySlug } = useParams<{
    categorySlug?: string;
    subCategorySlug?: string;
  }>();

  const cacheKey =
    categorySlug && subCategorySlug
      ? CACHE_KEYS.categoryProducts(categorySlug, subCategorySlug)
      : null;

  const fetcher = useCallback(async (): Promise<CategoryProductsResponse | null> => {
    if (!categorySlug || !subCategorySlug) return null;
    const res = await fetch(
      apiUrl(
        `/api/categories/${encodeURIComponent(categorySlug)}/${encodeURIComponent(subCategorySlug)}/products`,
      ),
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as CategoryProductsResponse;
  }, [categorySlug, subCategorySlug]);

  const { data, isValidating, hadCache } = useStaleWhileRevalidate<CategoryProductsResponse>(
    cacheKey,
    cacheKey ? fetcher : null,
  );

  if (!categorySlug || !subCategorySlug) {
    return (
      <Layout>
        <section className={styles.state}>
          <p>תת-קטגוריה לא נמצאה</p>
          <Link to="/" className={styles.back}>חזרה לדף הבית</Link>
        </section>
      </Layout>
    );
  }

  const showShell = !data && isValidating;

  if (showShell) {
    return (
      <Layout>
        <section className={styles.wrap}>
          <nav className={styles.breadcrumb}>
            <Link to="/">דף הבית</Link>
            <span className={styles.breadcrumbSep}>/</span>
            <Link to={`/category/${categorySlug}`}>{categorySlug}</Link>
            <span className={styles.breadcrumbSep}>/</span>
            <span>{subCategorySlug}</span>
          </nav>
          <h1 className={styles.title}>{subCategorySlug}</h1>
          <div className={styles.grid}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={styles.placeholderCard} aria-hidden />
            ))}
          </div>
          {!hadCache && (
            <p className={styles.inlineLoading}>טוען מוצרים…</p>
          )}
        </section>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <section className={styles.state}>
          <p>תת-קטגוריה לא נמצאה</p>
          <Link to="/" className={styles.back}>חזרה לדף הבית</Link>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className={styles.wrap}>
        <nav className={styles.breadcrumb}>
          <Link to="/">דף הבית</Link>
          <span className={styles.breadcrumbSep}>/</span>
          <Link to={`/category/${data.category.slug}`}>{data.category.name}</Link>
          <span className={styles.breadcrumbSep}>/</span>
          <span>{data.subCategory?.name ?? "תת-קטגוריה"}</span>
        </nav>

        <h1 className={styles.title}>
          {data.subCategory?.name ?? data.category.name}
        </h1>

        {data.products.length === 0 ? (
          <p className={styles.empty}>אין מוצרים בקטגוריה זו כרגע.</p>
        ) : (
          <div className={styles.grid}>
            {data.products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
