import { Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { PRODUCT_CAROUSEL_PLACEHOLDERS } from "../../data/productCarouselPlaceholders";
import { ProductCarouselCard } from "../ProductCarouselCard/ProductCarouselCard";
import styles from "./PromoCarousel.module.css";

const SPACE_PX = 24;

export function PromoCarousel() {
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
          {PRODUCT_CAROUSEL_PLACEHOLDERS.map((product) => (
            <SwiperSlide key={product.id} className={styles.slide}>
              <ProductCarouselCard product={product} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
