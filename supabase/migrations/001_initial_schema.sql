-- ============================================================
-- Rimon Judaica — Initial Schema
-- ============================================================

-- ── Categories ──────────────────────────────────────────────

CREATE TABLE categories (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT        NOT NULL,
  slug       TEXT        UNIQUE NOT NULL,
  parent_id  UUID        REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug   ON categories(slug);

-- ── Products ────────────────────────────────────────────────

CREATE TABLE products (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID        NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name        TEXT        NOT NULL,
  slug        TEXT        UNIQUE NOT NULL,
  description TEXT        DEFAULT '',
  image_url   TEXT        DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_slug     ON products(slug);

-- ── Product Variants ────────────────────────────────────────

CREATE TABLE product_variants (
  id             UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id     UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_name   TEXT          NOT NULL,
  price          DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  stock_quantity INT           NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  sku            TEXT          UNIQUE NOT NULL
);

CREATE INDEX idx_variants_product ON product_variants(product_id);

-- ── Row Level Security ──────────────────────────────────────

ALTER TABLE categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- anon: read-only
CREATE POLICY "anon_select_categories"
  ON categories FOR SELECT TO anon USING (true);

CREATE POLICY "anon_select_products"
  ON products FOR SELECT TO anon USING (true);

CREATE POLICY "anon_select_variants"
  ON product_variants FOR SELECT TO anon USING (true);

-- service_role: full access
CREATE POLICY "service_all_categories"
  ON categories FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_products"
  ON products FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_variants"
  ON product_variants FOR ALL TO service_role USING (true) WITH CHECK (true);
