import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import type { ProductSearchResponse, ProductWithVariants } from "@rimon/shared-types";
import { useBootstrap } from "../../context/BootstrapContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { formatPriceIls } from "../../lib/formatPrice";
import { pickDisplayVariant } from "../../lib/productDisplay";
import { PRODUCT_IMAGE_FALLBACK } from "../../lib/productImageFallback";
import { apiUrl } from "../../lib/api";
import styles from "./SearchOverlay.module.css";

type SearchOverlayProps = {
  open: boolean;
  onClose: () => void;
};

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const navigate = useNavigate();
  const { categories } = useBootstrap();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const reducedMotion = useReducedMotion();
  const debouncedQuery = useDebouncedValue(query.trim(), 280);

  const subCategoryPills = useMemo(() => {
    const rows = categories.flatMap((c) =>
      (c.subCategories ?? []).map((sub) => ({
        id: sub.id,
        name: sub.name,
        parentSlug: c.slug,
        parentName: c.name,
        slug: sub.slug,
      })),
    );
    return rows.sort((a, b) => {
      const p = a.parentName.localeCompare(b.parentName, "he");
      if (p !== 0) return p;
      return a.name.localeCompare(b.name, "he");
    });
  }, [categories]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusId = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => {
      window.clearTimeout(focusId);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || debouncedQuery.length < 2) {
      setProducts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(
      apiUrl(`/api/products/search?q=${encodeURIComponent(debouncedQuery)}&limit=8`),
    )
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as ProductSearchResponse;
      })
      .then((payload) => {
        if (cancelled || !payload) return;
        setProducts(payload.products.slice(0, 5));
      })
      .catch(() => {
        if (!cancelled) {
          setProducts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    onClose();
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            className={styles.backdrop}
            onClick={onClose}
            aria-label="סגור חיפוש"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
          />
          <motion.aside
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-label="חיפוש מוצרים"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: reducedMotion ? 0 : 0.22 }}
          >
            <div className={styles.head}>
              <form onSubmit={handleSubmit} className={styles.searchForm}>
                <Search size={20} aria-hidden className={styles.searchIcon} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={styles.input}
                  placeholder="חפשו מוצרים, קטגוריות או אמנות..."
                />
                <button type="submit" className={styles.submitBtn}>
                  חיפוש
                </button>
              </form>
              <button type="button" className={styles.closeBtn} onClick={onClose}>
                <X size={20} aria-hidden />
              </button>
            </div>

            <div className={styles.pills}>
              {subCategoryPills.map((pill) => (
                <Link
                  key={pill.id}
                  to={`/category/${pill.parentSlug}/${pill.slug}`}
                  className={styles.pill}
                  onClick={onClose}
                >
                  {pill.name}
                </Link>
              ))}
            </div>

            {debouncedQuery.length >= 2 && (
              <section className={styles.resultsArea}>
                {loading ? (
                  <p className={styles.meta}>טוען…</p>
                ) : products.length === 0 ? (
                  <p className={styles.meta}>לא נמצאו תוצאות מהירות.</p>
                ) : (
                  <div className={styles.quickProducts}>
                    {products.map((p) => {
                      const displayVariant = pickDisplayVariant(p.variants);
                      const thumb =
                        displayVariant?.imageUrl?.trim() || PRODUCT_IMAGE_FALLBACK;
                      return (
                        <Link
                          key={p.id}
                          to={`/product/${p.id}`}
                          className={styles.quickProduct}
                          onClick={onClose}
                        >
                          <img
                            src={thumb}
                            alt=""
                            className={styles.quickThumb}
                            loading="lazy"
                            decoding="async"
                          />
                          <div className={styles.quickBody}>
                            <span className={styles.quickName}>{p.name}</span>
                            <span className={styles.quickPrice}>
                              {formatPriceIls(p.minPrice ?? displayVariant?.price ?? 0)}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
