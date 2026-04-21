import type { Request } from "express";
import { getSupabaseAdmin } from "../../config/supabase.js";

export type AuditDiff = Record<string, { from: unknown; to: unknown }>;

/**
 * Writes an admin action row. Never logs passwords, tokens, or other
 * secrets — callers are expected to strip those from `before`/`after`
 * before passing them here. Returns quietly on failure so a log write
 * never breaks an admin operation, but errors are surfaced to stderr.
 */
export async function logAdminAction(
  req: Request,
  input: {
    action: string;
    targetType?: string;
    targetId?: string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    diff?: AuditDiff | null;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  const adminId = req.customer?.id;
  if (!adminId) return;

  const computedDiff =
    input.diff ?? buildDiff(input.before ?? undefined, input.after ?? undefined);

  const ua = req.headers["user-agent"];
  const uaStr =
    typeof ua === "string" ? (ua.length > 512 ? ua.slice(0, 512) : ua) : null;

  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("admin_activity_log").insert({
      admin_id: adminId,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      diff: computedDiff
        ? { ...computedDiff, ...(input.meta ?? {}) }
        : (input.meta ?? null),
      ip: req.ip ?? null,
      user_agent: uaStr,
      request_id: req.requestId ?? null,
    });
  } catch (e) {
    console.error(
      `[admin-audit] failed to write action=${input.action} requestId=${req.requestId}: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
}

function buildDiff(
  before?: Record<string, unknown>,
  after?: Record<string, unknown>,
): AuditDiff | null {
  if (!before && !after) return null;
  const keys = new Set<string>([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  const diff: AuditDiff = {};
  for (const k of keys) {
    const a = before?.[k];
    const b = after?.[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      diff[k] = { from: a, to: b };
    }
  }
  return Object.keys(diff).length > 0 ? diff : null;
}
