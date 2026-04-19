import { CategoryGrid } from "../components/CategoryGrid/CategoryGrid";
import { HeroImage } from "../components/HeroImage/HeroImage";
import { Layout } from "../components/Layout/Layout";
import { PromoCarousel } from "../components/PromoCarousel/PromoCarousel";
import { useBootstrap } from "../context/BootstrapContext";
import styles from "./HomePage.module.css";

export function HomePage() {
  const { categories, heroImageUrl, isBootstrapping, hasHydratedData } =
    useBootstrap();
  const showCategorySkeleton =
    isBootstrapping && !hasHydratedData && categories.length === 0;
  const showHeroSkeleton = isBootstrapping && !hasHydratedData && !heroImageUrl;

  return (
    <Layout>
      <HeroImage src={heroImageUrl} isLoading={showHeroSkeleton} />
      <section className={styles.section} aria-labelledby="categories-heading">
        <h2 id="categories-heading" className={styles.sectionTitle}>
          קטגוריות
        </h2>
        {showCategorySkeleton && (
          <div className={styles.gridSkeleton} aria-hidden="true">
            <span className={styles.gridSkeletonItem} />
            <span className={styles.gridSkeletonItem} />
            <span className={styles.gridSkeletonItem} />
          </div>
        )}
        {!showCategorySkeleton && categories.length === 0 && (
          <p className={styles.feedback}>אין קטגוריות להצגה.</p>
        )}
        {!showCategorySkeleton && categories.length > 0 && <CategoryGrid categories={categories} />}
      </section>
      <PromoCarousel />
    </Layout>
  );
}
