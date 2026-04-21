import { Router, type Router as RouterType } from "express";
import analyticsRouter from "./analytics.js";
import productsRouter, { variantsRouter } from "./products.js";
import categoriesRouter from "./categories.js";
import subCategoriesRouter from "./sub-categories.js";
import ordersRouter from "./orders.js";
import usersRouter from "./users.js";
import auditLogRouter from "./audit-log.js";
import securityEventsRouter from "./security-events.js";

const router: RouterType = Router();

/** GET /api/admin/me — quick identity echo for the admin dashboard. */
router.get("/me", (req, res) => {
  const c = req.customer!;
  res.json({ id: c.id, email: c.email, role: c.role, status: c.status });
});

router.use("/analytics", analyticsRouter);
router.use("/products", productsRouter);
router.use("/variants", variantsRouter);
router.use("/categories", categoriesRouter);
router.use("/sub-categories", subCategoriesRouter);
router.use("/orders", ordersRouter);
router.use("/users", usersRouter);
router.use("/activity-log", auditLogRouter);
router.use("/security-events", securityEventsRouter);

export default router;
