import { Link } from "react-router-dom";
import type { Category } from "@rimon/shared-types";
import styles from "./CategoryCard.module.css";

const FALLBACK_IMAGE =
  "https://placehold.co/600x800/FAF8F2/2C1A0E?text=%D7%A7%D7%98%D7%92%D7%95%D7%A8%D7%99%D7%94";

interface CategoryCardProps {
  category: Category;
}

export function CategoryCard({ category }: CategoryCardProps) {
  const src = category.imageUrl?.trim() || FALLBACK_IMAGE;

  return (
    <Link
      to={`/category/${category.slug}`}
      className={styles.card}
      aria-label={category.name}
    >
      <div className={styles.imageWrap}>
        <img src={src} alt="" className={styles.image} loading="lazy" />
      </div>
      <div className={styles.footer}>
        <h3 className={styles.title}>{category.name}</h3>
        <span className={styles.arrow} aria-hidden>
          ←
        </span>
      </div>
    </Link>
  );
}
