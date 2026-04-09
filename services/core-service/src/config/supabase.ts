import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./index.js";

let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to services/core-service/.env (copy from .env.template). Get the value from Supabase Dashboard → Project Settings → API → service_role (secret).",
    );
  }
  if (!_admin) {
    _admin = createClient(config.supabase.url, key);
  }
  return _admin;
}
