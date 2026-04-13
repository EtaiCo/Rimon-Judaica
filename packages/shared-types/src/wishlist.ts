/** One wishlist row after joins (API GET /api/wishlist). */
export interface WishlistLine {
  id: string;
  variantId: string;
  createdAt: string;
  variantName: string;
  price: number;
  stockQuantity: number;
  sku: string;
  imageUrl?: string;
  productId: string;
  productName: string;
  productSlug: string;
}
