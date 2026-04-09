import { Router, type Router as RouterType } from "express";
import healthRouter from "./health.js";
import categoriesRouter from "./categories.js";
import productsRouter from "./products.js";

const router: RouterType = Router();

router.use("/health", healthRouter);
router.use("/categories", categoriesRouter);
router.use("/products", productsRouter);

export default router;
