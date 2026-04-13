/**
 * Seeds wishlist rows and exactly 3 demo orders (distinct shipping + invoice #s)
 * for an existing customer.
 *
 * Env (from services/core-service/.env or process):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   SEED_CUSTOMER_EMAIL — required; must match a row in `customers`.
 *
 * Idempotency: if any order with invoice RJ-2026-001..003 exists, exits without
 * inserting orders (wishlist rows still attempted; duplicates ignored).
 *
 * Run from repo root: pnpm seed:wishlist-orders
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../services/core-service/.env") });

const INVOICES = ["RJ-2026-001", "RJ-2026-002", "RJ-2026-003"] as const;

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.SEED_CUSTOMER_EMAIL?.trim().toLowerCase();

  if (!url || !key) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  if (!email) {
    console.error("Set SEED_CUSTOMER_EMAIL to a registered customer email.");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: customer, error: cErr } = await supabase
    .from("customers")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (cErr) {
    console.error(cErr.message);
    process.exit(1);
  }
  if (!customer) {
    console.error(`No customer found for email: ${email}`);
    process.exit(1);
  }

  const userId = customer.id as string;

  const { data: existingOrders, error: exErr } = await supabase
    .from("orders")
    .select("invoice_number")
    .in("invoice_number", [...INVOICES]);

  if (exErr) {
    console.error(exErr.message);
    process.exit(1);
  }
  if (existingOrders && existingOrders.length > 0) {
    console.log(
      "Seed orders already present (invoice conflict). Skipping order inserts.",
    );
  }

  async function variantIdBySku(sku: string): Promise<string> {
    const { data, error } = await supabase
      .from("product_variants")
      .select("id")
      .eq("sku", sku)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Variant SKU not found: ${sku}`);
    return data.id as string;
  }

  const skuBez = await variantIdBySku("SID-YUK-MIZR-BEZ");
  const skuKis = await variantIdBySku("SID-KIS-SOFT-BRN");
  const skuTal = await variantIdBySku("TAL-PRM-50-WSLV");

  const wishInserts = [
    { user_id: userId, variant_id: skuBez },
    { user_id: userId, variant_id: skuKis },
    { user_id: userId, variant_id: skuTal },
  ];
  for (const row of wishInserts) {
    const { error } = await supabase.from("wishlist").insert(row);
    if (error && error.code !== "23505") {
      console.error("wishlist insert:", error.message);
      process.exit(1);
    }
  }
  console.log("Wishlist rows ensured (duplicates skipped).");

  if (existingOrders && existingOrders.length > 0) {
    process.exit(0);
  }

  const ordersPayload = [
    {
      user_id: userId,
      invoice_number: INVOICES[0],
      total_amount: 357.0,
      status: "delivered",
      shipping_method: "home_delivery" as const,
      shipping_address: {
        street: "הרצל",
        city: "תל אביב",
        houseNumber: "12",
        apartment: "4",
        zipCode: "6100001",
        notes: "לצלצל בדומופון",
      },
      items: [
        { variant_id: skuBez, quantity: 1, price_at_purchase: 179.0 },
        { variant_id: skuKis, quantity: 2, price_at_purchase: 89.0 },
      ],
    },
    {
      user_id: userId,
      invoice_number: INVOICES[1],
      total_amount: 449.0,
      status: "pending",
      shipping_method: "self_pickup" as const,
      shipping_address: null,
      items: [
        { variant_id: skuTal, quantity: 1, price_at_purchase: 449.0 },
      ],
    },
    {
      user_id: userId,
      invoice_number: INVOICES[2],
      total_amount: 268.0,
      status: "processing",
      shipping_method: "pickup_point" as const,
      shipping_address: {
        pickupPointName: "משלוחים — סניף רמת גן",
        street: "ביאליק",
        city: "רמת גן",
        houseNumber: "45",
        zipCode: "5245104",
        notes: "קוד איסוף יישלח ב-SMS",
      },
      items: [
        { variant_id: skuBez, quantity: 1, price_at_purchase: 179.0 },
        { variant_id: skuKis, quantity: 1, price_at_purchase: 89.0 },
      ],
    },
  ];

  for (const spec of ordersPayload) {
    const { items, ...orderRow } = spec;
    const { data: orderIns, error: oErr } = await supabase
      .from("orders")
      .insert(orderRow)
      .select("id")
      .single();

    if (oErr) {
      console.error("orders insert:", oErr.message);
      process.exit(1);
    }

    const orderId = orderIns.id as string;
    const lines = items.map((it) => ({
      order_id: orderId,
      variant_id: it.variant_id,
      quantity: it.quantity,
      price_at_purchase: it.price_at_purchase,
    }));

    const { error: iErr } = await supabase.from("order_items").insert(lines);
    if (iErr) {
      console.error("order_items insert:", iErr.message);
      process.exit(1);
    }
  }

  console.log("Inserted 3 orders with invoice numbers:", INVOICES.join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
