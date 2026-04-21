import { Router, type Router as RouterType } from "express";
import type { OrderStatus } from "@rimon/shared-types";
import { z } from "zod";
import { getSupabaseAdmin } from "../../config/supabase.js";
import { validate } from "./validate.js";
import { logAdminAction } from "./audit.js";
import { requireIdempotencyKey, recordIdempotent } from "./idempotency.js";
import { requireSudo } from "./sudo.js";
import { sensitiveLimiter } from "../../middleware/rateLimit.js";
import {
  orderListQuery,
  orderShippingBody,
  orderStatusBody,
  refundBody,
  uuidParam,
} from "./schemas.js";

const router: RouterType = Router();

/**
 * Allowed status transitions. `refunded` is only reachable via the
 * refund endpoint (not a direct status PATCH).
 */
const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["paid", "cancelled"],
  paid: ["preparing", "cancelled"],
  preparing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
  refunded: [],
};

router.get(
  "/",
  validate({ query: orderListQuery }),
  async (req, res, next) => {
    try {
      const q = req.query as unknown as z.infer<typeof orderListQuery>;
      const supabase = getSupabaseAdmin();
      const from = (q.page - 1) * q.pageSize;
      const to = from + q.pageSize - 1;

      let query = supabase
        .from("orders")
        .select(
          "id, invoice_number, user_id, status, total_amount, shipping_method, tracking_number, created_at, customers!inner(id,email,full_name)",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (q.status) query = query.eq("status", q.status);
      if (q.from) query = query.gte("created_at", q.from);
      if (q.to) query = query.lte("created_at", q.to);
      if (q.q) query = query.ilike("invoice_number", `%${q.q}%`);

      const { data, count, error } = await query;
      if (error) throw error;

      const orders = (data ?? []).map((row: any) => ({
        id: row.id,
        invoiceNumber: row.invoice_number,
        createdAt: row.created_at,
        status: row.status,
        totalAmount: Number(row.total_amount),
        shippingMethod: row.shipping_method,
        customerId: row.user_id,
        customerEmail: row.customers?.email ?? "",
        customerName: row.customers?.full_name ?? "",
        trackingNumber: row.tracking_number ?? undefined,
      }));

      res.json({
        orders,
        total: count ?? 0,
        page: q.page,
        pageSize: q.pageSize,
      });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/:id",
  validate({ params: uuidParam }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as { id: string };
      const supabase = getSupabaseAdmin();

      const { data: order, error } = await supabase
        .from("orders")
        .select("*, customers!inner(id, email, full_name, phone)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!order) {
        res.status(404).json({ error: "ההזמנה לא נמצאה." });
        return;
      }

      const { data: items, error: itemsErr } = await supabase
        .from("order_items")
        .select(
          "id, variant_id, quantity, price_at_purchase, product_variants!inner(variant_name, sku, image_url, products!inner(id, name, slug))",
        )
        .eq("order_id", id);
      if (itemsErr) throw itemsErr;

      res.json({ order, items: items ?? [] });
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/:id/status",
  validate({ params: uuidParam, body: orderStatusBody }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as { id: string };
      const { status } = req.body as z.infer<typeof orderStatusBody>;
      const supabase = getSupabaseAdmin();

      const { data: before, error: readErr } = await supabase
        .from("orders")
        .select("id, status, shipped_at, delivered_at")
        .eq("id", id)
        .maybeSingle();
      if (readErr) throw readErr;
      if (!before) {
        res.status(404).json({ error: "ההזמנה לא נמצאה." });
        return;
      }

      const allowed = STATUS_TRANSITIONS[before.status as OrderStatus] ?? [];
      if (!allowed.includes(status)) {
        res.status(400).json({
          error: `לא ניתן לעבור מ-${before.status} ל-${status}.`,
        });
        return;
      }

      const patch: Record<string, unknown> = { status };
      if (status === "shipped" && !before.shipped_at) {
        patch.shipped_at = new Date().toISOString();
      }
      if (status === "delivered" && !before.delivered_at) {
        patch.delivered_at = new Date().toISOString();
      }

      const { data: after, error } = await supabase
        .from("orders")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;

      await logAdminAction(req, {
        action: "order.status_change",
        targetType: "order",
        targetId: id,
        before: { status: before.status },
        after: { status: after.status },
      });
      res.json(after);
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/:id/shipping",
  validate({ params: uuidParam, body: orderShippingBody }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as { id: string };
      const body = req.body as z.infer<typeof orderShippingBody>;
      const supabase = getSupabaseAdmin();

      const patch: Record<string, unknown> = {};
      if (body.trackingNumber !== undefined)
        patch.tracking_number = body.trackingNumber;
      if (body.shippedAt !== undefined) patch.shipped_at = body.shippedAt;
      if (body.deliveredAt !== undefined) patch.delivered_at = body.deliveredAt;
      if (body.notes !== undefined) patch.notes = body.notes;

      if (Object.keys(patch).length === 0) {
        res.status(400).json({ error: "אין נתונים לעדכון." });
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      if (!data) {
        res.status(404).json({ error: "ההזמנה לא נמצאה." });
        return;
      }

      await logAdminAction(req, {
        action: "order.shipping_update",
        targetType: "order",
        targetId: id,
        meta: patch,
      });
      res.json(data);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/:id/refund",
  sensitiveLimiter,
  requireSudo,
  requireIdempotencyKey("refund_order"),
  validate({ params: uuidParam, body: refundBody }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as { id: string };
      const { amount } = req.body as z.infer<typeof refundBody>;
      const supabase = getSupabaseAdmin();
      const key = (req as unknown as { idempotencyKey: string }).idempotencyKey;

      const { data, error } = await supabase.rpc("refund_order", {
        p_order_id: id,
        p_amount: amount,
        p_admin_id: req.customer!.id,
        p_idempotency_key: key,
      });
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      const result = data as { ok: boolean; error?: string; amount?: number };
      if (!result?.ok) {
        res.status(400).json(result ?? { error: "refund_error" });
        return;
      }

      await recordIdempotent(req, result as unknown as Record<string, unknown>);
      // The RPC already writes to admin_activity_log, but we add an
      // HTTP-level entry too so IP/UA/request_id are captured.
      await logAdminAction(req, {
        action: "order.refund_http",
        targetType: "order",
        targetId: id,
        meta: { amount },
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

export default router;
