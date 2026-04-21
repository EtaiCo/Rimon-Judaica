import type { RequestHandler } from "express";
import { nanoid } from "nanoid";

/**
 * Assigns a per-request id, echoes it as `X-Request-Id`, and accepts an
 * inbound `X-Request-Id` from a trusted upstream proxy (length-capped to
 * avoid log injection).
 */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.headers["x-request-id"];
  const supplied =
    typeof incoming === "string" && incoming.length > 0 && incoming.length <= 64
      ? incoming.replace(/[^A-Za-z0-9_-]/g, "")
      : "";
  const id = supplied || nanoid(16);
  req.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
};
