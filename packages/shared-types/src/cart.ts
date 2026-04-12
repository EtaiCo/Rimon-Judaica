/** One line in the cart after joins (API GET /api/cart). */
export interface CartLine {
  id: string;
  variantId: string;
  quantity: number;
  createdAt: string;
  expiresAt: string;
  variantName: string;
  price: number;
  /** Shelves stock after reservations; may be 0 while item is still in cart. */
  stockQuantity: number;
  sku: string;
  imageUrl?: string;
  productId: string;
  productName: string;
  productSlug: string;
}

/** Result shape from Postgres RPC `add_cart_item`. */
export interface AddCartItemRpcResult {
  ok: boolean;
  error?: string;
}

/** `remove_cart_item` / `decrement_cart_item` RPC responses. */
export interface CartMutationRpcResult {
  ok: boolean;
  error?: string;
}
