import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config/index.js";
import apiRouter from "./api/index.js";
import { requestId } from "./middleware/requestId.js";
import { requireJsonContentType } from "./middleware/contentType.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const app = express();

/** Trust the first proxy hop (Render, Cloudflare) so req.ip is the real client IP. */
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  }),
);

app.use(requestId);

/**
 * CORS allowlist: storefront origin from config (STOREFRONT_URL in prod)
 * plus local dev URLs. Requests without an Origin header (curl, health
 * checks, server-to-server) are allowed so Render health probes don't
 * fail. We use Bearer auth, so `credentials` is intentionally false to
 * shrink the cross-origin attack surface.
 */
const allowedOrigins = Array.from(
  new Set(
    [config.storefrontUrl, "http://localhost:5173", "http://127.0.0.1:5173"]
      .map((u) => u?.trim())
      .filter((u): u is string => Boolean(u)),
  ),
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: false,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Idempotency-Key",
      "X-Sudo-Password",
      "X-Request-Id",
    ],
    exposedHeaders: ["X-Request-Id"],
  }),
);

app.use(requireJsonContentType);
app.use(express.json({ limit: "256kb" }));

app.get("/", (_req, res) => {
  res.status(200).json({
    service: "@rimon/core-service",
    message: "This is the API. Open the storefront in your browser.",
    storefront: config.storefrontUrl,
    health: "/api/health",
  });
});

app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`[core-service] Running on http://localhost:${config.port}`);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.warn(
      "[core-service] SUPABASE_SERVICE_ROLE_KEY is missing. Set it in apps/services/core-service/.env — /api/products returns 503 until then.",
    );
  }
  if (!process.env.JWT_SECRET?.trim()) {
    console.warn(
      "[core-service] JWT_SECRET is missing. Set it in apps/services/core-service/.env — login/register and /api/cart will fail until then.",
    );
  }
});
