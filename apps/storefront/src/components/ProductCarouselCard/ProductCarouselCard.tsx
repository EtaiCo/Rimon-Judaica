import { Link } from "react-router-dom";
import styles from "./ProductCarouselCard.module.css";

export type ProductCarouselItem = {
  id: string;
  name: string;
  priceLabel: string;
  imageUrl?: string;
  href?: string;
};

const FALLBACK_IMAGE =
  "https://placehold.co/600x800/FFFFFF/5C2330?text=%3F";

type ProductCarouselCardProps = {
  product: ProductCarouselItem;
};

export function ProductCarouselCard({ product }: ProductCarouselCardProps) {
  const src = product.imageUrl?.trim() || FALLBACK_IMAGE;
  const to = product.href ?? "#";

  return (
    <Link
      to={to}
      className={styles.card}
      aria-label={`${product.name} — ${product.priceLabel}`}
    >
      <div className={styles.imageWrap}>
        <img src={src} alt="" className={styles.image} loading="lazy" decoding="async" />
      </div>
      <div className={styles.footer}>
        <h3 className={styles.name}>{product.name}</h3>
        <div className={styles.metaRow}>
          <span className={styles.price}>{product.priceLabel}</span>
          <span className={styles.arrow} aria-hidden>
            ←
          </span>
        </div>
      </div>
    </Link>
  );
}
