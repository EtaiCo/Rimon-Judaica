import { Router, type Router as RouterType } from "express";
import type {
  AddCartItemRpcResult,
  CartLine,
  CartMutationRpcResult,
} from "@rimon/shared-types";
import { getSupabaseAdmin } from "../config/supabase.js";
import { requireCustomerAuth } from "../middleware/auth.js";

const router: RouterType = Router();

const OUT_OF_STOCK_HE = "מצטערים, המלאי אזל";

router.post("/add", requireCustomerAuth, async (req, res) => {
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

  let qty = 1;
  if (body.quantity != null) {
    const n =
      typeof body.quantity === "number"
        ? body.quantity
        : Number(body.quantity);
    if (!Number.isFinite(n) || n < 1 || Math.floor(n) !== n) {
      res.status(400).json({ error: "כמות לא תקינה." });
      return;
    }
    qty = n;
  }

  const customerId = req.customerId!;

  const { data, error } = await supabaseAdmin.rpc("add_cart_item", {
    p_user_id: customerId,
    p_variant_id: variantRaw,
    p_quantity: qty,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const result = data as AddCartItemRpcResult | null;
  if (!result || typeof result !== "object") {
    res.status(500).json({ error: "תגובת מסד הנתונים אינה תקינה." });
    return;
  }

  if (!result.ok) {
    if (result.error === "out_of_stock") {
      res.status(409).json({ error: OUT_OF_STOCK_HE });
      return;
    }
    if (result.error === "variant_not_found") {
      res.status(404).json({ error: "המוצר לא נמצא." });
      return;
    }
    if (result.error === "invalid_quantity") {
      res.status(400).json({ error: "כמות לא תקינה." });
      return;
    }
    res.status(400).json({ error: OUT_OF_STOCK_HE });
    return;
  }

  res.status(201).json({ ok: true });
});

router.get("/", requireCustomerAuth, async (req, res) => {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(503).json({ error: msg });
    return;
  }

  const { error: releaseErr } = await supabaseAdmin.rpc(
    "check_and_release_stock",
  );
  if (releaseErr) {
    res.status(500).json({ error: releaseErr.message });
    return;
  }

  const customerId = req.customerId!;

  const { data: cartRows, error: cartErr } = await supabaseAdmin
    .from("cart_items")
    .select("id, variant_id, quantity, created_at, expires_at")
    .eq("user_id", customerId)
    .order("created_at", { ascending: true });

  if (cartErr) {
    res.status(500).json({ error: cartErr.message });
    return;
  }

  const rows = cartRows ?? [];
  if (rows.length === 0) {
    res.json([] satisfies CartLine[]);
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
    ...new Set(
      (variantRows ?? []).map((v) => v.product_id as string),
    ),
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

  const items: CartLine[] = [];
  for (const row of rows) {
    const vid = row.variant_id as string;
    const v = variantMap.get(vid);
    if (!v) continue;
    const p = productMap.get(v.product_id as string);
    if (!p) continue;

    items.push({
      id: row.id as string,
      variantId: vid,
      quantity: row.quantity as number,
      createdAt: row.created_at as string,
      expiresAt: row.expires_at as string,
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

router.patch("/line/:id", requireCustomerAuth, async (req, res) => {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(503).json({ error: msg });
    return;
  }

  const lineId = req.params.id?.trim();
  if (!lineId) {
    res.status(400).json({ error: "חסר מזהה שורה." });
    return;
  }

  const body = req.body as Record<string, unknown>;
  let amount = 1;
  if (body.amount != null) {
    const n =
      typeof body.amount === "number" ? body.amount : Number(body.amount);
    if (!Number.isFinite(n) || n < 1 || Math.floor(n) !== n) {
      res.status(400).json({ error: "כמות לא תקינה." });
      return;
    }
    amount = n;
  }

  const customerId = req.customerId!;

  const { data, error } = await supabaseAdmin.rpc("decrement_cart_item", {
    p_user_id: customerId,
    p_cart_item_id: lineId,
    p_amount: amount,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const result = data as CartMutationRpcResult | null;
  if (!result || typeof result !== "object") {
    res.status(500).json({ error: "תגובת מסד הנתונים אינה תקינה." });
    return;
  }

  if (!result.ok) {
    if (result.error === "not_found") {
      res.status(404).json({ error: "הפריט לא נמצא בעגלה." });
      return;
    }
    if (result.error === "invalid_quantity") {
      res.status(400).json({ error: "כמות לא תקינה." });
      return;
    }
    res.status(400).json({ error: "לא ניתן לעדכן את העגלה." });
    return;
  }

  res.json({ ok: true });
});

router.delete("/line/:id", requireCustomerAuth, async (req, res) => {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(503).json({ error: msg });
    return;
  }

  const lineId = req.params.id?.trim();
  if (!lineId) {
    res.status(400).json({ error: "חסר מזהה שורה." });
    return;
  }

  const customerId = req.customerId!;

  const { data, error } = await supabaseAdmin.rpc("remove_cart_item", {
    p_user_id: customerId,
    p_cart_item_id: lineId,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const result = data as CartMutationRpcResult | null;
  if (!result || typeof result !== "object") {
    res.status(500).json({ error: "תגובת מסד הנתונים אינה תקינה." });
    return;
  }

  if (!result.ok) {
    if (result.error === "not_found") {
      res.status(404).json({ error: "הפריט לא נמצא בעגלה." });
      return;
    }
    res.status(400).json({ error: "לא ניתן להסיר את הפריט." });
    return;
  }

  res.json({ ok: true });
});

export default router;
