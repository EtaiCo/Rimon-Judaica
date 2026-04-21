import type { Request, RequestHandler } from "express";
import { getSupabaseAdmin } from "../../config/supabase.js";

const IDEMPOTENCY_HEADER = "idempotency-key";
const KEY_REGEX = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Requires a well-formed `Idempotency-Key` header. If an earlier
 * successful response was recorded under (admin_id, scope, key) it is
 * replayed here; otherwise the request proceeds and `recordIdempotent`
 * should be called after a successful mutation with the same scope+key.
 */
export function requireIdempotencyKey(scope: string): RequestHandler {
  return async (req, res, next) => {
    const raw = req.headers[IDEMPOTENCY_HEADER];
    const key = typeof raw === "string" ? raw.trim() : "";
    if (!key || !KEY_REGEX.test(key)) {
      res.status(400).json({ error: "Missing or invalid Idempotency-Key header" });
      return;
    }

    (req as unknown as { idempotencyKey: string }).idempotencyKey = key;
    (req as unknown as { idempotencyScope: string }).idempotencyScope = scope;

    try {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from("admin_idempotency_keys")
        .select("response")
        .eq("admin_id", req.customer!.id)
        .eq("scope", scope)
        .eq("key", key)
        .maybeSingle();

      if (data?.response) {
        res.status(200).json(data.response);
        return;
      }
    } catch (e) {
      console.warn(
        `[idempotency] lookup failed scope=${scope} requestId=${req.requestId}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }

    next();
  };
}

/** Store a successful mutation response under the request's idempotency key. */
export async function recordIdempotent(
  req: Request,
  response: Record<string, unknown>,
): Promise<void> {
  const key = (req as unknown as { idempotencyKey?: string }).idempotencyKey;
  const scope = (req as unknown as { idempotencyScope?: string }).idempotencyScope;
  const adminId = req.customer?.id;
  if (!key || !scope || !adminId) return;

  try {
    const supabase = getSupabaseAdmin();
    await supabase
      .from("admin_idempotency_keys")
      .upsert(
        { admin_id: adminId, scope, key, response },
        { onConflict: "admin_id,key,scope", ignoreDuplicates: true },
      );
  } catch (e) {
    console.warn(
      `[idempotency] record failed scope=${scope} requestId=${req.requestId}: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
}

