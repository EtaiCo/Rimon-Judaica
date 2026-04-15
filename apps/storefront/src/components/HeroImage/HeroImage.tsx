import styles from "./HeroImage.module.css";

const DEFAULT_SRC =
  "https://placehold.co/1920x900/FFFFFF/5C2330?text=%D7%A8%D7%99%D7%9E%D7%95%D7%9F+%D7%99%D7%95%D7%93%D7%90%D7%99%D7%A7%D7%94";

interface HeroImageProps {
  src?: string;
  alt?: string;
  isLoading?: boolean;
}

export function HeroImage({
  src,
  alt = "רימון יודאיקה — דף הבית",
  isLoading = false,
}: HeroImageProps) {
  const resolvedSrc = src?.trim() || DEFAULT_SRC;

  return (
    <section className={styles.wrapper} aria-label={alt}>
      <div className={styles.bleed}>
        <div className={styles.frame}>
          {isLoading ? (
            <div className={styles.imagePlaceholder} aria-hidden="true" />
          ) : (
            <img
              src={resolvedSrc}
              alt={alt}
              className={styles.image}
              fetchPriority="high"
              loading="eager"
              decoding="async"
            />
          )}
        </div>
      </div>
    </section>
  );
}
