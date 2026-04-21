import type { Request } from "express";
import { getSupabaseAdmin } from "../config/supabase.js";

export type SecuritySeverity = "info" | "warn" | "error" | "critical";

export type SecurityEventInput = {
  kind: string;
  severity?: SecuritySeverity;
  customerId?: string;
  meta?: Record<string, unknown>;
};

export type AuthEventKind =
  | "login_ok"
  | "login_fail"
  | "register"
  | "logout"
  | "token_revoked"
  | "token_version_mismatch";

function clientIp(req: Request): string | null {
  const ip = req.ip ?? "";
  return ip && ip.length <= 64 ? ip : null;
}

function userAgent(req: Request): string | null {
  const ua = req.headers["user-agent"];
  if (typeof ua !== "string") return null;
  return ua.length > 512 ? ua.slice(0, 512) : ua;
}

/** Best-effort write to `security_events`. Never throws. */
export async function logSecurityEvent(
  req: Request,
  input: SecurityEventInput,
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("security_events").insert({
      kind: input.kind,
      severity: input.severity ?? "info",
      customer_id: input.customerId ?? null,
      meta: input.meta ?? {},
      ip: clientIp(req),
      user_agent: userAgent(req),
      request_id: req.requestId ?? null,
    });
  } catch (e) {
    console.warn(
      `[security] failed to log event kind=${input.kind} requestId=${req.requestId}: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
}

/** Best-effort write to `auth_activity_log`. Never throws. */
export async function logAuthEvent(
  req: Request,
  input: { kind: AuthEventKind; customerId?: string; email?: string },
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("auth_activity_log").insert({
      kind: input.kind,
      customer_id: input.customerId ?? null,
      email: input.email?.toLowerCase() ?? null,
      ip: clientIp(req),
      user_agent: userAgent(req),
    });
  } catch (e) {
    console.warn(
      `[auth-log] failed to log kind=${input.kind} requestId=${req.requestId}: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
}
