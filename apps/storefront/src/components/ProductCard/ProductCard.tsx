import { Link } from "react-router-dom";
import type { CategoryProduct } from "@rimon/shared-types";
import { formatIls } from "../../lib/formatIls";
import { PRODUCT_IMAGE_FALLBACK } from "../../lib/productImageFallback";
import styles from "./ProductCard.module.css";

interface ProductCardProps {
  product: CategoryProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const src =
    product.imageUrl?.trim() ? product.imageUrl.trim() : PRODUCT_IMAGE_FALLBACK;

  return (
    <Link
      to={`/product/${product.id}`}
      className={styles.card}
      aria-label={product.name}
    >
      <div className={styles.imageWrap}>
        <img src={src} alt="" className={styles.image} loading="lazy" />
      </div>
      <div className={styles.footer}>
        <h3 className={styles.title}>{product.name}</h3>
        <p className={styles.price}>{formatIls(product.price)}</p>
      </div>
    </Link>
  );
}
