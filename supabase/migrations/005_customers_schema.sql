-- ============================================================
-- Rimon Judaica — Customers + UUID default verification
-- (Numbered 005 because 003/004 are already in use.)
-- ============================================================

-- ── Task 2: Ensure UUID generation on existing tables (idempotent) ──

ALTER TABLE categories
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE products
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE product_variants
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ── Customers ───────────────────────────────────────────────

CREATE TABLE customers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT        UNIQUE NOT NULL
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  phone           TEXT        NOT NULL
    CHECK (phone ~ '^[0-9]{9,10}$'),
  customer_type   TEXT        NOT NULL DEFAULT 'private'
    CHECK (customer_type IN ('private', 'wholesale')),
  password_hash   TEXT        NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  last_login      TIMESTAMPTZ
);

CREATE INDEX idx_customers_email ON customers (email);

-- ── Row Level Security ───────────────────────────────────────

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Authenticated Supabase users: own row only (id must match auth.users.id when Auth is wired)
CREATE POLICY "customers_select_own"
  ON customers FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "customers_update_own"
  ON customers FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Explicit full access for service_role (Supabase typically bypasses RLS for this role; policy documents intent)
CREATE POLICY "customers_service_role_all"
  ON customers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
