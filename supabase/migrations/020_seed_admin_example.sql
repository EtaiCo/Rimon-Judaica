-- ============================================================
-- Rimon Judaica — One-off admin bootstrap (kept commented).
--
-- After registering a normal customer through the storefront, run the
-- query below from the Supabase SQL editor to promote them to admin and
-- force a re-login (jwt_version bump invalidates any existing token).
-- ============================================================

-- UPDATE customers
-- SET role        = 'admin',
--     jwt_version = jwt_version + 1
-- WHERE email = lower('you@example.com');

-- To instantly revoke a compromised admin account:
--   UPDATE customers
--   SET status      = 'suspended',
--       jwt_version = jwt_version + 1
--   WHERE id = '<admin-uuid>';

-- To clean up old idempotency keys (safe to run any time):
--   SELECT cleanup_admin_idempotency_keys();
