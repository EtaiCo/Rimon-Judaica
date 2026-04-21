import { Router, type Router as RouterType } from "express";
import { z } from "zod";
import { getSupabaseAdmin } from "../../config/supabase.js";
import { validate } from "./validate.js";
import { securityListQuery } from "./schemas.js";

const router: RouterType = Router();

router.get(
  "/",
  validate({ query: securityListQuery }),
  async (req, res, next) => {
    try {
      const q = req.query as unknown as z.infer<typeof securityListQuery>;
      const supabase = getSupabaseAdmin();
      const from = (q.page - 1) * q.pageSize;
      const to = from + q.pageSize - 1;

      let query = supabase
        .from("security_events")
        .select(
          "id, kind, severity, customer_id, meta, ip, user_agent, request_id, created_at",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (q.severity) query = query.eq("severity", q.severity);
      if (q.kind) query = query.ilike("kind", `%${q.kind}%`);

      const { data, count, error } = await query;
      if (error) throw error;

      const events = (data ?? []).map((row) => ({
        id: row.id,
        kind: row.kind,
        severity: row.severity,
        customerId: row.customer_id ?? undefined,
        meta: row.meta ?? undefined,
        ip: row.ip ?? undefined,
        userAgent: row.user_agent ?? undefined,
        requestId: row.request_id ?? undefined,
        createdAt: row.created_at,
      }));

      res.json({
        events,
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
