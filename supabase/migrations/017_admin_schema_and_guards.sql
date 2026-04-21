-- ============================================================
-- Rimon Judaica — Admin schema, lifecycle fields, and DB-level
-- privilege-escalation guards.
--
-- Hardens the existing schema for the admin dashboard by:
--   • Adding role / status / jwt_version on customers (server-only writes)
--   • Adding lifecycle / SEO / inventory metadata on products, variants,
--     categories and orders
--   • Switching orders.user_id FK to RESTRICT so customer deletion cannot
--     cascade-destroy financial history
--   • Installing a BEFORE UPDATE trigger that rejects any non-service_role
--     write to privileged customer columns
--   • Installing a generic "set updated_at" trigger
-- ============================================================

-- ── 1. Customers: role / status / jwt_version / 2FA scaffolding ─────────

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS role                TEXT        NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer', 'admin')),
  ADD COLUMN IF NOT EXISTS status              TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended')),
  ADD COLUMN IF NOT EXISTS jwt_version         INT         NOT NULL DEFAULT 1
    CHECK (jwt_version >= 1),
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS totp_secret         TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled        BOOLEAN     NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_customers_role   ON customers (role);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers (status);

-- ── 2. Privileged-column guard ──────────────────────────────────────────
-- Even if customers RLS is ever loosened (e.g. a future Supabase Auth
-- migration that grants UPDATE to `authenticated`), this trigger rejects
-- any modification of role/status/jwt_version/password_hash/totp_secret
-- unless the JWT role is service_role. The backend uses service_role,
-- so it is unaffected.

CREATE OR REPLACE FUNCTION block_privileged_customer_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  jwt_role TEXT;
BEGIN
  jwt_role := COALESCE(current_setting('request.jwt.claim.role', true), '');

  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.role          IS DISTINCT FROM OLD.role          OR
     NEW.status        IS DISTINCT FROM OLD.status        OR
     NEW.jwt_version   IS DISTINCT FROM OLD.jwt_version   OR
     NEW.password_hash IS DISTINCT FROM OLD.password_hash OR
     NEW.totp_secret   IS DISTINCT FROM OLD.totp_secret   OR
     NEW.totp_enabled  IS DISTINCT FROM OLD.totp_enabled
  THEN
    RAISE EXCEPTION 'forbidden: privileged column write on customers'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS customers_block_privileged ON customers;
CREATE TRIGGER customers_block_privileged
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION block_privileged_customer_columns();

-- ── 3. Generic updated_at helper ────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- ── 4. Categories: SEO + ordering ───────────────────────────────────────

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS seo_title       TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS sort_order      INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories (sort_order);

DROP TRIGGER IF EXISTS categories_set_updated_at ON categories;
CREATE TRIGGER categories_set_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 5. Products: lifecycle + images + SEO ───────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_active       BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS images          JSONB       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS seo_title       TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_images_is_array'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_images_is_array
        CHECK (jsonb_typeof(images) = 'array');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_is_active ON products (is_active);

DROP TRIGGER IF EXISTS products_set_updated_at ON products;
CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 6. Product variants: variant attributes + low-stock threshold ───────

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS size                 TEXT,
  ADD COLUMN IF NOT EXISTS color                TEXT,
  ADD COLUMN IF NOT EXISTS material             TEXT,
  ADD COLUMN IF NOT EXISTS low_stock_threshold  INT         NOT NULL DEFAULT 5
    CHECK (low_stock_threshold >= 0),
  ADD COLUMN IF NOT EXISTS is_active            BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_variants_low_stock
  ON product_variants (stock_quantity)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS variants_set_updated_at ON product_variants;
CREATE TRIGGER variants_set_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 7. Orders: lifecycle + shipping/refund metadata ─────────────────────
-- Tighten orders.user_id FK first so customer deletion never cascades
-- away order history. Hard delete is blocked by RESTRICT; admins must
-- suspend instead.

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_user_id_fkey;

ALTER TABLE orders
  ADD CONSTRAINT orders_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES customers (id) ON DELETE RESTRICT;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS shipped_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_amount   NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS notes           TEXT,
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT now();

-- Replace any existing free-form status check with the lifecycle enum.
DO $$
DECLARE
  ck_name TEXT;
BEGIN
  SELECT conname INTO ck_name
  FROM pg_constraint
  WHERE conrelid = 'orders'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';

  IF ck_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', ck_name);
  END IF;
END $$;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_lifecycle
    CHECK (status IN (
      'pending', 'paid', 'preparing',
      'shipped', 'delivered', 'cancelled', 'refunded'
    ));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_refund_amount_valid'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_refund_amount_valid
        CHECK (
          refund_amount IS NULL
          OR (refund_amount >= 0 AND refund_amount <= total_amount)
        );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);

DROP TRIGGER IF EXISTS orders_set_updated_at ON orders;
CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
