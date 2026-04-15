import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ??
  "https://gxgluavxmewuffnckrxp.supabase.co";

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const hasSupabaseConfig = supabaseAnonKey.trim().length > 0;

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
