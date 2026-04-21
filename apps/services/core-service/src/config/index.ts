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

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }
}

/** If `.env.local` (or similar) cleared JWT_SECRET, re-apply package `.env`. */
const packageDotenv = path.join(_packageRoot, ".env");
if (!process.env.JWT_SECRET?.trim() && fs.existsSync(packageDotenv)) {
  dotenv.config({ path: packageDotenv, override: true });
}

const _packageEnvPath = path.join(_packageRoot, ".env");
if (fs.existsSync(_packageEnvPath) && fs.statSync(_packageEnvPath).size === 0) {
  console.warn(
    "[core-service] apps/services/core-service/.env exists but is 0 bytes on disk. Save the file in your editor (Ctrl+S), or copy: .env.template → .env",
  );
}

function parseAllowedHosts(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

const supabaseUrl =
  process.env.SUPABASE_URL ?? "https://gxgluavxmewuffnckrxp.supabase.co";

let supabaseHostname = "";
try {
  supabaseHostname = new URL(supabaseUrl).hostname.toLowerCase();
} catch {
  supabaseHostname = "";
}

const defaultImageHosts = supabaseHostname ? [supabaseHostname] : [];

export const config = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: (process.env.NODE_ENV ?? "development") as
    | "development"
    | "production"
    | "test",
  isProduction: process.env.NODE_ENV === "production",
  storefrontUrl: process.env.STOREFRONT_URL ?? "http://localhost:5173",
  supabase: {
    url: supabaseUrl,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  },
  admin: {
    /** Hostnames allowed in product image URLs (e.g. supabase storage / CDN). */
    allowedImageHosts: [
      ...new Set([
        ...defaultImageHosts,
        ...parseAllowedHosts(process.env.ADMIN_ALLOWED_IMAGE_HOSTS),
      ]),
    ],
  },
} as const;
