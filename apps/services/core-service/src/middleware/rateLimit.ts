import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";
import { logSecurityEvent } from "../lib/securityLog.js";

function handleHit(kind: string) {
  return async (req: Request) => {
    await logSecurityEvent(req, {
      kind: `rate_limit:${kind}`,
      severity: "warn",
      meta: { path: req.originalUrl },
    });
  };
}

/** Strict limiter: auth endpoints. Keyed by IP + lowercased email. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const ipKey = ipKeyGenerator(req.ip ?? "");
    const body = (req.body ?? {}) as Record<string, unknown>;
    const email =
      typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
    return `${ipKey}|${email}`;
  },
  handler: async (req, res, _next, options) => {
    await handleHit("auth")(req);
    res
      .status(options.statusCode)
      .json({ error: "יותר מדי ניסיונות. נסו שוב מאוחר יותר." });
  },
});

/** Per-admin limiter: generous but protects the panel from runaway loops. */
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const ipKey = ipKeyGenerator(req.ip ?? "");
    const adminId = req.customer?.id ?? "anon";
    return `${ipKey}|${adminId}`;
  },
  handler: async (req, res, _next, options) => {
    await handleHit("admin")(req);
    res.status(options.statusCode).json({ error: "יותר מדי בקשות." });
  },
});

/** Aggressive limiter: refund / role change / delete-user. */
export const sensitiveLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const ipKey = ipKeyGenerator(req.ip ?? "");
    const adminId = req.customer?.id ?? "anon";
    return `${ipKey}|${adminId}`;
  },
  handler: async (req, res, _next, options) => {
    await handleHit("sensitive")(req);
    res
      .status(options.statusCode)
      .json({ error: "יותר מדי פעולות רגישות. נסו שוב בעוד מספר דקות." });
  },
});
