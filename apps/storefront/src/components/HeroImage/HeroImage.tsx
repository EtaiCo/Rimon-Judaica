import styles from "./HeroImage.module.css";

const DEFAULT_SRC =
  "https://placehold.co/1920x520/FAF8F2/2C1A0E?text=%D7%A8%D7%99%D7%9E%D7%95%D7%9F+%D7%99%D7%95%D7%93%D7%90%D7%99%D7%A7%D7%94";

interface HeroImageProps {
  src?: string;
  alt?: string;
  title?: string;
}

export function HeroImage({
  src = DEFAULT_SRC,
  alt = "רימון יודאיקה — דף הבית",
  title = "רימון יודאיקה",
}: HeroImageProps) {
  return (
    <section className={styles.wrapper} aria-label={title}>
      <div className={styles.headlineRow}>
        <h1 className={styles.headline}>{title}</h1>
      </div>
      <div className={styles.bleed}>
        <div className={styles.frame}>
          <img src={src} alt={alt} className={styles.image} />
        </div>
      </div>
    </section>
  );
}
