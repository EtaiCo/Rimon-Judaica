-- ============================================================
-- Rimon Judaica — Admin RPCs (atomic + idempotent + invariant-safe)
--
-- Creates the audit / idempotency tables that the RPCs depend on, then
-- defines all admin-side state-changing functions:
--   • adjust_stock      — atomic stock delta, never goes negative
--   • refund_order      — atomic refund + restock, idempotent
--   • promote_customer  — set role='admin', revoke existing sessions
--   • demote_admin      — refuses self / last-admin lockout
--   • suspend_customer  — refuses self
--   • activate_customer — re-enables a suspended account
--
-- All RPCs are SECURITY DEFINER with locked search_path. Append-only
-- enforcement on the audit tables is added in migration 019.
-- ============================================================

-- ── Idempotency ─────────────────────────────────────────────────────────
-- Stores the (key, scope) pair plus the response body that was returned
-- the first time the operation succeeded. Replays return the stored
-- response without re-executing the side-effect. Keys are unique per
-- admin so one admin's key can never collide with another's.

CREATE TABLE IF NOT EXISTS admin_idempotency_keys (
  key        TEXT        NOT NULL,
  admin_id   UUID        NOT NULL REFERENCES customers (id) ON DELETE RESTRICT,
  scope      TEXT        NOT NULL,
  response   JSONB       NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_id, key, scope)
);

CREATE INDEX IF NOT EXISTS idx_admin_idem_created_at
  ON admin_idempotency_keys (created_at);

