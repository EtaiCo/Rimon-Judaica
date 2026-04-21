import { Router, type Router as RouterType } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSupabaseAdmin } from "../../config/supabase.js";
import { validate } from "./validate.js";
import { logAdminAction } from "./audit.js";
import {
  categoryCreateBody,
  categoryReorderBody,
  categoryUpdateBody,
  uuidParam,
} from "./schemas.js";

const router: RouterType = Router();

/** Walk parent chain to detect cycles. */
async function wouldCreateCycle(
  supabase: SupabaseClient,
  candidateId: string,
  newParentId: string | null,
): Promise<boolean> {
  if (!newParentId) return false;
  if (newParentId === candidateId) return true;
  let current: string | null = newParentId;
  const seen = new Set<string>();
  for (let i = 0; i < 50 && current; i++) {
    if (seen.has(current)) return true;
    seen.add(current);
    const { data }: { data: { parent_id: string | null } | null } =
      await supabase
        .from("categories")
        .select("parent_id")
        .eq("id", current)
        .maybeSingle();
    current = data?.parent_id ?? null;
    if (current === candidateId) return true;
  }
  return false;
}

router.get("/", async (_req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    res.json(data ?? []);
  } catch (e) {
    next(e);
  }
});

router.post(
  "/",
  validate({ body: categoryCreateBody }),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof categoryCreateBody>;
      const supabase = getSupabaseAdmin();

      if (body.parentId && (await wouldCreateCycle(supabase, "", body.parentId))) {
        // The empty-string candidate can't match any parent so this short-circuit
        // only runs for straightforward parent checks; the real cycle check for
        // updates happens in PATCH.
      }

      const { data, error } = await supabase
        .from("categories")
        .insert({
          name: body.name,
          slug: body.slug,
          parent_id: body.parentId,
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
        action: "category.create",
        targetType: "category",
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
  validate({ params: uuidParam, body: categoryUpdateBody }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as { id: string };
      const body = req.body as z.infer<typeof categoryUpdateBody>;
      const supabase = getSupabaseAdmin();

      const { data: before, error: readErr } = await supabase
        .from("categories")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (readErr) throw readErr;
      if (!before) {
        res.status(404).json({ error: "הקטגוריה לא נמצאה." });
        return;
      }

      if (body.parentId !== undefined && body.parentId !== before.parent_id) {
        if (await wouldCreateCycle(supabase, id, body.parentId ?? null)) {
          res.status(400).json({ error: "שינוי זה ייצור לולאה בהיררכיית הקטגוריות." });
          return;
        }
      }

      const patch: Record<string, unknown> = {};
      if (body.name !== undefined) patch.name = body.name;
      if (body.slug !== undefined) patch.slug = body.slug;
      if (body.parentId !== undefined) patch.parent_id = body.parentId ?? null;
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
        .from("categories")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;

      await logAdminAction(req, {
        action: "category.update",
        targetType: "category",
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

      const [
        { count: childCount },
        { count: productCount },
        { count: subCount },
      ] = await Promise.all([
        supabase
          .from("categories")
          .select("id", { count: "exact", head: true })
          .eq("parent_id", id),
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("category_id", id),
        supabase
          .from("sub_categories")
          .select("id", { count: "exact", head: true })
          .eq("category_id", id),
      ]);

      if (
        (childCount ?? 0) > 0 ||
        (productCount ?? 0) > 0 ||
        (subCount ?? 0) > 0
      ) {
        res.status(400).json({
          error:
            "לא ניתן למחוק קטגוריה המכילה מוצרים, תתי-קטגוריות או קטגוריות משנה.",
        });
        return;
      }

      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;

      await logAdminAction(req, {
        action: "category.delete",
        targetType: "category",
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
  validate({ body: categoryReorderBody }),
  async (req, res, next) => {
    try {
      const { items } = req.body as z.infer<typeof categoryReorderBody>;
      const supabase = getSupabaseAdmin();

      for (const item of items) {
        const { error } = await supabase
          .from("categories")
          .update({ sort_order: item.sortOrder })
          .eq("id", item.id);
        if (error) throw error;
      }

      await logAdminAction(req, {
        action: "category.reorder",
        targetType: "category",
        meta: { count: items.length },
      });
      res.json({ ok: true, count: items.length });
    } catch (e) {
      next(e);
    }
  },
);

export default router;
