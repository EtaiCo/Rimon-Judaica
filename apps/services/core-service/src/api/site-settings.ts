import { Router, type Router as RouterType } from "express";
import { getSupabaseAdmin } from "../config/supabase.js";
import type { Category, SubCategory, BootstrapPayload } from "@rimon/shared-types";

const router: RouterType = Router();

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

function mapParentCategoriesWithSubs(
  categoryRows: {
    id: string;
    name: string;
    slug: string;
    parent_id: string | null;
    image_url?: string | null;
  }[],
  subCategoryRows: {
    id: string;
    category_id: string;
    name: string;
    slug: string;
    created_at: string;
  }[],
): Category[] {
  const byCategory = new Map<string, SubCategory[]>();
  for (const row of subCategoryRows) {
    const list = byCategory.get(row.category_id) ?? [];
    list.push({
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      slug: row.slug,
      createdAt: row.created_at,
    });
    byCategory.set(row.category_id, list);
  }

  return categoryRows.map((row) => ({
    ...mapRow(row),
    subCategories: (byCategory.get(row.id) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  }));
}

function normalizeSettingUrl(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const withoutAngles = trimmed.replace(/^<(.+)>$/, "$1").trim();
  const withoutQuotes = withoutAngles
    .replace(/^"(.+)"$/, "$1")
    .replace(/^'(.+)'$/, "$1")
    .trim();

  return withoutQuotes || undefined;
}

router.get("/home", async (_req, res) => {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(503).json({ error: msg });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("site_settings")
    .select("key, value")
    .in("key", ["hero_home_url", "site_logo_url"]);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const settings = new Map<string, string | undefined>();
  for (const row of data ?? []) {
    settings.set(String(row.key), normalizeSettingUrl(row.value));
  }

  res.json({
    hero: {
      imageUrl: settings.get("hero_home_url"),
    },
    logo: {
      imageUrl: settings.get("site_logo_url"),
    },
  });
});

router.get("/bootstrap", async (_req, res) => {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(503).json({ error: msg });
    return;
  }

  const [settingsResult, categoriesResult] = await Promise.all([
    supabaseAdmin
      .from("site_settings")
      .select("key, value")
      .in("key", ["hero_home_url", "site_logo_url"]),
    supabaseAdmin
      .from("categories")
      .select("id, name, slug, parent_id, image_url")
      .is("parent_id", null)
      .order("name"),
  ]);

  if (settingsResult.error) {
    res.status(500).json({ error: settingsResult.error.message });
    return;
  }

  if (categoriesResult.error) {
    res.status(500).json({ error: categoriesResult.error.message });
    return;
  }

  const parentRows = (categoriesResult.data ?? []) as {
    id: string;
    name: string;
    slug: string;
    parent_id: string | null;
    image_url?: string | null;
  }[];
  const parentIds = parentRows.map((row) => row.id);

  let subRows: {
    id: string;
    category_id: string;
    name: string;
    slug: string;
    created_at: string;
  }[] = [];

  if (parentIds.length > 0) {
    const { data: nestedRows, error: subErr } = await supabaseAdmin
      .from("sub_categories")
      .select("id, category_id, name, slug, created_at")
      .in("category_id", parentIds)
      .order("name");

    if (subErr) {
      res.status(500).json({ error: subErr.message });
      return;
    }

    subRows = (nestedRows ?? []) as typeof subRows;
  }

  const settings = new Map<string, string | undefined>();
  for (const row of settingsResult.data ?? []) {
    settings.set(String(row.key), normalizeSettingUrl(row.value));
  }

  const payload: BootstrapPayload = {
    hero: {
      imageUrl: settings.get("hero_home_url"),
    },
    logo: {
      imageUrl: settings.get("site_logo_url"),
    },
    categories: mapParentCategoriesWithSubs(parentRows, subRows),
  };

  res.json(payload);
});

export default router;
