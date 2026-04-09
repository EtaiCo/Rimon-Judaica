import { Router, type Router as RouterType } from "express";
import { getSupabaseAdmin } from "../config/supabase.js";
import type {
  Category,
  CategoryProduct,
  CategoryProductsResponse,
} from "@rimon/shared-types";

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

  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("id, name, slug, parent_id, image_url")
    .order("name");

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const categories: Category[] = (data ?? []).map((row) => mapRow(row));

  const wantTree = req.query.tree === "true" || req.query.tree === "1";
  res.json(wantTree ? buildTree(categories) : categories);
});

router.get("/:slug/products", async (req, res) => {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(503).json({ error: msg });
    return;
  }

  const slug = req.params.slug?.trim();
  if (!slug) {
    res.status(400).json({ error: "Missing slug" });
    return;
  }

  const { data: catRows, error: catErr } = await supabaseAdmin
    .from("categories")
    .select("id, name, slug")
    .eq("slug", slug)
    .limit(1);

  if (catErr) {
    res.status(500).json({ error: catErr.message });
    return;
  }

  const categoryRow = catRows?.[0];
  if (!categoryRow) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  const { data: productRows, error: prodErr } = await supabaseAdmin
    .from("products")
    .select("id, name, slug")
    .eq("category_id", categoryRow.id)
    .order("name");

  if (prodErr) {
    res.status(500).json({ error: prodErr.message });
    return;
  }

  const products = productRows ?? [];
  const productIds = products.map((p) => p.id);

  if (productIds.length === 0) {
    const body: CategoryProductsResponse = {
      category: {
        id: categoryRow.id,
        name: categoryRow.name,
        slug: categoryRow.slug,
      },
      products: [],
    };
    res.json(body);
    return;
  }

  const { data: variantRows, error: varErr } = await supabaseAdmin
    .from("product_variants")
    .select("id, product_id, price, image_url")
    .in("product_id", productIds);

  if (varErr) {
    res.status(500).json({ error: varErr.message });
    return;
  }

  const byProduct = new Map<string, { id: string; price: number; image_url: string | null }[]>();
  for (const v of variantRows ?? []) {
    const list = byProduct.get(v.product_id) ?? [];
    list.push({
      id: v.id,
      price: Number(v.price),
      image_url: v.image_url,
    });
    byProduct.set(v.product_id, list);
  }

  const listProducts: CategoryProduct[] = products.map((p) => {
    const variants = (byProduct.get(p.id) ?? []).sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    const first = variants[0];
    const imageUrl =
      first?.image_url && String(first.image_url).trim() !== ""
        ? String(first.image_url).trim()
        : undefined;
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      imageUrl,
      price: first?.price ?? 0,
    };
  });

  const body: CategoryProductsResponse = {
    category: {
      id: categoryRow.id,
      name: categoryRow.name,
      slug: categoryRow.slug,
    },
    products: listProducts,
  };

  res.json(body);
});

export default router;
