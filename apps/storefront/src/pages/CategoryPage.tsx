import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Category } from "@rimon/shared-types";
import { Layout } from "../components/Layout/Layout";
import styles from "./CategoryPage.module.css";

export function CategoryPage() {
  const { slug } = useParams<{ slug?: string }>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subImageMap, setSubImageMap] = useState<Record<string, string>>({});
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

    fetch("/api/categories")
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
        return res.json() as Promise<Category[]>;
      })
      .then(async (json) => {
        if (cancelled) return;
        const rows = Array.isArray(json) ? (json as Category[]) : [];
        setCategories(rows);
        const parent = rows.find((c) => c.slug === slug);
        if (!parent) {
          setError("קטגוריה לא נמצאה");
          return;
        }
        const subs = parent.subCategories ?? [];
        const imageEntries = await Promise.all(
          subs.map(async (sub) => {
            try {
              const res = await fetch(
                `/api/categories/${encodeURIComponent(parent.slug)}/${encodeURIComponent(sub.slug)}/products`,
              );
              if (!res.ok) return [sub.slug, ""] as const;
              const data = (await res.json()) as {
                products?: { imageUrl?: string }[];
              };
              const first = data.products?.[0];
              return [sub.slug, first?.imageUrl?.trim() ?? ""] as const;
            } catch {
              return [sub.slug, ""] as const;
            }
          }),
        );
        if (!cancelled) {
          setSubImageMap(Object.fromEntries(imageEntries));
        }
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
  }, [slug]);

  const parentCategory = useMemo(
    () => categories.find((c) => c.slug === slug),
    [categories, slug],
  );

  if (loading) {
    return (
      <Layout>
        <div className={styles.state}>טוען…</div>
      </Layout>
    );
  }

  if (error || !parentCategory) {
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
          <span>
            {parentCategory?.name ?? "קטגוריה"}
          </span>
        </nav>

        <h1 className={styles.title}>{parentCategory.name}</h1>

        {parentCategory.subCategories == null ||
        parentCategory.subCategories.length === 0 ? (
          <p className={styles.empty}>אין תתי-קטגוריות להצגה כרגע.</p>
        ) : (
          <div className={styles.subGrid}>
            {parentCategory.subCategories.map((sub) => (
              <Link
                key={sub.id}
                to={`/category/${parentCategory.slug}/${sub.slug}`}
                className={styles.subCard}
              >
                <div className={styles.subImageWrap}>
                  <img
                    src={
                      subImageMap[sub.slug] ||
                      "https://placehold.co/600x800/FFFFFF/5C2330?text=%3F"
                    }
                    alt=""
                    className={styles.subImage}
                    loading="lazy"
                  />
                </div>
                <div className={styles.subNameRow}>
                  <h2 className={styles.subName}>{sub.name}</h2>
                  <span className={styles.subArrow} aria-hidden>
                    ‹
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
