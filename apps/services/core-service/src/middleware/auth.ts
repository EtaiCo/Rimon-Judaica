import type { RequestHandler } from "express";
import { verifyCustomerAccessToken } from "../lib/jwt.js";

export const requireCustomerAuth: RequestHandler = (req, res, next) => {
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
  try {
    const { sub } = verifyCustomerAccessToken(token);
    req.customerId = sub;
    next();
  } catch {
    res.status(401).json({ error: "ההתחברות פגה או אינה תקינה." });
  }
};
