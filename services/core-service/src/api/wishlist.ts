import { Router, type Router as RouterType } from "express";
import type { WishlistLine } from "@rimon/shared-types";
import { getSupabaseAdmin } from "../config/supabase.js";
import { requireCustomerAuth } from "../middleware/auth.js";

const router: RouterType = Router();

router.get("/", requireCustomerAuth, async (req, res) => {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(503).json({ error: msg });
    return;
  }

  const customerId = req.customerId!;

  const { data: wishRows, error: wishErr } = await supabaseAdmin
    .from("wishlist")
    .select("id, variant_id, created_at")
    .eq("user_id", customerId)
    .order("created_at", { ascending: false });

  if (wishErr) {
    res.status(500).json({ error: wishErr.message });
    return;
  }

  const rows = wishRows ?? [];
  if (rows.length === 0) {
    res.json([] satisfies WishlistLine[]);
    return;
  }

  const variantIds = [...new Set(rows.map((r) => r.variant_id as string))];

  const { data: variantRows, error: varErr } = await supabaseAdmin
    .from("product_variants")
    .select(
      "id, product_id, variant_name, price, stock_quantity, sku, image_url",
    )
    .in("id", variantIds);

  if (varErr) {
    res.status(500).json({ error: varErr.message });
    return;
  }

  const variantMap = new Map(
    (variantRows ?? []).map((v) => [v.id as string, v]),
  );

  const productIds = [
    ...new Set((variantRows ?? []).map((v) => v.product_id as string)),
  ];

  const { data: productRows, error: prodErr } = await supabaseAdmin
    .from("products")
    .select("id, name, slug")
    .in("id", productIds);

  if (prodErr) {
    res.status(500).json({ error: prodErr.message });
    return;
  }

  const productMap = new Map(
    (productRows ?? []).map((p) => [p.id as string, p]),
  );

  const items: WishlistLine[] = [];
  for (const row of rows) {
    const vid = row.variant_id as string;
    const v = variantMap.get(vid);
    if (!v) continue;
    const p = productMap.get(v.product_id as string);
    if (!p) continue;

    items.push({
      id: row.id as string,
      variantId: vid,
      createdAt: row.created_at as string,
      variantName: v.variant_name as string,
      price: Number(v.price),
      stockQuantity: v.stock_quantity as number,
      sku: v.sku as string,
      imageUrl:
        v.image_url != null && String(v.image_url).trim() !== ""
          ? String(v.image_url).trim()
          : undefined,
      productId: v.product_id as string,
      productName: p.name as string,
      productSlug: p.slug as string,
    });
  }

  res.json(items);
});

router.post("/", requireCustomerAuth, async (req, res) => {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(503).json({ error: msg });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const variantRaw =
    typeof body.variantId === "string"
      ? body.variantId.trim()
      : typeof body.variant_id === "string"
        ? body.variant_id.trim()
        : "";
  if (!variantRaw) {
    res.status(400).json({ error: "חסר מזהה וריאנט." });
    return;
  }

  const customerId = req.customerId!;

  const { data: variantCheck, error: varCheckErr } = await supabaseAdmin
    .from("product_variants")
    .select("id")
    .eq("id", variantRaw)
    .maybeSingle();

  if (varCheckErr) {
    res.status(500).json({ error: varCheckErr.message });
    return;
  }
  if (!variantCheck) {
    res.status(404).json({ error: "המוצר לא נמצא." });
    return;
  }

  const { error: insertErr } = await supabaseAdmin.from("wishlist").insert({
    user_id: customerId,
    variant_id: variantRaw,
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      res.status(200).json({ ok: true });
      return;
    }
    res.status(500).json({ error: insertErr.message });
    return;
  }

  res.status(201).json({ ok: true });
});

router.delete("/:id", requireCustomerAuth, async (req, res) => {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(503).json({ error: msg });
    return;
  }

  const rowId = req.params.id?.trim();
  if (!rowId) {
    res.status(400).json({ error: "חסר מזהה." });
    return;
  }

  const customerId = req.customerId!;

  const { data: deleted, error: delErr } = await supabaseAdmin
    .from("wishlist")
    .delete()
    .eq("id", rowId)
    .eq("user_id", customerId)
    .select("id")
    .maybeSingle();

  if (delErr) {
    res.status(500).json({ error: delErr.message });
    return;
  }
  if (!deleted) {
    res.status(404).json({ error: "הפריט לא נמצא." });
    return;
  }

  res.status(204).send();
});

export default router;
