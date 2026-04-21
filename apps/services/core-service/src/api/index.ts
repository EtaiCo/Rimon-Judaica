import { Router, type Router as RouterType } from "express";
import healthRouter from "./health.js";
import categoriesRouter from "./categories.js";
import productsRouter from "./products.js";
import authRouter from "./auth.js";
import cartRouter from "./cart.js";
import wishlistRouter from "./wishlist.js";
import ordersRouter from "./orders.js";
import siteSettingsRouter from "./site-settings.js";
import adminRouter from "./admin/index.js";
import { requireAdminAuth } from "../middleware/auth.js";
import { adminLimiter } from "../middleware/rateLimit.js";

const router: RouterType = Router();

router.use("/health", healthRouter);
router.use("/categories", categoriesRouter);
router.use("/products", productsRouter);
router.use("/auth", authRouter);
router.use("/cart", cartRouter);
router.use("/wishlist", wishlistRouter);
router.use("/orders", ordersRouter);
router.use("/site-settings", siteSettingsRouter);

/**
 * Admin surface: gated globally by `requireAdminAuth` (zero-trust auth
 * middleware that re-reads the customer row every request) and rate
 * limited per (ip, admin_id). Individual destructive routes layer
 * `requireSudo`, `requireIdempotencyKey`, and `sensitiveLimiter` on top.
 */
router.use("/admin", adminLimiter, requireAdminAuth, adminRouter);

export default router;
