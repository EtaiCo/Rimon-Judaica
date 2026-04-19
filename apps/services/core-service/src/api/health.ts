import { Router, type Router as RouterType } from "express";

const router: RouterType = Router();

router.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "core-service",
    timestamp: new Date().toISOString(),
  });
});

export default router;
