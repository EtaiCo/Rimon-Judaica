import { Router, type Router as RouterType } from "express";
import healthRouter from "./health.js";
import categoriesRouter from "./categories.js";
import productsRouter from "./products.js";
import authRouter from "./auth.js";
import cartRouter from "./cart.js";
import wishlistRouter from "./wishlist.js";
import ordersRouter from "./orders.js";
import siteSettingsRouter from "./site-settings.js";

const router: RouterType = Router();

router.use("/health", healthRouter);
router.use("/categories", categoriesRouter);
router.use("/products", productsRouter);
router.use("/auth", authRouter);
router.use("/cart", cartRouter);
router.use("/wishlist", wishlistRouter);
router.use("/orders", ordersRouter);
router.use("/site-settings", siteSettingsRouter);

export default router;
