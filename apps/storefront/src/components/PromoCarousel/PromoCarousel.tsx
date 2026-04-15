import { useEffect, useState } from "react";
import { Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import type { ProductWithVariants } from "@rimon/shared-types";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { PRODUCT_CAROUSEL_PLACEHOLDERS } from "../../data/productCarouselPlaceholders";
import { ProductCard } from "../ProductCard/ProductCard";
import { ProductCarouselCard } from "../ProductCarouselCard/ProductCarouselCard";
import styles from "./PromoCarousel.module.css";

const SPACE_PX = 24;
const SLICE = 12;

export function PromoCarousel() {
  const [apiProducts, setApiProducts] = useState<ProductWithVariants[] | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/products");
        if (!res.ok) {
          if (!cancelled) setApiProducts([]);
          return;
        }
        const data = (await res.json()) as unknown;
        if (!cancelled) {
          setApiProducts(
            Array.isArray(data)
              ? (data as ProductWithVariants[]).slice(0, SLICE)
              : [],
          );
        }
      } catch {
        if (!cancelled) setApiProducts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const useLive = apiProducts != null && apiProducts.length > 0;

  return (
    <section
      className={styles.section}
      aria-roledescription="carousel"
      aria-label="מוצרים מומלצים"
    >
      <div className={styles.inner}>
        <Swiper
          className={styles.swiper}
          modules={[Pagination, Navigation]}
          dir="rtl"
          slidesPerView={1}
          spaceBetween={SPACE_PX}
          navigation
          pagination={{ clickable: true }}
          breakpoints={{
            640: {
              slidesPerView: 2,
              spaceBetween: SPACE_PX,
            },
            1024: {
              slidesPerView: 3,
              spaceBetween: SPACE_PX,
            },
          }}
        >
          {useLive
            ? apiProducts!.map((product) => (
                <SwiperSlide key={product.id} className={styles.slide}>
                  <ProductCard product={product} />
                </SwiperSlide>
              ))
            : PRODUCT_CAROUSEL_PLACEHOLDERS.map((product) => (
                <SwiperSlide key={product.id} className={styles.slide}>
                  <ProductCarouselCard product={product} />
                </SwiperSlide>
              ))}
        </Swiper>
      </div>
    </section>
  );
}
