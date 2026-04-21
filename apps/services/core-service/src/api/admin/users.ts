import { Router, type Router as RouterType } from "express";
import { z } from "zod";
import { getSupabaseAdmin } from "../../config/supabase.js";
import { validate } from "./validate.js";
import { logAdminAction } from "./audit.js";
import { requireSudo } from "./sudo.js";
import { sensitiveLimiter } from "../../middleware/rateLimit.js";
import {
  userListQuery,
  userRoleBody,
  userStatusBody,
  uuidParam,
} from "./schemas.js";

const router: RouterType = Router();

router.get(
  "/",
  validate({ query: userListQuery }),
  async (req, res, next) => {
    try {
      const q = req.query as unknown as z.infer<typeof userListQuery>;
      const supabase = getSupabaseAdmin();
      const from = (q.page - 1) * q.pageSize;
      const to = from + q.pageSize - 1;

      let query = supabase
        .from("customers")
        .select(
          "id, full_name, email, phone, customer_type, role, status, created_at, last_login",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (q.role) query = query.eq("role", q.role);
      if (q.status) query = query.eq("status", q.status);
      if (q.q) {
        query = query.or(
          `email.ilike.%${q.q}%,full_name.ilike.%${q.q}%,phone.ilike.%${q.q}%`,
        );
      }

      const { data, count, error } = await query;
      if (error) throw error;

      res.json({
        users: data ?? [],
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

      const { data: user, error } = await supabase
        .from("customers")
        .select(
          "id, full_name, email, phone, customer_type, role, status, created_at, last_login",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!user) {
        res.status(404).json({ error: "המשתמש לא נמצא." });
        return;
      }

      const [{ data: orders, error: ordersErr }, spendRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, invoice_number, status, total_amount, created_at")
          .eq("user_id", id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("orders")
          .select("total_amount, status")
          .eq("user_id", id),
      ]);
      if (ordersErr) throw ordersErr;
      if (spendRes.error) throw spendRes.error;

      const totalSpend = (spendRes.data ?? [])
        .filter(
          (r) => r.status !== "cancelled" && r.status !== "refunded",
        )
        .reduce((sum, r) => sum + Number(r.total_amount ?? 0), 0);

      res.json({
        user,
        orders: orders ?? [],
        totalSpend: Number(totalSpend.toFixed(2)),
        ordersCount: (spendRes.data ?? []).length,
      });
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/:id/status",
  sensitiveLimiter,
  requireSudo,
  validate({ params: uuidParam, body: userStatusBody }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as { id: string };
      const { status } = req.body as z.infer<typeof userStatusBody>;
      const supabase = getSupabaseAdmin();

      if (id === req.customer!.id) {
        res.status(400).json({ error: "לא ניתן לשנות את הסטטוס של עצמך." });
        return;
      }

      const rpc =
        status === "suspended"
          ? "suspend_customer"
          : "activate_customer";

      const { data, error } = await supabase.rpc(rpc, {
        p_target_id: id,
        p_admin_id: req.customer!.id,
      });
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      const result = data as { ok: boolean; error?: string; changed?: boolean };
      if (!result?.ok) {
        res.status(400).json(result ?? { error: "status_error" });
        return;
      }

      await logAdminAction(req, {
        action:
          status === "suspended" ? "user.suspend_http" : "user.activate_http",
        targetType: "customer",
        targetId: id,
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/:id/role",
  sensitiveLimiter,
  requireSudo,
  validate({ params: uuidParam, body: userRoleBody }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as { id: string };
      const { role } = req.body as z.infer<typeof userRoleBody>;
      const supabase = getSupabaseAdmin();

      if (id === req.customer!.id && role !== "admin") {
        res.status(400).json({ error: "לא ניתן להוריד את עצמך מהרשאות מנהל." });
        return;
      }

      const rpc = role === "admin" ? "promote_customer" : "demote_admin";
      const { data, error } = await supabase.rpc(rpc, {
        p_target_id: id,
        p_admin_id: req.customer!.id,
      });
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      const result = data as { ok: boolean; error?: string; changed?: boolean };
      if (!result?.ok) {
        res.status(400).json(result ?? { error: "role_error" });
        return;
      }

      await logAdminAction(req, {
        action: role === "admin" ? "user.promote_http" : "user.demote_http",
        targetType: "customer",
        targetId: id,
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/:id",
  sensitiveLimiter,
  requireSudo,
  validate({ params: uuidParam }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as { id: string };
      const supabase = getSupabaseAdmin();

      if (id === req.customer!.id) {
        res.status(400).json({ error: "לא ניתן למחוק את עצמך." });
        return;
      }

      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", id);

      if ((count ?? 0) > 0) {
        // Hard delete is blocked by the RESTRICT FK anyway; surface it
        // as a policy error and suggest suspension via the RPC instead.
        const { data: susp, error: suspErr } = await supabase.rpc(
          "suspend_customer",
          { p_target_id: id, p_admin_id: req.customer!.id },
        );
        if (suspErr) {
          res.status(500).json({ error: suspErr.message });
          return;
        }
        await logAdminAction(req, {
          action: "user.delete_blocked_suspended",
          targetType: "customer",
          targetId: id,
          meta: { ordersCount: count ?? 0 },
        });
        res
          .status(409)
          .json({
            error: "למשתמש יש הזמנות ולכן לא ניתן למחיקה. הוא הושעה במקום.",
            suspend: susp,
          });
        return;
      }

      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      await logAdminAction(req, {
        action: "user.delete",
        targetType: "customer",
        targetId: id,
      });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  },
);

export default router;
