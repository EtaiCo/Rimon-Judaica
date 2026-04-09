import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { CategoryProductsResponse } from "@rimon/shared-types";
import { Layout } from "../components/Layout/Layout";
import { ProductCard } from "../components/ProductCard/ProductCard";
import styles from "./CategoryPage.module.css";

export function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<CategoryProductsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError("קטגוריה לא נמצאה");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/categories/${encodeURIComponent(slug)}/products`)
      .then(async (res) => {
        if (res.status === 404) {
          throw new Error("קטגוריה לא נמצאה");
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            typeof body.error === "string" ? body.error : res.statusText,
          );
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
  }, [slug]);

  if (loading) {
    return (
      <Layout>
        <div className={styles.state}>טוען…</div>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout>
        <div className={styles.state}>
          <p>{error ?? "שגיאה"}</p>
          <Link to="/" className={styles.back}>
            חזרה לדף הבית
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={styles.wrap}>
        <nav className={styles.breadcrumb} aria-label="ניווט">
          <Link to="/">ראשי</Link>
          <span className={styles.breadcrumbSep} aria-hidden>
            /
          </span>
          <span>{data.category.name}</span>
        </nav>

        <h1 className={styles.title}>{data.category.name}</h1>

        {data.products.length === 0 ? (
          <p className={styles.empty}>אין מוצרים בקטגוריה זו כרגע.</p>
        ) : (
          <div className={styles.grid}>
            {data.products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
