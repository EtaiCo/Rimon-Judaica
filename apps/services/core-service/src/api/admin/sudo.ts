import type { RequestHandler } from "express";
import { getSupabaseAdmin } from "../../config/supabase.js";
import { verifyPassword } from "../../lib/password.js";
import { logSecurityEvent } from "../../lib/securityLog.js";

const SUDO_HEADER = "x-sudo-password";

/**
 * Step-up re-authentication for destructive admin operations. Requires
 * a fresh `x-sudo-password` header that matches the acting admin's
 * current password. Failures are logged as security events so brute
 * attempts surface in the dashboard and trigger the rate limiter.
 */
export const requireSudo: RequestHandler = async (req, res, next) => {
  const adminId = req.customer?.id;
  if (!adminId) {
    res.status(401).json({ error: "נדרשת התחברות." });
    return;
  }

  const raw = req.headers[SUDO_HEADER];
  const password = typeof raw === "string" ? raw : "";
  if (!password) {
    res.status(401).json({ error: "יש לאשר סיסמה לצורך פעולה זו." });
    return;
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(503).json({ error: msg });
    return;
  }

  const { data, error } = await supabase
    .from("customers")
    .select("id, password_hash")
    .eq("id", adminId)
    .maybeSingle();

  if (error || !data) {
    res.status(401).json({ error: "לא ניתן לאמת את הפעולה." });
    return;
  }

  const ok = await verifyPassword(password, data.password_hash as string);
  if (!ok) {
    await logSecurityEvent(req, {
      kind: "sudo_password_fail",
      severity: "warn",
      customerId: adminId,
      meta: { path: req.originalUrl },
    });
    res.status(401).json({ error: "סיסמה שגויה." });
    return;
  }

  next();
};
