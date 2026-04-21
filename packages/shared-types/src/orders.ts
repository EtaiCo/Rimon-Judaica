export type OrderShippingMethod =
  | "home_delivery"
  | "self_pickup"
  | "pickup_point";

export type OrderStatus =
  | "pending"
  | "paid"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

/** Shipped in `shipping_address` JSONB for home_delivery / pickup_point. */
export type OrderShippingAddress = {
  street?: string;
  city?: string;
  houseNumber?: string;
  apartment?: string;
  zipCode?: string;
  notes?: string;
  /** Optional label for pickup point name / provider. */
  pickupPointName?: string;
};

/** API GET /api/orders */
export type OrderSummary = {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  status: OrderStatus;
  totalAmount: number;
  shippingMethod: OrderShippingMethod;
  trackingNumber?: string;
  refundedAt?: string;
  refundAmount?: number;
};

/** One line on an order (detail response). */
export type OrderDetailLine = {
  id: string;
  variantId: string;
  quantity: number;
  priceAtPurchase: number;
  lineTotal: number;
  variantName: string;
  sku: string;
  imageUrl?: string;
  productId: string;
  productName: string;
  productSlug: string;
};

/** API GET /api/orders/:id */
export type OrderDetail = {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  status: OrderStatus;
  totalAmount: number;
  shippingMethod: OrderShippingMethod;
  shippingAddress: OrderShippingAddress | null;
  items: OrderDetailLine[];
  trackingNumber?: string;
  shippedAt?: string;
  deliveredAt?: string;
  refundedAt?: string;
  refundAmount?: number;
  notes?: string;
};
