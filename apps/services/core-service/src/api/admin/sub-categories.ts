import { Router, type Router as RouterType } from "express";
import { z } from "zod";
import { getSupabaseAdmin } from "../../config/supabase.js";
import { validate } from "./validate.js";
import { logAdminAction } from "./audit.js";
import {
  subCategoryCreateBody,
  subCategoryListQuery,
  subCategoryReorderBody,
  subCategoryUpdateBody,
  uuidParam,
} from "./schemas.js";

const router: RouterType = Router();

router.get(
  "/",
  validate({ query: subCategoryListQuery }),
  async (req, res, next) => {
    try {
      const q = req.query as unknown as z.infer<typeof subCategoryListQuery>;
      const supabase = getSupabaseAdmin();

      let query = supabase
        .from("sub_categories")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (q.categoryId) {
        query = query.eq("category_id", q.categoryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      res.json(data ?? []);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/",
  validate({ body: subCategoryCreateBody }),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof subCategoryCreateBody>;
      const supabase = getSupabaseAdmin();

      const { data: parent, error: parentErr } = await supabase
        .from("categories")
        .select("id")
        .eq("id", body.categoryId)
        .maybeSingle();
      if (parentErr) throw parentErr;
      if (!parent) {
        res.status(400).json({ error: "קטגוריית האב לא נמצאה." });
        return;
      }

      const { data, error } = await supabase
        .from("sub_categories")
        .insert({
          category_id: body.categoryId,
          name: body.name,
          slug: body.slug,
          image_url: body.imageUrl ?? null,
          seo_title: body.seoTitle ?? null,
          seo_description: body.seoDescription ?? null,
          sort_order: body.sortOrder,
        })
        .select("*")
        .single();
      if (error) {
        if (error.code === "23505") {
          res.status(409).json({ error: "slug כבר קיים." });
          return;
        }
        throw error;
      }

      await logAdminAction(req, {
        action: "sub_category.create",
        targetType: "sub_category",
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
  validate({ params: uuidParam, body: subCategoryUpdateBody }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as { id: string };
      const body = req.body as z.infer<typeof subCategoryUpdateBody>;
      const supabase = getSupabaseAdmin();

      const { data: before, error: readErr } = await supabase
        .from("sub_categories")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (readErr) throw readErr;
      if (!before) {
        res.status(404).json({ error: "תת-הקטגוריה לא נמצאה." });
        return;
      }

      if (body.categoryId !== undefined && body.categoryId !== before.category_id) {
        const { data: parent, error: parentErr } = await supabase
          .from("categories")
          .select("id")
          .eq("id", body.categoryId)
          .maybeSingle();
        if (parentErr) throw parentErr;
        if (!parent) {
          res.status(400).json({ error: "קטגוריית האב לא נמצאה." });
          return;
        }
      }

      const patch: Record<string, unknown> = {};
      if (body.categoryId !== undefined) patch.category_id = body.categoryId;
      if (body.name !== undefined) patch.name = body.name;
      if (body.slug !== undefined) patch.slug = body.slug;
      if (body.imageUrl !== undefined) patch.image_url = body.imageUrl ?? null;
      if (body.seoTitle !== undefined) patch.seo_title = body.seoTitle ?? null;
      if (body.seoDescription !== undefined)
        patch.seo_description = body.seoDescription ?? null;
      if (body.sortOrder !== undefined) patch.sort_order = body.sortOrder;

      if (Object.keys(patch).length === 0) {
        res.json(before);
        return;
      }

      const { data: after, error } = await supabase
        .from("sub_categories")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) {
        if (error.code === "23505") {
          res.status(409).json({ error: "slug כבר קיים." });
          return;
        }
        throw error;
      }

      await logAdminAction(req, {
        action: "sub_category.update",
        targetType: "sub_category",
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

router.delete(
  "/:id",
  validate({ params: uuidParam }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as { id: string };
      const supabase = getSupabaseAdmin();

      const { count } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("sub_category_id", id);

      if ((count ?? 0) > 0) {
        res.status(400).json({
          error: "לא ניתן למחוק תת-קטגוריה המכילה מוצרים.",
        });
        return;
      }

      const { error } = await supabase
        .from("sub_categories")
        .delete()
        .eq("id", id);
      if (error) throw error;

      await logAdminAction(req, {
        action: "sub_category.delete",
        targetType: "sub_category",
        targetId: id,
      });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/reorder",
  validate({ body: subCategoryReorderBody }),
  async (req, res, next) => {
    try {
      const { items } = req.body as z.infer<typeof subCategoryReorderBody>;
      const supabase = getSupabaseAdmin();

      for (const item of items) {
        const { error } = await supabase
          .from("sub_categories")
          .update({ sort_order: item.sortOrder })
          .eq("id", item.id);
        if (error) throw error;
      }

      await logAdminAction(req, {
        action: "sub_category.reorder",
        targetType: "sub_category",
        meta: { count: items.length },
      });
      res.json({ ok: true, count: items.length });
    } catch (e) {
      next(e);
    }
  },
);

export default router;
