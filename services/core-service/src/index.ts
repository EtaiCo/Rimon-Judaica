import express from "express";
import cors from "cors";
import { config } from "./config/index.js";
import apiRouter from "./api/index.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).json({
    service: "@rimon/core-service",
    message: "This is the API. Open the storefront in your browser.",
    storefront: config.storefrontUrl,
    health: "/api/health",
  });
});

app.use("/api", apiRouter);

app.listen(config.port, () => {
  console.log(`[core-service] Running on http://localhost:${config.port}`);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.warn(
      "[core-service] SUPABASE_SERVICE_ROLE_KEY is missing. Set it in services/core-service/.env — /api/products returns 503 until then.",
    );
  }
});
