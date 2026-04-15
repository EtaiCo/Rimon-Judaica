import { useCallback } from "react";
import { Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import type { ProductWithVariants } from "@rimon/shared-types";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { PRODUCT_CAROUSEL_PLACEHOLDERS } from "../../data/productCarouselPlaceholders";
import { ProductCard } from "../ProductCard/ProductCard";
import { ProductCarouselCard } from "../ProductCarouselCard/ProductCarouselCard";
import { CACHE_KEYS } from "../../lib/cacheService";
import { useStaleWhileRevalidate } from "../../hooks/useStaleWhileRevalidate";
import styles from "./PromoCarousel.module.css";

const SPACE_PX = 24;
const SLICE = 12;

const CACHE_KEY = CACHE_KEYS.featuredProducts();

function fetchFeatured(): Promise<ProductWithVariants[] | null> {
  return fetch("/api/products")
    .then(async (res) => {
      if (!res.ok) return [];
      const data = (await res.json()) as unknown;
      return Array.isArray(data)
        ? (data as ProductWithVariants[]).slice(0, SLICE)
        : [];
    })
    .catch(() => [] as ProductWithVariants[]);
}

export function PromoCarousel() {
  const fetcher = useCallback(fetchFeatured, []);
  const { data: apiProducts } = useStaleWhileRevalidate<ProductWithVariants[]>(
    CACHE_KEY,
    fetcher,
  );

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
