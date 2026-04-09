import { useEffect, useState } from "react";
import type { Category } from "@rimon/shared-types";
import { CategoryGrid } from "../components/CategoryGrid/CategoryGrid";
import { HeroImage } from "../components/HeroImage/HeroImage";
import { Layout } from "../components/Layout/Layout";
import { PromoCarousel } from "../components/PromoCarousel/PromoCarousel";
import styles from "./HomePage.module.css";

export function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/categories")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            typeof body.error === "string" ? body.error : res.statusText,
          );
        }
        return res.json() as Promise<Category[]>;
      })
      .then((rows) => {
        if (cancelled) return;
        const roots = rows.filter((c) => c.parentId == null);
        setCategories(roots);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "שגיאת טעינה");
          setCategories([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Layout>
      <HeroImage />
      <section className={styles.section} aria-labelledby="categories-heading">
        <h2 id="categories-heading" className={styles.sectionTitle}>
          קטגוריות
        </h2>
        {loading && <p className={styles.feedback}>טוען קטגוריות…</p>}
        {error && <p className={styles.feedbackError}>{error}</p>}
        {!loading && !error && categories.length === 0 && (
          <p className={styles.feedback}>אין קטגוריות להצגה.</p>
        )}
        {!loading && !error && categories.length > 0 && (
          <CategoryGrid categories={categories} />
        )}
      </section>
      <PromoCarousel />
    </Layout>
  );
}
