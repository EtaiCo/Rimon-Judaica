import type { CustomerRole, CustomerStatus } from "./customer";
import type { OrderStatus, OrderShippingMethod } from "./orders";

/** Aggregated KPI numbers on the dashboard overview card grid. */
export type SalesOverview = {
  range: "7d" | "30d" | "90d";
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  newCustomers: number;
  /** Daily series for the chart. ISO date (YYYY-MM-DD) → metric. */
  daily: Array<{
    date: string;
    revenue: number;
    orders: number;
  }>;
  ordersByStatus: Array<{
    status: OrderStatus;
    count: number;
  }>;
};

export type CustomerInsights = {
  totalCustomers: number;
  newSignups7d: number;
  activeLast7d: number;
};

export type BestSellerEntry = {
  productId: string;
  productName: string;
  unitsSold: number;
  revenue: number;
};

export type LowStockAlert = {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  stockQuantity: number;
  lowStockThreshold: number;
};

export type AdminUserSummary = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: CustomerRole;
  status: CustomerStatus;
  createdAt: string;
  lastLogin?: string;
  totalSpend: number;
  ordersCount: number;
};

export type AdminUserDetail = AdminUserSummary & {
  recentOrders: Array<{
    id: string;
    invoiceNumber: string;
    createdAt: string;
    status: OrderStatus;
    totalAmount: number;
  }>;
};

export type AdminOrderSummary = {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  status: OrderStatus;
  totalAmount: number;
  shippingMethod: OrderShippingMethod;
  customerId: string;
  customerEmail: string;
  customerName: string;
  trackingNumber?: string;
};

export type AdminOrderListResponse = {
  orders: AdminOrderSummary[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminActivityEntry = {
  id: string;
  adminId: string;
  adminEmail?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  diff?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  createdAt: string;
};

export type SecurityEvent = {
  id: string;
  kind: string;
  severity: "info" | "warn" | "error" | "critical";
  customerId?: string;
  meta?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  createdAt: string;
};

export type AuditDiff = {
  [field: string]: { from: unknown; to: unknown };
};

/** GET /api/admin/me */
export type AdminMeResponse = {
  id: string;
  fullName: string;
  email: string;
  role: CustomerRole;
  status: CustomerStatus;
};
