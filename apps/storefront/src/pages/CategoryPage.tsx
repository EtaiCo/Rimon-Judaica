import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { CategoryProductsResponse } from "@rimon/shared-types";
import { Layout } from "../components/Layout/Layout";
import { useBootstrap } from "../context/BootstrapContext";
import { CACHE_KEYS, readJson } from "../lib/cacheService";
import { apiUrl } from "../lib/api";
import styles from "./CategoryPage.module.css";

const THUMB_PLACEHOLDER =
  "https://placehold.co/600x800/FFFFFF/5C2330?text=%3F";

export function CategoryPage() {
  const { slug } = useParams<{ slug?: string }>();
  const { categories, isBootstrapping, hasHydratedData } = useBootstrap();
  const [subImageMap, setSubImageMap] = useState<Record<string, string>>({});
  const [loadingSlugs, setLoadingSlugs] = useState<Set<string>>(new Set());

  const parentCategory = useMemo(
    () => categories.find((c) => c.slug === slug),
    [categories, slug],
  );

  useEffect(() => {
    if (!parentCategory) return;
    const subs = parentCategory.subCategories ?? [];
    if (subs.length === 0) return;

    // Try to resolve thumbnails from existing subcategory-page caches first
    const resolved: Record<string, string> = {};
    const toFetch: { slug: string }[] = [];
    for (const sub of subs) {
      const cached = readJson<CategoryProductsResponse>(
        CACHE_KEYS.categoryProducts(parentCategory.slug, sub.slug),
      );
      const first = cached?.products?.[0];
      const url = first?.variants?.[0]?.imageUrl?.trim() ?? (first as { imageUrl?: string } | undefined)?.imageUrl?.trim();
      if (url) {
        resolved[sub.slug] = url;
      } else {
        toFetch.push(sub);
      }
    }
    setSubImageMap(resolved);
    if (toFetch.length === 0) return;

    let cancelled = false;
    setLoadingSlugs(new Set(toFetch.map((s) => s.slug)));

    Promise.all(
      toFetch.map(async (sub) => {
        try {
          const res = await fetch(
            apiUrl(
              `/api/categories/${encodeURIComponent(parentCategory.slug)}/${encodeURIComponent(sub.slug)}/products`,
            ),
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
    )
      .then((entries) => {
        if (!cancelled) {
          setSubImageMap((prev) => ({
            ...prev,
            ...Object.fromEntries(entries),
          }));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSlugs(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [parentCategory]);

  const waiting = isBootstrapping && !hasHydratedData && categories.length === 0;

  // Shell: render layout structure even while waiting
  if (waiting || (!slug || !parentCategory)) {
    if (waiting) {
      return (
        <Layout>
          <div className={styles.wrap}>
            <div className={styles.breadcrumbSkeleton} aria-hidden />
            <div className={styles.titleSkeleton} aria-hidden />
            <div className={styles.subGrid}>
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className={styles.subCardSkeleton} aria-hidden />
              ))}
            </div>
          </div>
        </Layout>
      );
    }
    return (
      <Layout>
        <div className={styles.state}>
          <p>קטגוריה לא נמצאה</p>
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
          <span>{parentCategory.name}</span>
        </nav>

        <h1 className={styles.title}>{parentCategory.name}</h1>

        {parentCategory.subCategories == null ||
        parentCategory.subCategories.length === 0 ? (
          <p className={styles.empty}>אין תתי-קטגוריות להצגה כרגע.</p>
        ) : (
          <div className={styles.subGrid}>
            {parentCategory.subCategories.map((sub) => {
              const thumbUrl = subImageMap[sub.slug];
              const isLoading = loadingSlugs.has(sub.slug);
              return (
                <Link
                  key={sub.id}
                  to={`/category/${parentCategory.slug}/${sub.slug}`}
                  className={styles.subCard}
                >
                  <div className={styles.subImageWrap}>
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt=""
                        className={styles.subImage}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : isLoading ? (
                      <span className={styles.subImageLoading}>טוען…</span>
                    ) : (
                      <img
                        src={THUMB_PLACEHOLDER}
                        alt=""
                        className={styles.subImage}
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                  </div>
                  <div className={styles.subNameRow}>
                    <h2 className={styles.subName}>{sub.name}</h2>
                    <span className={styles.subArrow} aria-hidden>
                      ‹
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
