import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { CategoryProductsResponse } from "@rimon/shared-types";
import { Layout } from "../components/Layout/Layout";
import { ProductCard } from "../components/ProductCard/ProductCard";
import styles from "./SubCategoryPage.module.css";

export function SubCategoryPage() {
  const { categorySlug, subCategorySlug } = useParams<{
    categorySlug?: string;
    subCategorySlug?: string;
  }>();
  const [data, setData] = useState<CategoryProductsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!categorySlug || !subCategorySlug) {
      setError("תת-קטגוריה לא נמצאה");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(
      `/api/categories/${encodeURIComponent(categorySlug)}/${encodeURIComponent(subCategorySlug)}/products`,
    )
      .then(async (res) => {
        if (res.status === 404) {
          throw new Error("תת-קטגוריה לא נמצאה");
        }
        if (!res.ok) {
          throw new Error("לא הצלחנו לטעון את המוצרים");
        }
        return res.json() as Promise<CategoryProductsResponse>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "שגיאת טעינה");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [categorySlug, subCategorySlug]);

  if (loading) {
    return (
      <Layout>
        <section className={styles.state}>
          <p>טוענים מוצרים...</p>
        </section>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout>
        <section className={styles.state}>
          <p>{error ?? "תת-קטגוריה לא נמצאה"}</p>
          <Link to="/" className={styles.back}>
            חזרה לדף הבית
          </Link>
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
