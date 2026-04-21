import { Router, type Router as RouterType } from "express";
import type {
  BestSellerEntry,
  CustomerInsights,
  LowStockAlert,
  OrderStatus,
  SalesOverview,
} from "@rimon/shared-types";
import { getSupabaseAdmin } from "../../config/supabase.js";
import { validate } from "./validate.js";
import { analyticsRangeQuery, bestSellersQuery } from "./schemas.js";

const router: RouterType = Router();

function rangeDays(range: "7d" | "30d" | "90d"): number {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  return 90;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

router.get(
  "/overview",
  validate({ query: analyticsRangeQuery }),
  async (req, res, next) => {
    try {
      const { range } = req.query as unknown as { range: "7d" | "30d" | "90d" };
      const days = rangeDays(range);
      const since = new Date(Date.now() - days * 86_400_000);

      const supabase = getSupabaseAdmin();

      const [orderRes, customerRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, created_at, status, total_amount")
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: true }),
        supabase
          .from("customers")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since.toISOString()),
      ]);

      if (orderRes.error) throw orderRes.error;
      if (customerRes.error) throw customerRes.error;

      const rows = orderRes.data ?? [];
      const revenueRows = rows.filter(
        (r) => r.status !== "cancelled" && r.status !== "refunded",
      );

      const totalRevenue = revenueRows.reduce(
        (sum, r) => sum + Number(r.total_amount ?? 0),
        0,
      );
      const totalOrders = rows.length;
      const averageOrderValue =
        revenueRows.length > 0 ? totalRevenue / revenueRows.length : 0;

      const dailyMap = new Map<string, { revenue: number; orders: number }>();
      for (let i = 0; i < days; i++) {
        const d = new Date(Date.now() - i * 86_400_000);
        dailyMap.set(isoDate(d), { revenue: 0, orders: 0 });
      }
      for (const r of rows) {
        const key = String(r.created_at).slice(0, 10);
        const bucket = dailyMap.get(key);
        if (!bucket) continue;
        bucket.orders += 1;
        if (r.status !== "cancelled" && r.status !== "refunded") {
          bucket.revenue += Number(r.total_amount ?? 0);
        }
      }
      const daily = [...dailyMap.entries()]
        .map(([date, v]) => ({ date, revenue: v.revenue, orders: v.orders }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const statusCounts = new Map<OrderStatus, number>();
      for (const r of rows) {
        const s = r.status as OrderStatus;
        statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
      }
      const ordersByStatus = [...statusCounts.entries()].map(
        ([status, count]) => ({ status, count }),
      );

      const payload: SalesOverview = {
        range,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalOrders,
        averageOrderValue: Number(averageOrderValue.toFixed(2)),
        newCustomers: customerRes.count ?? 0,
        daily,
        ordersByStatus,
      };

      res.json(payload);
    } catch (e) {
      next(e);
    }
  },
);

router.get("/customers", async (_req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

    const [totalRes, newRes, activeRes] = await Promise.all([
      supabase.from("customers").select("id", { count: "exact", head: true }),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .gte("last_login", sevenDaysAgo),
    ]);

    if (totalRes.error) throw totalRes.error;
    if (newRes.error) throw newRes.error;
    if (activeRes.error) throw activeRes.error;

    const payload: CustomerInsights = {
      totalCustomers: totalRes.count ?? 0,
      newSignups7d: newRes.count ?? 0,
      activeLast7d: activeRes.count ?? 0,
    };
    res.json(payload);
  } catch (e) {
    next(e);
  }
});

router.get(
  "/bestsellers",
  validate({ query: bestSellersQuery }),
  async (req, res, next) => {
    try {
      const { limit } = req.query as unknown as { limit: number };
      const supabase = getSupabaseAdmin();

      const { data: itemRows, error } = await supabase
        .from("order_items")
        .select("variant_id, quantity, price_at_purchase");
      if (error) throw error;

      const variantTotals = new Map<string, { units: number; revenue: number }>();
      for (const r of itemRows ?? []) {
        const vid = r.variant_id as string;
        const units = Number(r.quantity ?? 0);
        const revenue = units * Number(r.price_at_purchase ?? 0);
        const prev = variantTotals.get(vid) ?? { units: 0, revenue: 0 };
        variantTotals.set(vid, {
          units: prev.units + units,
          revenue: prev.revenue + revenue,
        });
      }

      const variantIds = [...variantTotals.keys()];
      if (variantIds.length === 0) {
        res.json([]);
        return;
      }

      const { data: variantRows, error: varErr } = await supabase
        .from("product_variants")
        .select("id, product_id")
        .in("id", variantIds);
      if (varErr) throw varErr;

      const productTotals = new Map<
        string,
        { units: number; revenue: number }
      >();
      for (const v of variantRows ?? []) {
        const vtotal = variantTotals.get(v.id as string);
        if (!vtotal) continue;
        const pid = v.product_id as string;
        const prev = productTotals.get(pid) ?? { units: 0, revenue: 0 };
        productTotals.set(pid, {
          units: prev.units + vtotal.units,
          revenue: prev.revenue + vtotal.revenue,
        });
      }

      const productIds = [...productTotals.keys()];
      const { data: productRows, error: prodErr } = await supabase
        .from("products")
        .select("id, name")
        .in("id", productIds);
      if (prodErr) throw prodErr;

      const entries: BestSellerEntry[] = (productRows ?? [])
        .map((p) => {
          const t = productTotals.get(p.id as string)!;
          return {
            productId: p.id as string,
            productName: p.name as string,
            unitsSold: t.units,
            revenue: Number(t.revenue.toFixed(2)),
          };
        })
        .sort((a, b) => b.unitsSold - a.unitsSold)
        .slice(0, limit);

      res.json(entries);
    } catch (e) {
      next(e);
    }
  },
);

router.get("/low-stock", async (_req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data: variantRows, error } = await supabase
      .from("product_variants")
      .select(
        "id, product_id, variant_name, sku, stock_quantity, low_stock_threshold, is_active",
      )
      .eq("is_active", true);
    if (error) throw error;

    const flagged = (variantRows ?? []).filter(
      (v) =>
        typeof v.stock_quantity === "number" &&
        typeof v.low_stock_threshold === "number" &&
        v.stock_quantity <= v.low_stock_threshold,
    );

    const productIds = [
      ...new Set(flagged.map((v) => v.product_id as string)),
    ];
    if (productIds.length === 0) {
      res.json([]);
      return;
    }

    const { data: productRows, error: prodErr } = await supabase
      .from("products")
      .select("id, name")
      .in("id", productIds);
    if (prodErr) throw prodErr;

    const nameById = new Map(
      (productRows ?? []).map((p) => [p.id as string, p.name as string]),
    );

    const alerts: LowStockAlert[] = flagged.map((v) => ({
      variantId: v.id as string,
      productId: v.product_id as string,
      productName: nameById.get(v.product_id as string) ?? "",
      variantName: v.variant_name as string,
      sku: v.sku as string,
      stockQuantity: v.stock_quantity as number,
      lowStockThreshold: v.low_stock_threshold as number,
    }));

    res.json(alerts);
  } catch (e) {
    next(e);
  }
});

export default router;
