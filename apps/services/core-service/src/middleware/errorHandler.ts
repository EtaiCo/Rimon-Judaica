import type { ErrorRequestHandler, RequestHandler } from "express";
import { config } from "../config/index.js";

/** 404 fallthrough for unmatched API routes. */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: "Not found",
    requestId: req.requestId,
  });
};

/**
 * Central error handler. In production never leaks stack traces or raw
 * error messages — those go to stderr only with the request id for
 * correlation.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = req.requestId ?? "";
  const status =
    typeof (err as { status?: unknown })?.status === "number"
      ? (err as { status: number }).status
      : typeof (err as { statusCode?: unknown })?.statusCode === "number"
        ? (err as { statusCode: number }).statusCode
        : 500;

  const message =
    err instanceof Error ? err.message : "internal_error";

  console.error(
    `[core-service] error requestId=${requestId} status=${status} method=${req.method} path=${req.originalUrl}: ${message}`,
  );

  if (res.headersSent) {
    return;
  }

  if (config.isProduction && status >= 500) {
    res
      .status(500)
      .json({ error: "שגיאה פנימית, נסו שוב מאוחר יותר.", requestId });
    return;
  }

  res.status(status).json({
    error: status >= 500 ? "internal_error" : message,
    requestId,
  });
};
