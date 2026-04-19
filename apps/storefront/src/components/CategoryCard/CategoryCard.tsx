import { Link } from "react-router-dom";
import type { Category } from "@rimon/shared-types";
import styles from "./CategoryCard.module.css";

const FALLBACK_IMAGE =
  "https://placehold.co/600x800/FFFFFF/5C2330?text=%D7%A7%D7%98%D7%92%D7%95%D7%A8%D7%99%D7%94";

type CategoryCardProps = {
  category: Category;
};

export function CategoryCard({ category }: CategoryCardProps) {
  const src = category.imageUrl?.trim() || FALLBACK_IMAGE;

  return (
    <Link
      to={`/category/${category.slug}`}
      className={styles.card}
      aria-label={category.name}
    >
      <div className={styles.imageWrap}>
        <img src={src} alt="" className={styles.image} loading="lazy" decoding="async" />
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
