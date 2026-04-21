import { z } from "zod";
import { config } from "../../config/index.js";

export const uuidParam = z.object({ id: z.string().uuid() });

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const analyticsRangeQuery = z.object({
  range: z.enum(["7d", "30d", "90d"]).default("30d"),
});

export const bestSellersQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// ── Product / variant ─────────────────────────────────────────────────

const imageUrlSchema = z
  .string()
  .url()
  .max(500)
  .superRefine((value, ctx) => {
    const hosts = config.admin.allowedImageHosts;
    if (hosts.length === 0) {
      return;
    }
    let hostname = "";
    try {
      hostname = new URL(value).hostname.toLowerCase();
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "invalid_url",
      });
      return;
    }
    const allowed = hosts.some(
      (h) => hostname === h || hostname.endsWith(`.${h}`),
    );
    if (!allowed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "image_host_not_allowed",
      });
    }
  });

export const productCreateBody = z.object({
  categoryId: z.string().uuid(),
  subCategoryId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(2).max(200),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(5000).default(""),
  images: z.array(imageUrlSchema).max(20).default([]),
  isActive: z.boolean().default(true),
  seoTitle: z.string().max(200).optional(),
  seoDescription: z.string().max(500).optional(),
});

export const productUpdateBody = productCreateBody.partial();

export const variantCreateBody = z.object({
  productId: z.string().uuid(),
  variantName: z.string().trim().min(1).max(100),
  price: z.coerce.number().nonnegative().max(1_000_000),
  stockQuantity: z.coerce.number().int().min(0).max(1_000_000),
  sku: z.string().trim().min(1).max(64),
  imageUrl: imageUrlSchema.optional(),
  size: z.string().max(50).optional(),
  color: z.string().max(50).optional(),
  material: z.string().max(100).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).max(10000).default(5),
  isActive: z.boolean().default(true),
});

export const variantUpdateBody = variantCreateBody.partial();

export const stockAdjustBody = z.object({
  delta: z
    .number()
    .int()
    .refine((v) => v !== 0, { message: "delta_must_be_nonzero" }),
  reason: z.string().trim().max(200).default(""),
});

// ── Category ──────────────────────────────────────────────────────────

export const categoryCreateBody = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .regex(/^[a-z0-9-]+$/),
  parentId: z.string().uuid().nullable().default(null),
  imageUrl: imageUrlSchema.optional(),
  seoTitle: z.string().max(200).optional(),
  seoDescription: z.string().max(500).optional(),
  sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
});

export const categoryUpdateBody = categoryCreateBody.partial();

export const categoryReorderBody = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        sortOrder: z.coerce.number().int().min(0).max(100000),
      }),
    )
    .min(1)
    .max(500),
});

// ── Sub-categories ────────────────────────────────────────────────────

export const subCategoryListQuery = z.object({
  categoryId: z.string().uuid().optional(),
});

export const subCategoryCreateBody = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(200),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .regex(/^[a-z0-9-]+$/),
  imageUrl: imageUrlSchema.optional(),
  seoTitle: z.string().max(200).optional(),
  seoDescription: z.string().max(500).optional(),
  sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
});

export const subCategoryUpdateBody = subCategoryCreateBody.partial();

export const subCategoryReorderBody = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        sortOrder: z.coerce.number().int().min(0).max(100000),
      }),
    )
    .min(1)
    .max(500),
});

// ── Orders ────────────────────────────────────────────────────────────

export const orderListQuery = paginationQuery.extend({
  q: z.string().trim().max(200).optional(),
  status: z
    .enum([
      "pending",
      "paid",
      "preparing",
      "shipped",
      "delivered",
      "cancelled",
      "refunded",
    ])
    .optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const orderStatusBody = z.object({
  status: z.enum([
    "pending",
    "paid",
    "preparing",
    "shipped",
    "delivered",
    "cancelled",
  ]),
});

export const orderShippingBody = z.object({
  trackingNumber: z.string().trim().max(100).optional(),
  shippedAt: z.string().datetime().optional(),
  deliveredAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

export const refundBody = z.object({
  amount: z.coerce.number().nonnegative().max(1_000_000),
});

// ── Users ─────────────────────────────────────────────────────────────

export const userListQuery = paginationQuery.extend({
  q: z.string().trim().max(200).optional(),
  role: z.enum(["customer", "admin"]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
});

export const userStatusBody = z.object({
  status: z.enum(["active", "suspended"]),
});

export const userRoleBody = z.object({
  role: z.enum(["customer", "admin"]),
});

// ── Activity / security ───────────────────────────────────────────────

export const activityListQuery = paginationQuery.extend({
  action: z.string().trim().max(100).optional(),
  adminId: z.string().uuid().optional(),
});

export const securityListQuery = paginationQuery.extend({
  severity: z.enum(["info", "warn", "error", "critical"]).optional(),
  kind: z.string().trim().max(100).optional(),
});
