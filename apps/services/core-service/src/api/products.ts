import { Router, type Router as RouterType } from "express";
import { getSupabaseAdmin } from "../config/supabase.js";
import type { ProductWithVariants, ProductVariant } from "@rimon/shared-types";

const router: RouterType = Router();

function mapVariant(v: {
  id: string;
  product_id: string;
  variant_name: string;
  price: unknown;
  stock_quantity: number;
  sku: string;
  image_url?: string | null;
}): ProductVariant {
  return {
    id: v.id,
    productId: v.product_id,
    variantName: v.variant_name,
    price: Number(v.price),
    stockQuantity: v.stock_quantity,
    sku: v.sku,
    imageUrl:
      v.image_url != null && String(v.image_url).trim() !== ""
        ? String(v.image_url).trim()
        : undefined,
  };
}

router.get("/", async (_req, res) => {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(503).json({ error: msg });
    return;
  }

  const { data: productRows, error: prodErr } = await supabaseAdmin
    .from("products")
    .select("id, category_id, name, slug, description, created_at")
    .order("created_at", { ascending: false });

  if (prodErr) {
    res.status(500).json({ error: prodErr.message });
    return;
  }

  const productIds = (productRows ?? []).map((p) => p.id);

  const { data: variantRows, error: varErr } = await supabaseAdmin
    .from("product_variants")
    .select("id, product_id, variant_name, price, stock_quantity, sku, image_url")
    .in("product_id", productIds);

  if (varErr) {
    res.status(500).json({ error: varErr.message });
    return;
  }

  const variantsByProduct = new Map<string, ProductVariant[]>();
  for (const v of variantRows ?? []) {
    const variant = mapVariant(v);
    const list = variantsByProduct.get(variant.productId) ?? [];
    list.push(variant);
    variantsByProduct.set(variant.productId, list);
  }

  const products: ProductWithVariants[] = (productRows ?? []).map((p) => {
    const variants = (variantsByProduct.get(p.id) ?? []).sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    const prices = variants.map((v) => v.price);
    return {
      id: p.id,
      categoryId: p.category_id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      createdAt: p.created_at,
      variants,
      minPrice: prices.length > 0 ? Math.min(...prices) : undefined,
    };
  });

  res.json(products);
});

router.get("/:id", async (req, res) => {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(503).json({ error: msg });
    return;
  }

  const id = req.params.id?.trim();
  if (!id) {
    res.status(400).json({ error: "Missing product id" });
    return;
  }

  const { data: productRow, error: prodErr } = await supabaseAdmin
    .from("products")
    .select("id, category_id, name, slug, description, created_at")
    .eq("id", id)
    .maybeSingle();

  if (prodErr) {
    res.status(500).json({ error: prodErr.message });
    return;
  }

  if (!productRow) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const { data: variantRows, error: varErr } = await supabaseAdmin
    .from("product_variants")
    .select("id, product_id, variant_name, price, stock_quantity, sku, image_url")
    .eq("product_id", id)
    .order("id");

  if (varErr) {
    res.status(500).json({ error: varErr.message });
    return;
  }

  const variants = (variantRows ?? []).map((v) => mapVariant(v));
  const prices = variants.map((v) => v.price);

  const product: ProductWithVariants = {
    id: productRow.id,
    categoryId: productRow.category_id,
    name: productRow.name,
    slug: productRow.slug,
    description: productRow.description ?? "",
    createdAt: productRow.created_at,
    variants,
    minPrice: prices.length > 0 ? Math.min(...prices) : undefined,
  };

  res.json(product);
});

export default router;
