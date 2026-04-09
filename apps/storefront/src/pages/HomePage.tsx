import { Layout } from "../components/Layout/Layout";
import { HeroImage } from "../components/HeroImage/HeroImage";
import { PromoCarousel } from "../components/PromoCarousel/PromoCarousel";
import { CategoryGrid } from "../components/CategoryGrid/CategoryGrid";
import { HOME_CATEGORIES } from "../data/homeCategories";
import styles from "./HomePage.module.css";

export function HomePage() {
  return (
    <Layout>
      <HeroImage />
      <section className={styles.section} aria-labelledby="categories-heading">
        <h2 id="categories-heading" className={styles.sectionTitle}>
          קטגוריות
        </h2>
        <CategoryGrid categories={HOME_CATEGORIES} />
      </section>
      <PromoCarousel />
    </Layout>
  );
}