-- ── Audit tables ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_activity_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID        NOT NULL REFERENCES customers (id) ON DELETE RESTRICT,
  action      TEXT        NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  diff        JSONB,
  ip          INET,
  user_agent  TEXT,
  request_id  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_admin    ON admin_activity_log (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_target   ON admin_activity_log (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created  ON admin_activity_log (created_at DESC);

CREATE TABLE IF NOT EXISTS stock_audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  UUID        NOT NULL REFERENCES product_variants (id) ON DELETE RESTRICT,
  admin_id    UUID        REFERENCES customers (id) ON DELETE RESTRICT,
  delta       INT         NOT NULL,
  new_stock   INT         NOT NULL,
  reason      TEXT,
  source      TEXT        NOT NULL DEFAULT 'admin'
    CHECK (source IN ('admin', 'order', 'refund', 'system')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_audit_variant ON stock_audit_log (variant_id);
CREATE INDEX IF NOT EXISTS idx_stock_audit_created ON stock_audit_log (created_at DESC);

CREATE TABLE IF NOT EXISTS auth_activity_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID        REFERENCES customers (id) ON DELETE SET NULL,
  email       TEXT,
  kind        TEXT        NOT NULL
    CHECK (kind IN (
      'login_ok', 'login_fail',
      'register', 'logout',
      'token_revoked', 'token_version_mismatch'
    )),
  ip          INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_activity_email   ON auth_activity_log (email);
CREATE INDEX IF NOT EXISTS idx_auth_activity_created ON auth_activity_log (created_at DESC);

CREATE TABLE IF NOT EXISTS security_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        TEXT        NOT NULL,
  severity    TEXT        NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warn', 'error', 'critical')),
  customer_id UUID        REFERENCES customers (id) ON DELETE SET NULL,
  meta        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  ip          INET,
  user_agent  TEXT,
  request_id  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_events_kind     ON security_events (kind);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events (severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created  ON security_events (created_at DESC);

-- ── Helper: is_admin(uid) ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM customers
    WHERE id = p_user_id
      AND role = 'admin'
      AND status = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION is_admin(UUID) TO service_role;

-- ── adjust_stock ────────────────────────────────────────────────────────
-- Atomic: locks the variant row, validates non-negative result, applies
-- the delta, writes a stock_audit_log row. Idempotent via (admin_id, key).

CREATE OR REPLACE FUNCTION adjust_stock(
  p_variant_id      UUID,
  p_delta           INT,
  p_reason          TEXT,
  p_admin_id        UUID,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing JSONB;
  v_new_stock INT;
BEGIN
  IF p_admin_id IS NULL OR p_idempotency_key IS NULL OR p_idempotency_key = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_request');
  END IF;

  IF NOT is_admin(p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT response INTO v_existing
  FROM admin_idempotency_keys
  WHERE admin_id = p_admin_id
    AND scope    = 'adjust_stock'
    AND key      = p_idempotency_key;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  IF p_delta = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_delta');
  END IF;

  UPDATE product_variants
  SET stock_quantity = stock_quantity + p_delta
  WHERE id = p_variant_id
  RETURNING stock_quantity INTO v_new_stock;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'variant_not_found');
  END IF;

  IF v_new_stock < 0 THEN
    -- The CHECK on stock_quantity will already RAISE; this branch is a
    -- defence-in-depth in case the check is ever removed.
    RAISE EXCEPTION 'stock_would_be_negative';
  END IF;

  INSERT INTO stock_audit_log (variant_id, admin_id, delta, new_stock, reason, source)
  VALUES (p_variant_id, p_admin_id, p_delta, v_new_stock, p_reason, 'admin');

  INSERT INTO admin_idempotency_keys (admin_id, key, scope, response)
  VALUES (
    p_admin_id,
    p_idempotency_key,
    'adjust_stock',
    jsonb_build_object('ok', true, 'new_stock', v_new_stock)
  );

  RETURN jsonb_build_object('ok', true, 'new_stock', v_new_stock);
EXCEPTION
  WHEN check_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'stock_would_be_negative');
END $$;

GRANT EXECUTE ON FUNCTION adjust_stock(UUID, INT, TEXT, UUID, TEXT) TO service_role;

-- ── refund_order ────────────────────────────────────────────────────────
-- Atomic + idempotent. Locks order, validates not-already-refunded and
-- amount-within-total, restocks every order_item line, marks order
-- refunded, writes activity log. The CHECK on orders.refund_amount is
-- enforced by the column constraint — invalid amounts will RAISE here.

CREATE OR REPLACE FUNCTION refund_order(
  p_order_id        UUID,
  p_amount          NUMERIC,
  p_admin_id        UUID,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing      JSONB;
  v_total         NUMERIC(12, 2);
  v_status        TEXT;
  v_item          RECORD;
  v_new_stock     INT;
BEGIN
  IF p_admin_id IS NULL OR p_idempotency_key IS NULL OR p_idempotency_key = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_request');
  END IF;

  IF NOT is_admin(p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT response INTO v_existing
  FROM admin_idempotency_keys
  WHERE admin_id = p_admin_id
    AND scope    = 'refund_order'
    AND key      = p_idempotency_key;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  IF p_amount IS NULL OR p_amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  SELECT total_amount, status
    INTO v_total, v_status
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  IF v_status = 'refunded' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_refunded');
  END IF;

  IF p_amount > v_total THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount_exceeds_total');
  END IF;

  -- Restock each line
  FOR v_item IN
    SELECT variant_id, quantity
    FROM order_items
    WHERE order_id = p_order_id
    FOR UPDATE
  LOOP
    UPDATE product_variants
    SET stock_quantity = stock_quantity + v_item.quantity
    WHERE id = v_item.variant_id
    RETURNING stock_quantity INTO v_new_stock;

    INSERT INTO stock_audit_log
      (variant_id, admin_id, delta, new_stock, reason, source)
    VALUES
      (v_item.variant_id, p_admin_id, v_item.quantity, v_new_stock,
       'refund_order:' || p_order_id::text, 'refund');
  END LOOP;

  UPDATE orders
  SET status        = 'refunded',
      refunded_at   = now(),
      refund_amount = p_amount
  WHERE id = p_order_id;

  INSERT INTO admin_activity_log
    (admin_id, action, target_type, target_id, diff)
  VALUES
    (p_admin_id, 'order.refund', 'order', p_order_id::text,
     jsonb_build_object('amount', p_amount, 'total', v_total));

  INSERT INTO admin_idempotency_keys (admin_id, key, scope, response)
  VALUES (
    p_admin_id,
    p_idempotency_key,
    'refund_order',
    jsonb_build_object('ok', true, 'amount', p_amount)
  );

  RETURN jsonb_build_object('ok', true, 'amount', p_amount);
END $$;

GRANT EXECUTE ON FUNCTION refund_order(UUID, NUMERIC, UUID, TEXT) TO service_role;

-- ── promote_customer ────────────────────────────────────────────────────
-- Idempotent: re-promoting an admin is a no-op but bumps jwt_version
-- once on the first transition only.

CREATE OR REPLACE FUNCTION promote_customer(
  p_target_id UUID,
  p_admin_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_was_admin BOOLEAN;
BEGIN
  IF NOT is_admin(p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT (role = 'admin') INTO v_was_admin
  FROM customers
  WHERE id = p_target_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'target_not_found');
  END IF;

  IF v_was_admin THEN
    RETURN jsonb_build_object('ok', true, 'changed', false);
  END IF;

  UPDATE customers
  SET role        = 'admin',
      jwt_version = jwt_version + 1
  WHERE id = p_target_id;

  INSERT INTO admin_activity_log
    (admin_id, action, target_type, target_id, diff)
  VALUES
    (p_admin_id, 'user.promote', 'customer', p_target_id::text,
     jsonb_build_object('role', jsonb_build_object('from', 'customer', 'to', 'admin')));

  RETURN jsonb_build_object('ok', true, 'changed', true);
END $$;

GRANT EXECUTE ON FUNCTION promote_customer(UUID, UUID) TO service_role;

-- ── demote_admin ────────────────────────────────────────────────────────
-- Refuses self-demotion and last-admin lockout. Bumps jwt_version so
-- existing tokens for the target are immediately invalidated.

CREATE OR REPLACE FUNCTION demote_admin(
  p_target_id UUID,
  p_admin_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target_role   TEXT;
  v_active_admins INT;
BEGIN
  IF NOT is_admin(p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF p_target_id = p_admin_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_demote_self');
  END IF;

  SELECT role INTO v_target_role
  FROM customers
  WHERE id = p_target_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'target_not_found');
  END IF;

  IF v_target_role <> 'admin' THEN
    RETURN jsonb_build_object('ok', true, 'changed', false);
  END IF;

  SELECT COUNT(*) INTO v_active_admins
  FROM customers
  WHERE role = 'admin' AND status = 'active';

  IF v_active_admins <= 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'last_admin_lockout');
  END IF;

  UPDATE customers
  SET role        = 'customer',
      jwt_version = jwt_version + 1
  WHERE id = p_target_id;

  INSERT INTO admin_activity_log
    (admin_id, action, target_type, target_id, diff)
  VALUES
    (p_admin_id, 'user.demote', 'customer', p_target_id::text,
     jsonb_build_object('role', jsonb_build_object('from', 'admin', 'to', 'customer')));

  RETURN jsonb_build_object('ok', true, 'changed', true);
END $$;

GRANT EXECUTE ON FUNCTION demote_admin(UUID, UUID) TO service_role;

-- ── suspend_customer / activate_customer ────────────────────────────────

CREATE OR REPLACE FUNCTION suspend_customer(
  p_target_id UUID,
  p_admin_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target_role   TEXT;
  v_target_status TEXT;
  v_active_admins INT;
BEGIN
  IF NOT is_admin(p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF p_target_id = p_admin_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_suspend_self');
  END IF;

  SELECT role, status INTO v_target_role, v_target_status
  FROM customers
  WHERE id = p_target_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'target_not_found');
  END IF;

  IF v_target_status = 'suspended' THEN
    RETURN jsonb_build_object('ok', true, 'changed', false);
  END IF;

  IF v_target_role = 'admin' THEN
    SELECT COUNT(*) INTO v_active_admins
    FROM customers
    WHERE role = 'admin' AND status = 'active';

    IF v_active_admins <= 1 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'last_admin_lockout');
    END IF;
  END IF;

  UPDATE customers
  SET status      = 'suspended',
      jwt_version = jwt_version + 1
  WHERE id = p_target_id;

  INSERT INTO admin_activity_log
    (admin_id, action, target_type, target_id, diff)
  VALUES
    (p_admin_id, 'user.suspend', 'customer', p_target_id::text,
     jsonb_build_object('status', jsonb_build_object('from', 'active', 'to', 'suspended')));

  RETURN jsonb_build_object('ok', true, 'changed', true);
END $$;

GRANT EXECUTE ON FUNCTION suspend_customer(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION activate_customer(
  p_target_id UUID,
  p_admin_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF NOT is_admin(p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT status INTO v_status
  FROM customers
  WHERE id = p_target_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'target_not_found');
  END IF;

  IF v_status = 'active' THEN
    RETURN jsonb_build_object('ok', true, 'changed', false);
  END IF;

  UPDATE customers
  SET status = 'active'
  WHERE id = p_target_id;

  INSERT INTO admin_activity_log
    (admin_id, action, target_type, target_id, diff)
  VALUES
    (p_admin_id, 'user.activate', 'customer', p_target_id::text,
     jsonb_build_object('status', jsonb_build_object('from', 'suspended', 'to', 'active')));

  RETURN jsonb_build_object('ok', true, 'changed', true);
END $$;

GRANT EXECUTE ON FUNCTION activate_customer(UUID, UUID) TO service_role;

-- ── revoke_user_sessions ────────────────────────────────────────────────
-- Convenience for "logout" / "force-revoke" — bumps jwt_version, which
-- the auth middleware checks against on every request.

CREATE OR REPLACE FUNCTION revoke_user_sessions(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_version INT;
BEGIN
  UPDATE customers
  SET jwt_version = jwt_version + 1
  WHERE id = p_user_id
  RETURNING jwt_version INTO v_new_version;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  RETURN jsonb_build_object('ok', true, 'jwt_version', v_new_version);
END $$;

GRANT EXECUTE ON FUNCTION revoke_user_sessions(UUID) TO service_role;
