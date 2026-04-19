import { Router, type Router as RouterType } from "express";
import { getSupabaseAdmin } from "../config/supabase.js";
import type {
  Category,
  CategoryProduct,
  CategoryProductsResponse,
  SubCategory,
} from "@rimon/shared-types";

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

/** Builds parent categories with nested sub-categories from SQL rows. */
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

function mapCategoryProducts(
  products: { id: string; name: string; slug: string }[],
  variantRows:
    | {
        id: string;
        product_id: string;
        variant_name: string;
        price: number | string;
        stock_quantity: number;
        sku: string;
        image_url: string | null;
      }[]
    | null,
): CategoryProduct[] {
  const byProduct = new Map<string, NonNullable<typeof variantRows>>();
  for (const v of variantRows ?? []) {
    const pid = v.product_id as string;
    const list = byProduct.get(pid) ?? [];
    list.push(v);
    byProduct.set(pid, list);
  }

  return products.map((p) => {
    const raw = (byProduct.get(p.id) ?? []).sort((a, b) =>
      String(a.id).localeCompare(String(b.id)),
    );
    const variants = raw.map((v) => ({
      id: v.id as string,
      productId: p.id,
      variantName: v.variant_name as string,
      price: Number(v.price),
      stockQuantity: v.stock_quantity as number,
      sku: v.sku as string,
      imageUrl:
        v.image_url != null && String(v.image_url).trim() !== ""
          ? String(v.image_url).trim()
          : undefined,
    }));
    const first = variants[0];
    const prices = variants.map((x) => x.price);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const imageUrl = first?.imageUrl;
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      imageUrl,
      price: first?.price ?? minPrice,
      minPrice: variants.length > 0 ? minPrice : undefined,
      variants,
    };
  });
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

  const { data: categoryRows, error } = await supabaseAdmin
    .from("categories")
    .select("id, name, slug, parent_id, image_url")
    .is("parent_id", null)
    .order("name");

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const parentIds = (categoryRows ?? []).map((row) => row.id as string);
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

  const categories = mapParentCategoriesWithSubs(
    (categoryRows ?? []) as {
      id: string;
      name: string;
      slug: string;
      parent_id: string | null;
      image_url?: string | null;
    }[],
    subRows,
  );
  res.json(categories);
});

router.get("/:categorySlug/:subCategorySlug/products", async (req, res) => {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(503).json({ error: msg });
    return;
  }

  const categorySlug = req.params.categorySlug?.trim();
  const subCategorySlug = req.params.subCategorySlug?.trim();
  if (!categorySlug || !subCategorySlug) {
    res.status(400).json({ error: "Missing slug" });
    return;
  }

  const { data: catRows, error: catErr } = await supabaseAdmin
    .from("categories")
    .select("id, name, slug, parent_id")
    .eq("slug", categorySlug)
    .is("parent_id", null)
    .limit(1);

  if (catErr) {
    res.status(500).json({ error: catErr.message });
    return;
  }

  const categoryRow = catRows?.[0] as
    | { id: string; name: string; slug: string }
    | undefined;
  if (!categoryRow) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  const { data: subRows, error: subErr } = await supabaseAdmin
    .from("sub_categories")
    .select("id, name, slug, category_id")
    .eq("slug", subCategorySlug)
    .eq("category_id", categoryRow.id)
    .limit(1);

  if (subErr) {
    res.status(500).json({ error: subErr.message });
    return;
  }

  const subCategoryRow = subRows?.[0] as
    | { id: string; name: string; slug: string; category_id: string }
    | undefined;
  if (!subCategoryRow) {
    res.status(404).json({ error: "Sub-category not found" });
    return;
  }

  const { data: productRows, error: prodErr } = await supabaseAdmin
    .from("products")
    .select("id, name, slug")
    .eq("category_id", categoryRow.id)
    .eq("sub_category_id", subCategoryRow.id)
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
      subCategory: {
        id: subCategoryRow.id,
        name: subCategoryRow.name,
        slug: subCategoryRow.slug,
      },
      products: [],
    };
    res.json(body);
    return;
  }

  const { data: variantRows, error: varErr } = await supabaseAdmin
    .from("product_variants")
    .select(
      "id, product_id, variant_name, price, stock_quantity, sku, image_url",
    )
    .in("product_id", productIds);

  if (varErr) {
    res.status(500).json({ error: varErr.message });
    return;
  }

  const listProducts = mapCategoryProducts(products, variantRows);

  const body: CategoryProductsResponse = {
    category: {
      id: categoryRow.id,
      name: categoryRow.name,
      slug: categoryRow.slug,
    },
    subCategory: {
      id: subCategoryRow.id,
      name: subCategoryRow.name,
      slug: subCategoryRow.slug,
    },
    products: listProducts,
  };

  res.json(body);
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
    .select("id, name, slug, parent_id")
    .eq("slug", slug)
    .is("parent_id", null)
    .limit(1);

  if (catErr) {
    res.status(500).json({ error: catErr.message });
    return;
  }

  const categoryRow = catRows?.[0] as
    | { id: string; name: string; slug: string }
    | undefined;
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
    .select(
      "id, product_id, variant_name, price, stock_quantity, sku, image_url",
    )
    .in("product_id", productIds);

  if (varErr) {
    res.status(500).json({ error: varErr.message });
    return;
  }

  const listProducts = mapCategoryProducts(products, variantRows);

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
