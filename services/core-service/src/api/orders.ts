import { Router, type Router as RouterType } from "express";
import type {
  OrderDetail,
  OrderDetailLine,
  OrderShippingAddress,
  OrderShippingMethod,
  OrderSummary,
} from "@rimon/shared-types";
import { getSupabaseAdmin } from "../config/supabase.js";
import { requireCustomerAuth } from "../middleware/auth.js";

const router: RouterType = Router();

const SHIPPING_METHODS = new Set<OrderShippingMethod>([
  "home_delivery",
  "self_pickup",
  "pickup_point",
]);

function parseShippingMethod(raw: string): OrderShippingMethod | null {
  if (SHIPPING_METHODS.has(raw as OrderShippingMethod)) {
    return raw as OrderShippingMethod;
  }
  return null;
}

function parseShippingAddress(
  raw: unknown,
): OrderShippingAddress | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const pick = (k: string): string | undefined => {
    const v = o[k];
    return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
  };
  const out: OrderShippingAddress = {};
  const street = pick("street");
  const city = pick("city");
  const houseNumber = pick("houseNumber");
  const apartment = pick("apartment");
  const zipCode = pick("zipCode");
  const notes = pick("notes");
  const pickupPointName = pick("pickupPointName");
  if (street != null) out.street = street;
  if (city != null) out.city = city;
  if (houseNumber != null) out.houseNumber = houseNumber;
  if (apartment != null) out.apartment = apartment;
  if (zipCode != null) out.zipCode = zipCode;
  if (notes != null) out.notes = notes;
  if (pickupPointName != null) out.pickupPointName = pickupPointName;
  return Object.keys(out).length > 0 ? out : null;
}

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

  const { data: orderRows, error } = await supabaseAdmin
    .from("orders")
    .select(
      "id, invoice_number, created_at, status, total_amount, shipping_method",
    )
    .eq("user_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const list: OrderSummary[] = (orderRows ?? []).map((row) => {
    const sm = parseShippingMethod(String(row.shipping_method));
    return {
      id: row.id as string,
      invoiceNumber: row.invoice_number as string,
      createdAt: row.created_at as string,
      status: String(row.status),
      totalAmount: Number(row.total_amount),
      shippingMethod: sm ?? "home_delivery",
    };
  });

  res.json(list);
});

router.get("/:id", requireCustomerAuth, async (req, res) => {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(503).json({ error: msg });
    return;
  }

  const orderId = req.params.id?.trim();
  if (!orderId) {
    res.status(400).json({ error: "חסר מזהה הזמנה." });
    return;
  }

  const customerId = req.customerId!;

  const { data: orderRow, error: orderErr } = await supabaseAdmin
    .from("orders")
    .select(
      "id, invoice_number, created_at, status, total_amount, shipping_method, shipping_address",
    )
    .eq("id", orderId)
    .eq("user_id", customerId)
    .maybeSingle();

  if (orderErr) {
    res.status(500).json({ error: orderErr.message });
    return;
  }
  if (!orderRow) {
    res.status(404).json({ error: "ההזמנה לא נמצאה." });
    return;
  }

  const { data: itemRows, error: itemsErr } = await supabaseAdmin
    .from("order_items")
    .select("id, variant_id, quantity, price_at_purchase")
    .eq("order_id", orderId)
    .order("id", { ascending: true });

  if (itemsErr) {
    res.status(500).json({ error: itemsErr.message });
    return;
  }

  const lines = itemRows ?? [];
  const variantIds = [...new Set(lines.map((r) => r.variant_id as string))];

  let variantMap = new Map<string, Record<string, unknown>>();
  let productMap = new Map<string, Record<string, unknown>>();

  if (variantIds.length > 0) {
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

    variantMap = new Map(
      (variantRows ?? []).map((v) => [v.id as string, v as Record<string, unknown>]),
    );

    const productIds = [
      ...new Set(
        (variantRows ?? []).map((v) => v.product_id as string),
      ),
    ];

    if (productIds.length > 0) {
      const { data: productRows, error: prodErr } = await supabaseAdmin
        .from("products")
        .select("id, name, slug")
        .in("id", productIds);

      if (prodErr) {
        res.status(500).json({ error: prodErr.message });
        return;
      }

      productMap = new Map(
        (productRows ?? []).map((p) => [p.id as string, p as Record<string, unknown>]),
      );
    }
  }

  const sm = parseShippingMethod(String(orderRow.shipping_method));
  const items: OrderDetailLine[] = [];

  for (const row of lines) {
    const vid = row.variant_id as string;
    const v = variantMap.get(vid);
    if (!v) continue;
    const pid = v.product_id as string;
    const p = productMap.get(pid);
    if (!p) continue;

    const qty = row.quantity as number;
    const priceAt = Number(row.price_at_purchase);

    items.push({
      id: row.id as string,
      variantId: vid,
      quantity: qty,
      priceAtPurchase: priceAt,
      lineTotal: priceAt * qty,
      variantName: String(v.variant_name),
      sku: String(v.sku),
      imageUrl:
        v.image_url != null && String(v.image_url).trim() !== ""
          ? String(v.image_url).trim()
          : undefined,
      productId: pid,
      productName: String(p.name),
      productSlug: String(p.slug),
    });
  }

  const detail: OrderDetail = {
    id: orderRow.id as string,
    invoiceNumber: orderRow.invoice_number as string,
    createdAt: orderRow.created_at as string,
    status: String(orderRow.status),
    totalAmount: Number(orderRow.total_amount),
    shippingMethod: sm ?? "home_delivery",
    shippingAddress: parseShippingAddress(orderRow.shipping_address),
    items,
  };

  res.json(detail);
});

export default router;
