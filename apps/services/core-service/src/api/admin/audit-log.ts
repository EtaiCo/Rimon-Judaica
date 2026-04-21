import { Router, type Router as RouterType } from "express";
import { z } from "zod";
import { getSupabaseAdmin } from "../../config/supabase.js";
import { validate } from "./validate.js";
import { activityListQuery } from "./schemas.js";

const router: RouterType = Router();

router.get(
  "/",
  validate({ query: activityListQuery }),
  async (req, res, next) => {
    try {
      const q = req.query as unknown as z.infer<typeof activityListQuery>;
      const supabase = getSupabaseAdmin();
      const from = (q.page - 1) * q.pageSize;
      const to = from + q.pageSize - 1;

      let query = supabase
        .from("admin_activity_log")
        .select(
          "id, admin_id, action, target_type, target_id, diff, ip, user_agent, request_id, created_at, customers:admin_id(email)",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (q.action) query = query.ilike("action", `%${q.action}%`);
      if (q.adminId) query = query.eq("admin_id", q.adminId);

      const { data, count, error } = await query;
      if (error) throw error;

      const entries = (data ?? []).map((row: any) => ({
        id: row.id,
        adminId: row.admin_id,
        adminEmail: row.customers?.email ?? undefined,
        action: row.action,
        targetType: row.target_type ?? undefined,
        targetId: row.target_id ?? undefined,
        diff: row.diff ?? undefined,
        ip: row.ip ?? undefined,
        userAgent: row.user_agent ?? undefined,
        requestId: row.request_id ?? undefined,
        createdAt: row.created_at,
      }));

      res.json({
        entries,
        total: count ?? 0,
        page: q.page,
        pageSize: q.pageSize,
      });
    } catch (e) {
      next(e);
    }
  },
);

export default router;
