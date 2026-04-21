import type { RequestHandler } from "express";
import type { CustomerRole, CustomerStatus } from "@rimon/shared-types";
import { verifyCustomerAccessToken } from "../lib/jwt.js";
import { getSupabaseAdmin } from "../config/supabase.js";
import { logSecurityEvent } from "../lib/securityLog.js";

function isCustomerRole(v: unknown): v is CustomerRole {
  return v === "customer" || v === "admin";
}

function isCustomerStatus(v: unknown): v is CustomerStatus {
  return v === "active" || v === "suspended";
}

/**
 * Verifies the JWT and re-reads the live `customers` row. Sets
 * `req.customer = { id, role, status, email }` only when the token's
 * `ver` matches the current `jwt_version` AND `status='active'`.
 *
 * This is the only path through which any authenticated request enters.
 * Role/status are NEVER trusted from the JWT — they are read from the
 * DB on every request so suspension and demotion take effect instantly.
 */
export const requireCustomerAuth: RequestHandler = async (req, res, next) => {
  const raw = req.headers.authorization;
  if (!raw?.startsWith("Bearer ")) {
    res.status(401).json({ error: "נדרשת התחברות." });
    return;
  }
  const token = raw.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ error: "נדרשת התחברות." });
    return;
  }

  let payload;
  try {
    payload = verifyCustomerAccessToken(token);
  } catch {
    res.status(401).json({ error: "ההתחברות פגה או אינה תקינה." });
    return;
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    res.status(503).json({ error: "השירות אינו זמין כרגע." });
    return;
  }

  const { data, error } = await supabase
    .from("customers")
    .select("id, email, role, status, jwt_version")
    .eq("id", payload.sub)
    .maybeSingle();

  if (error || !data) {
    res.status(401).json({ error: "ההתחברות פגה או אינה תקינה." });
    return;
  }

  if (typeof data.jwt_version !== "number" || data.jwt_version !== payload.ver) {
    await logSecurityEvent(req, {
      kind: "token_version_mismatch",
      severity: "warn",
      customerId: data.id as string,
      meta: { tokenVer: payload.ver, dbVer: data.jwt_version },
    });
    res.status(401).json({ error: "ההתחברות פגה או אינה תקינה." });
    return;
  }

  if (!isCustomerStatus(data.status) || data.status !== "active") {
    await logSecurityEvent(req, {
      kind: "auth_blocked_suspended",
      severity: "warn",
      customerId: data.id as string,
    });
    res.status(403).json({ error: "החשבון מושעה." });
    return;
  }

  if (!isCustomerRole(data.role)) {
    res.status(401).json({ error: "ההתחברות פגה או אינה תקינה." });
    return;
  }

  req.customer = {
    id: data.id as string,
    role: data.role,
    status: data.status,
    email: data.email as string,
  };
  req.jti = payload.jti;
  next();
};

/**
 * Composes `requireCustomerAuth` and additionally requires
 * `role === 'admin'`. Logs every blocked attempt as a security event so
 * lateral-movement patterns surface in the dashboard.
 */
export const requireAdminAuth: RequestHandler = (req, res, next) => {
  requireCustomerAuth(req, res, async (err?: unknown) => {
    if (err) {
      next(err);
      return;
    }
    if (!req.customer || req.customer.role !== "admin") {
      await logSecurityEvent(req, {
        kind: "admin_access_denied",
        severity: "warn",
        customerId: req.customer?.id,
        meta: { path: req.originalUrl },
      });
      res.status(403).json({ error: "אין הרשאה." });
      return;
    }
    next();
  });
};
