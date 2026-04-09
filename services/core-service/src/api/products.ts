import { Router, type Router as RouterType } from "express";
import { getSupabaseAdmin } from "../config/supabase.js";
import type { ProductWithVariants, ProductVariant } from "@rimon/shared-types";

const router: RouterType = Router();

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
    .select("id, category_id, name, slug, description, image_url, created_at")
    .order("created_at", { ascending: false });

  if (prodErr) {
    res.status(500).json({ error: prodErr.message });
    return;
  }

  const productIds = (productRows ?? []).map((p) => p.id);

  const { data: variantRows, error: varErr } = await supabaseAdmin
    .from("product_variants")
    .select("id, product_id, variant_name, price, stock_quantity, sku")
    .in("product_id", productIds);

  if (varErr) {
    res.status(500).json({ error: varErr.message });
    return;
  }

  const variantsByProduct = new Map<string, ProductVariant[]>();
  for (const v of variantRows ?? []) {
    const variant: ProductVariant = {
      id: v.id,
      productId: v.product_id,
      variantName: v.variant_name,
      price: Number(v.price),
      stockQuantity: v.stock_quantity,
      sku: v.sku,
    };
    const list = variantsByProduct.get(variant.productId) ?? [];
    list.push(variant);
    variantsByProduct.set(variant.productId, list);
  }

  const products: ProductWithVariants[] = (productRows ?? []).map((p) => {
    const variants = variantsByProduct.get(p.id) ?? [];
    const prices = variants.map((v) => v.price);
    return {
      id: p.id,
      categoryId: p.category_id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      imageUrl: p.image_url,
      createdAt: p.created_at,
      variants,
      minPrice: prices.length > 0 ? Math.min(...prices) : undefined,
    };
  });

  res.json(products);
});

export default router;
