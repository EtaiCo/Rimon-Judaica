import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const _cfgDir = path.dirname(fileURLToPath(import.meta.url));
const _packageRoot = path.join(_cfgDir, "..", "..");

const envCandidates = [
  path.join(process.cwd(), ".env"),
  path.join(process.cwd(), ".env.local"),
  path.join(process.cwd(), "apps", "services", "core-service", ".env"),
  path.join(process.cwd(), "apps", "services", "core-service", ".env.local"),
  path.join(_packageRoot, ".env"),
  path.join(_packageRoot, ".env.local"),
];

const loadedEnvPaths: string[] = [];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
    loadedEnvPaths.push(envPath);
  }
}

/** If `.env.local` (or similar) cleared JWT_SECRET, re-apply package `.env`. */
const packageDotenv = path.join(_packageRoot, ".env");
let jwtFallbackUsed = false;
if (!process.env.JWT_SECRET?.trim() && fs.existsSync(packageDotenv)) {
  jwtFallbackUsed = true;
  dotenv.config({ path: packageDotenv, override: true });
}

// #region agent log
fetch("http://127.0.0.1:7506/ingest/a221c478-ae81-4876-8cff-d369da88eb5b", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Debug-Session-Id": "7d53ed",
  },
  body: JSON.stringify({
    sessionId: "7d53ed",
    location: "apps/services/core-service/src/config/index.ts:post-dotenv",
    message: "Env bootstrap after dotenv",
    data: {
      cwd: process.cwd(),
      packageRoot: _packageRoot,
      loadedEnvPaths,
      jwtTrimmedPresent: Boolean(process.env.JWT_SECRET?.trim()),
      jwtRawLength: process.env.JWT_SECRET?.length ?? 0,
      jwtFallbackUsed,
    },
    timestamp: Date.now(),
    hypothesisId: "H1-H2-H3-H5",
    runId: "post-fix",
  }),
}).catch(() => {});
// #endregion

const _packageEnvPath = path.join(_packageRoot, ".env");
if (fs.existsSync(_packageEnvPath) && fs.statSync(_packageEnvPath).size === 0) {
  console.warn(
    "[core-service] apps/services/core-service/.env exists but is 0 bytes on disk. Save the file in your editor (Ctrl+S), or copy: .env.template → .env",
  );
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  storefrontUrl: process.env.STOREFRONT_URL ?? "http://localhost:5173",
  supabase: {
    url:
      process.env.SUPABASE_URL ??
      "https://gxgluavxmewuffnckrxp.supabase.co",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  },
} as const;
