import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const _cfgDir = path.dirname(fileURLToPath(import.meta.url));
const _packageRoot = path.join(_cfgDir, "..", "..");

const envCandidates = [
  path.join(process.cwd(), ".env"),
  path.join(process.cwd(), ".env.local"),
  path.join(process.cwd(), "services", "core-service", ".env"),
  path.join(process.cwd(), "services", "core-service", ".env.local"),
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

const _packageEnvPath = path.join(_packageRoot, ".env");
if (fs.existsSync(_packageEnvPath) && fs.statSync(_packageEnvPath).size === 0) {
  console.warn(
    "[core-service] services/core-service/.env exists but is 0 bytes on disk. Save the file in your editor (Ctrl+S), or copy: .env.template → .env",
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
