import { Router, type Router as RouterType } from "express";
import { getSupabaseAdmin } from "../config/supabase.js";
import type { Category } from "@rimon/shared-types";

const router: RouterType = Router();

function buildTree(rows: Category[]): Category[] {
  const map = new Map<string, Category>();
  const roots: Category[] = [];

  for (const row of rows) {
    map.set(row.id, { ...row, children: [] });
  }

  for (const node of map.values()) {
    if (node.parentId) {
      const parent = map.get(node.parentId);
      parent?.children?.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function mapRow(row: {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  image_url?: string | null;
}): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parent_id,
    imageUrl: row.image_url ?? undefined,
  };
}

router.get("/", async (req, res) => {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(503).json({ error: msg });
    return;
  }

  const rawParent = req.query.parent;
  const explicitRootsOnly =
    rawParent === "null" ||
    (Array.isArray(rawParent) && rawParent[0] === "null");

  if (explicitRootsOnly) {
    const { data, error } = await supabaseAdmin
      .from("categories")
      .select("id, name, slug, parent_id, image_url")
      .is("parent_id", null)
      .order("name");

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const categories: Category[] = (data ?? []).map((row) => mapRow(row));
    res.json(categories);
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("id, name, slug, parent_id, image_url")
    .order("name");

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const categories: Category[] = (data ?? []).map((row) => mapRow(row));
  res.json(buildTree(categories));
});

export default router;
