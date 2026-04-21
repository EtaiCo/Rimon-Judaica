import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Search, ShoppingCart, User } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useBootstrap } from "../../context/BootstrapContext";
import { useCart } from "../../cart/CartContext";
import { prefetchCategoryProducts } from "../../lib/cacheService";
import styles from "./Header.module.css";

const GUEST_CART_TOOLTIP =
  "התחבר כדי לשריין את הפריטים ל-3 ימים";

const ICON_STROKE = 1.35;
const SCROLL_ENTER_THRESHOLD = 60;
const SCROLL_EXIT_THRESHOLD = 35;

type HeaderProps = {
  onOpenCart?: () => void;
  onOpenSearch?: () => void;
};

export function Header({ onOpenCart, onOpenSearch }: HeaderProps) {
  const { customer, clearSession, accessToken, isAdmin } = useAuth();
  const { categories, logoImageUrl, isBootstrapping, hasHydratedData } =
    useBootstrap();
  const { itemCount } = useCart();
  const [isScrolled, setIsScrolled] = useState(false);
  const [openCategorySlug, setOpenCategorySlug] = useState<string | null>(null);
  const [isMobileMenuMode, setIsMobileMenuMode] = useState(false);
  const [badgeBump, setBadgeBump] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const isScrolledRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();
  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpenCategorySlug(null);
      closeTimerRef.current = null;
    }, 150);
  }, [clearCloseTimer]);

  useEffect(() => {
    const applyScrollState = () => {
      const y = window.scrollY;
      const next = isScrolledRef.current
        ? y > SCROLL_EXIT_THRESHOLD
        : y > SCROLL_ENTER_THRESHOLD;
      if (next === isScrolledRef.current) return;
      isScrolledRef.current = next;
      setIsScrolled(next);
    };
    const onScroll = () => {
      if (scrollRafRef.current != null) return;
      scrollRafRef.current = window.requestAnimationFrame(() => {
        scrollRafRef.current = null;
        applyScrollState();
      });
    };
    applyScrollState();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollRafRef.current != null) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const update = () => {
      const narrow = window.matchMedia("(max-width: 900px)").matches;
      const noHover = window.matchMedia("(hover: none)").matches;
      setIsMobileMenuMode(narrow || noHover);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!openCategorySlug) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenCategorySlug(null);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest("[data-header-category-menu]")) {
        setOpenCategorySlug(null);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [openCategorySlug]);

  useEffect(() => {
    if (!openCategorySlug) return;
    const parent = categories.find((c) => c.slug === openCategorySlug);
    if (!parent?.subCategories?.length) return;
    for (const sub of parent.subCategories) {
      void prefetchCategoryProducts(parent.slug, sub.slug);
    }
  }, [openCategorySlug, categories]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  useEffect(() => {
    if (itemCount < 1) return;
    setBadgeBump(true);
    const id = window.setTimeout(() => setBadgeBump(false), 280);
    return () => window.clearTimeout(id);
  }, [itemCount]);

  const duration = prefersReducedMotion ? 0 : 0.5;
  const easeCurve = [0.4, 0, 0.2, 1] as const;
  const displayName =
    customer?.full_name?.trim() || customer?.email || "";
  const showBrandSkeleton = isBootstrapping && !hasHydratedData && !logoImageUrl;
  const showCategorySkeleton =
    isBootstrapping && !hasHydratedData && categories.length === 0;

  return (
    <div className={styles.stickyOuter}>
      <motion.header
        className={`${styles.shell} ${isScrolled ? styles.shellScrolled : styles.shellTop}`}
        initial={false}
        animate={{
          maxWidth: isScrolled ? "95%" : "100%",
          borderRadius: isScrolled ? 50 : 0,
          marginTop: isScrolled ? 10 : 0,
          boxShadow: isScrolled
            ? "0 8px 32px rgba(0, 0, 0, 0.07)"
            : "0 0 0 rgba(0, 0, 0, 0)",
          backgroundColor: isScrolled
            ? "rgba(255, 255, 255, 0.82)"
            : "rgb(255, 255, 255)",
        }}
        transition={{ duration, ease: easeCurve }}
      >
        <div className={styles.inner}>
          <div className={styles.upper}>
            <div className={styles.upperStart}>
              <Link to="/" className={styles.upperLink}>
                דף הבית
              </Link>
              {customer ? (
                <div className={styles.authCluster}>
                  <span className={styles.greeting}>שלום {displayName}</span>
                  {isAdmin ? (
                    <Link to="/admin" className={styles.upperLink}>
                      ניהול
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className={`${styles.upperLink} ${styles.logoutBtn}`}
                    onClick={() => clearSession()}
                  >
                    התנתקות
                  </button>
                </div>
              ) : (
                <div className={styles.authCluster}>
                  <Link to="/register" className={styles.upperLink}>
                    הרשמה
                  </Link>
                  <Link to="/login" className={styles.upperLink}>
                    התחברות
                  </Link>
                </div>
              )}
            </div>

            <Link to="/" className={styles.brand}>
              {logoImageUrl ? (
                <img
                  src={logoImageUrl}
                  alt="Rimon Judaica Logo"
                  className={styles.brandLogo}
                  width={420}
                  height={128}
                  fetchPriority="high"
                  loading="eager"
                  decoding="async"
                />
              ) : showBrandSkeleton ? (
                <span className={styles.brandSkeleton} aria-hidden="true" />
              ) : (
                <span className={styles.brandText}>רימון יודאיקה</span>
              )}
            </Link>

            <div className={styles.upperEnd}>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label="חיפוש"
                title="חיפוש"
                onClick={onOpenSearch}
              >
                <Search size={22} strokeWidth={ICON_STROKE} aria-hidden />
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label="עגלת קניות"
                title={
                  !accessToken && itemCount > 0
                    ? GUEST_CART_TOOLTIP
                    : undefined
                }
                onClick={onOpenCart}
              >
                <ShoppingCart size={22} strokeWidth={ICON_STROKE} aria-hidden />
                {itemCount > 0 ? (
                  <span
                    className={`${styles.cartBadge} ${badgeBump ? styles.cartBadgeBump : ""}`}
                  >
                    {itemCount}
                  </span>
                ) : null}
              </button>
              <Link
                to={customer ? "/account" : "/login"}
                className={styles.iconBtn}
                aria-label={customer ? "האזור האישי" : "התחברות"}
                title={customer ? "האזור האישי" : "התחברות"}
              >
                <User size={22} strokeWidth={ICON_STROKE} aria-hidden />
              </Link>
            </div>
          </div>

          <div className={styles.categoryBar}>
            {showCategorySkeleton ? (
              <div className={styles.categorySkeletonRow} aria-hidden="true">
                <span className={styles.categorySkeletonChip} />
                <span className={styles.categorySkeletonChip} />
                <span className={styles.categorySkeletonChip} />
                <span className={styles.categorySkeletonChip} />
              </div>
            ) : categories.length === 0 ? (
              <p className={styles.categoryMeta}>אין קטגוריות להצגה.</p>
            ) : (
              <nav
                className={styles.categoryNav}
                aria-label="קטגוריות מוצרים"
              >
                {categories.map((c) => (
                  <div
                    key={c.id}
                    className={styles.categoryItem}
                    data-header-category-menu
                    onMouseEnter={() => {
                      if (!isMobileMenuMode && c.subCategories?.length) {
                        clearCloseTimer();
                        setOpenCategorySlug(c.slug);
                      }
                    }}
                    onMouseLeave={() => {
                      if (!isMobileMenuMode) scheduleClose();
                    }}
                  >
                    {c.subCategories?.length ? (
                      <button
                        type="button"
                        className={styles.categoryLink}
                        onClick={() => {
                          if (!isMobileMenuMode) return;
                          setOpenCategorySlug((prev) =>
                            prev === c.slug ? null : c.slug,
                          );
                        }}
                      >
                        <span>{c.name}</span>
                        <ChevronDown
                          size={14}
                          strokeWidth={1.45}
                          aria-hidden
                          className={`${styles.categoryChevron} ${openCategorySlug === c.slug ? styles.categoryChevronOpen : ""}`}
                        />
                      </button>
                    ) : (
                      <Link to={`/category/${c.slug}`} className={styles.categoryLink}>
                        {c.name}
                      </Link>
                    )}
                    {c.subCategories?.length &&
                    openCategorySlug === c.slug ? (
                      <div
                        className={styles.subMenu}
                        onMouseEnter={clearCloseTimer}
                        onMouseLeave={() => {
                          if (!isMobileMenuMode) scheduleClose();
                        }}
                      >
                        {c.subCategories.map((sub) => (
                          <Link
                            key={sub.id}
                            to={`/category/${c.slug}/${sub.slug}`}
                            className={styles.subMenuLink}
                            onClick={() => setOpenCategorySlug(null)}
                          >
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </nav>
            )}
          </div>
        </div>
      </motion.header>
    </div>
  );
}
