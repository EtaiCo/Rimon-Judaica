import type { RequestHandler } from "express";

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * Rejects mutating requests that did not declare `application/json`.
 * Prevents form-encoded CSRF-style submissions from being parsed.
 * `DELETE` and `GET` without a body are exempt.
 */
export const requireJsonContentType: RequestHandler = (req, res, next) => {
  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }

  const len = Number(req.headers["content-length"] ?? 0);
  if (req.method === "DELETE" && (!len || len === 0)) {
    next();
    return;
  }

  const ct = String(req.headers["content-type"] ?? "")
    .split(";")[0]
    ?.trim()
    .toLowerCase();

  if (ct === "application/json") {
    next();
    return;
  }

  res.status(415).json({ error: "Content-Type must be application/json" });
};
