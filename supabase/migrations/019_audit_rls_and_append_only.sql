-- ============================================================
-- Rimon Judaica — Append-only audit + default-deny RLS
--
-- Locks down the audit trail so even a compromised service_role cannot
-- silently rewrite or erase history. Triggers RAISE on any UPDATE or
-- DELETE; new rows are still permitted via INSERT. RLS is enabled with
-- service_role-only ALL policies on every admin table.
-- ============================================================

-- ── Append-only enforcement ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION deny_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit table is append-only: % blocked on %',
    TG_OP, TG_TABLE_NAME
    USING ERRCODE = '42501';
END $$;

DROP TRIGGER IF EXISTS admin_activity_log_append_only ON admin_activity_log;
CREATE TRIGGER admin_activity_log_append_only
  BEFORE UPDATE OR DELETE ON admin_activity_log
  FOR EACH ROW EXECUTE FUNCTION deny_audit_mutation();

DROP TRIGGER IF EXISTS stock_audit_log_append_only ON stock_audit_log;
CREATE TRIGGER stock_audit_log_append_only
  BEFORE UPDATE OR DELETE ON stock_audit_log
  FOR EACH ROW EXECUTE FUNCTION deny_audit_mutation();

DROP TRIGGER IF EXISTS auth_activity_log_append_only ON auth_activity_log;
CREATE TRIGGER auth_activity_log_append_only
  BEFORE UPDATE OR DELETE ON auth_activity_log
  FOR EACH ROW EXECUTE FUNCTION deny_audit_mutation();

DROP TRIGGER IF EXISTS security_events_append_only ON security_events;
CREATE TRIGGER security_events_append_only
  BEFORE UPDATE OR DELETE ON security_events
  FOR EACH ROW EXECUTE FUNCTION deny_audit_mutation();

-- ── RLS: enable + service_role-only ─────────────────────────────────────

ALTER TABLE admin_activity_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_audit_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_activity_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_all_admin_activity_log ON admin_activity_log;
CREATE POLICY service_all_admin_activity_log
  ON admin_activity_log FOR ALL
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_all_stock_audit_log ON stock_audit_log;
CREATE POLICY service_all_stock_audit_log
  ON stock_audit_log FOR ALL
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_all_auth_activity_log ON auth_activity_log;
CREATE POLICY service_all_auth_activity_log
  ON auth_activity_log FOR ALL
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_all_security_events ON security_events;
CREATE POLICY service_all_security_events
  ON security_events FOR ALL
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_all_admin_idempotency_keys ON admin_idempotency_keys;
CREATE POLICY service_all_admin_idempotency_keys
  ON admin_idempotency_keys FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ── Optional housekeeping: idempotency key TTL ──────────────────────────
-- Schedule via pg_cron when available; safe to call manually:
--   SELECT cleanup_admin_idempotency_keys();

CREATE OR REPLACE FUNCTION cleanup_admin_idempotency_keys()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM admin_idempotency_keys
  WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END $$;

GRANT EXECUTE ON FUNCTION cleanup_admin_idempotency_keys() TO service_role;
