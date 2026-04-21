import { Router, type Router as RouterType } from "express";
import { z } from "zod";
import { getSupabaseAdmin } from "../../config/supabase.js";
import { validate } from "./validate.js";
import { logAdminAction } from "./audit.js";
import { requireIdempotencyKey, recordIdempotent } from "./idempotency.js";
import {
  productCreateBody,
  productUpdateBody,
  uuidParam,
  variantCreateBody,
  variantUpdateBody,
  stockAdjustBody,
} from "./schemas.js";

const router: RouterType = Router();

const productListQuery = z.object({
  q: z.string().trim().max(200).optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  categoryId: z.string().uuid().optional(),
  subCategoryId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

router.get(
  "/",
  validate({ query: productListQuery }),
  async (req, res, next) => {
    try {
      const q = req.query as unknown as {
        q?: string;
        isActive?: boolean;
        categoryId?: string;
        subCategoryId?: string;
        page: number;
        pageSize: number;
      };
      const supabase = getSupabaseAdmin();
      const from = (q.page - 1) * q.pageSize;
      const to = from + q.pageSize - 1;

      let query = supabase
        .from("products")
        .select(
          "id, category_id, sub_category_id, name, slug, description, images, is_active, seo_title, seo_description, created_at, updated_at, categories:category_id(id,name,slug), sub_categories:sub_category_id(id,name,slug)",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (q.q) {
        query = query.ilike("name", `%${q.q}%`);
      }
      if (typeof q.isActive === "boolean") {
        query = query.eq("is_active", q.isActive);
      }
      if (q.categoryId) {
        query = query.eq("category_id", q.categoryId);
      }
      if (q.subCategoryId) {
        query = query.eq("sub_category_id", q.subCategoryId);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      res.json({
        products: data ?? [],
        total: count ?? 0,
        page: q.page,
        pageSize: q.pageSize,
      });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/:id",
  validate({ params: uuidParam }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as { id: string };
      const supabase = getSupabaseAdmin();

      const { data: product, error } = await supabase
        .from("products")
        .select(
          "*, categories:category_id(id,name,slug), sub_categories:sub_category_id(id,name,slug)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!product) {
        res.status(404).json({ error: "המוצר לא נמצא." });
        return;
      }

      const { data: variants, error: varErr } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", id)
        .order("id");
      if (varErr) throw varErr;

      res.json({ product, variants: variants ?? [] });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/",
  validate({ body: productCreateBody }),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof productCreateBody>;
      const supabase = getSupabaseAdmin();

      const { data, error } = await supabase
        .from("products")
        .insert({
          category_id: body.categoryId,
          sub_category_id: body.subCategoryId ?? null,
          name: body.name,
          slug: body.slug,
          description: body.description,
          images: body.images,
          is_active: body.isActive,
          seo_title: body.seoTitle ?? null,
          seo_description: body.seoDescription ?? null,
        })
        .select("*")
        .single();
      if (error) {
        if (error.code === "23505") {
          res.status(409).json({ error: "המזהה (slug) כבר קיים." });
          return;
        }
        throw error;
      }

      await logAdminAction(req, {
        action: "product.create",
        targetType: "product",
        targetId: data.id as string,
        after: data as unknown as Record<string, unknown>,
      });
      res.status(201).json(data);
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/:id",
  validate({ params: uuidParam, body: productUpdateBody }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as { id: string };
      const body = req.body as z.infer<typeof productUpdateBody>;
      const supabase = getSupabaseAdmin();

      const { data: before, error: readErr } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (readErr) throw readErr;
      if (!before) {
        res.status(404).json({ error: "המוצר לא נמצא." });
        return;
      }

      const patch: Record<string, unknown> = {};
      if (body.categoryId !== undefined) patch.category_id = body.categoryId;
      if (body.subCategoryId !== undefined)
        patch.sub_category_id = body.subCategoryId ?? null;
      if (body.name !== undefined) patch.name = body.name;
      if (body.slug !== undefined) patch.slug = body.slug;
      if (body.description !== undefined) patch.description = body.description;
      if (body.images !== undefined) patch.images = body.images;
      if (body.isActive !== undefined) patch.is_active = body.isActive;
      if (body.seoTitle !== undefined) patch.seo_title = body.seoTitle ?? null;
      if (body.seoDescription !== undefined)
        patch.seo_description = body.seoDescription ?? null;

      if (Object.keys(patch).length === 0) {
        res.json(before);
        return;
      }

      const { data: after, error } = await supabase
        .from("products")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;

      await logAdminAction(req, {
        action: "product.update",
        targetType: "product",
        targetId: id,
        before: before as unknown as Record<string, unknown>,
        after: after as unknown as Record<string, unknown>,
      });
      res.json(after);
    } catch (e) {
      next(e);
    }
  },
);

/**
 * Delete behaviour: if the product has any order_items via its variants,
 * the `ON DELETE RESTRICT` on `order_items.variant_id` will block the
 * delete; we surface that as a soft-delete suggestion. Otherwise hard
 * delete cascades the variants.
 */
router.delete(
  "/:id",
  validate({ params: uuidParam }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as { id: string };
      const supabase = getSupabaseAdmin();

      const { data: variants } = await supabase
        .from("product_variants")
        .select("id")
        .eq("product_id", id);
      const variantIds = (variants ?? []).map((v) => v.id as string);

      let hasHistory = false;
      if (variantIds.length > 0) {
        const { count } = await supabase
          .from("order_items")
          .select("id", { count: "exact", head: true })
          .in("variant_id", variantIds);
        hasHistory = (count ?? 0) > 0;
      }

      if (hasHistory) {
        const { data: after, error } = await supabase
          .from("products")
          .update({ is_active: false })
          .eq("id", id)
          .select("*")
          .single();
        if (error) throw error;
        await logAdminAction(req, {
          action: "product.soft_delete",
          targetType: "product",
          targetId: id,
          after: after as unknown as Record<string, unknown>,
        });
        res.json({ softDeleted: true, product: after });
        return;
      }

      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;

      await logAdminAction(req, {
        action: "product.delete",
        targetType: "product",
        targetId: id,
      });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  },
);

// ── Variants ──────────────────────────────────────────────────────────

const variantsSub: RouterType = Router();

variantsSub.post(
  "/",
  validate({ body: variantCreateBody }),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof variantCreateBody>;
      const supabase = getSupabaseAdmin();

      const { data, error } = await supabase
        .from("product_variants")
        .insert({
          product_id: body.productId,
          variant_name: body.variantName,
          price: body.price,
          stock_quantity: body.stockQuantity,
          sku: body.sku,
          image_url: body.imageUrl ?? null,
          size: body.size ?? null,
          color: body.color ?? null,
          material: body.material ?? null,
          low_stock_threshold: body.lowStockThreshold,
          is_active: body.isActive,
        })
        .select("*")
        .single();
      if (error) {
        if (error.code === "23505") {
          res.status(409).json({ error: "SKU כבר קיים." });
          return;
        }
        throw error;
      }

      await logAdminAction(req, {
        action: "variant.create",
        targetType: "variant",
        targetId: data.id as string,
        after: data as unknown as Record<string, unknown>,
      });
      res.status(201).json(data);
    } catch (e) {
      next(e);
    }
  },
);

variantsSub.patch(
  "/:id",
  validate({ params: uuidParam, body: variantUpdateBody }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as { id: string };
      const body = req.body as z.infer<typeof variantUpdateBody>;
      const supabase = getSupabaseAdmin();

      const { data: before, error: readErr } = await supabase
        .from("product_variants")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (readErr) throw readErr;
      if (!before) {
        res.status(404).json({ error: "הואריאנט לא נמצא." });
        return;
      }

      const patch: Record<string, unknown> = {};
      if (body.variantName !== undefined) patch.variant_name = body.variantName;
      if (body.price !== undefined) patch.price = body.price;
      if (body.sku !== undefined) patch.sku = body.sku;
      if (body.imageUrl !== undefined) patch.image_url = body.imageUrl ?? null;
      if (body.size !== undefined) patch.size = body.size ?? null;
      if (body.color !== undefined) patch.color = body.color ?? null;
      if (body.material !== undefined) patch.material = body.material ?? null;
      if (body.lowStockThreshold !== undefined)
        patch.low_stock_threshold = body.lowStockThreshold;
      if (body.isActive !== undefined) patch.is_active = body.isActive;

      // Direct stock_quantity writes are blocked here — stock changes must
      // go through POST /variants/:id/stock which calls adjust_stock RPC.

      if (Object.keys(patch).length === 0) {
        res.json(before);
        return;
      }

      const { data: after, error } = await supabase
        .from("product_variants")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;

      await logAdminAction(req, {
        action: "variant.update",
        targetType: "variant",
        targetId: id,
        before: before as unknown as Record<string, unknown>,
        after: after as unknown as Record<string, unknown>,
      });
      res.json(after);
    } catch (e) {
      next(e);
    }
  },
);

variantsSub.delete(
  "/:id",
  validate({ params: uuidParam }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as { id: string };
      const supabase = getSupabaseAdmin();

      const { count } = await supabase
        .from("order_items")
        .select("id", { count: "exact", head: true })
        .eq("variant_id", id);

      if ((count ?? 0) > 0) {
        const { data: after, error } = await supabase
          .from("product_variants")
          .update({ is_active: false })
          .eq("id", id)
          .select("*")
          .single();
        if (error) throw error;
        await logAdminAction(req, {
          action: "variant.soft_delete",
          targetType: "variant",
          targetId: id,
          after: after as unknown as Record<string, unknown>,
        });
        res.json({ softDeleted: true, variant: after });
        return;
      }

      const { error } = await supabase
        .from("product_variants")
        .delete()
        .eq("id", id);
      if (error) throw error;

      await logAdminAction(req, {
        action: "variant.delete",
        targetType: "variant",
        targetId: id,
      });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  },
);

variantsSub.post(
  "/:id/stock",
  requireIdempotencyKey("adjust_stock"),
  validate({ params: uuidParam, body: stockAdjustBody }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as { id: string };
      const { delta, reason } = req.body as z.infer<typeof stockAdjustBody>;
      const supabase = getSupabaseAdmin();
      const key = (req as unknown as { idempotencyKey: string }).idempotencyKey;

      const { data, error } = await supabase.rpc("adjust_stock", {
        p_variant_id: id,
        p_delta: delta,
        p_reason: reason,
        p_admin_id: req.customer!.id,
        p_idempotency_key: key,
      });
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      const result = data as {
        ok: boolean;
        error?: string;
        new_stock?: number;
      };
      if (!result?.ok) {
        res.status(400).json(result ?? { error: "stock_error" });
        return;
      }

      await recordIdempotent(req, result as unknown as Record<string, unknown>);
      await logAdminAction(req, {
        action: "variant.stock_adjust",
        targetType: "variant",
        targetId: id,
        meta: { delta, reason, newStock: result.new_stock },
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

export { variantsSub as variantsRouter };
export default router;
