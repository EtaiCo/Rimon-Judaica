-- ============================================================
-- Sub-categories + products linkage
-- ============================================================

CREATE TABLE sub_categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID        NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sub_categories_category_id ON sub_categories (category_id);
CREATE INDEX idx_sub_categories_slug ON sub_categories (slug);

ALTER TABLE products
  ADD COLUMN sub_category_id UUID REFERENCES sub_categories (id) ON DELETE SET NULL;

CREATE INDEX idx_products_sub_category_id ON products (sub_category_id);

-- Move existing hierarchical categories (where parent_id is set) to sub_categories.
INSERT INTO sub_categories (category_id, name, slug, created_at)
SELECT
  c.parent_id AS category_id,
  c.name,
  c.slug,
  COALESCE(c.created_at, now())
FROM categories c
WHERE c.parent_id IS NOT NULL
ON CONFLICT (slug) DO NOTHING;

-- Re-link products that currently point to child categories:
-- parent category remains in products.category_id and child becomes products.sub_category_id.
UPDATE products p
SET
  category_id = c.parent_id,
  sub_category_id = sc.id
FROM categories c
JOIN sub_categories sc ON sc.slug = c.slug
WHERE p.category_id = c.id
  AND c.parent_id IS NOT NULL;

-- For root categories that have products without a specific sub-category,
-- create a deterministic fallback sub-category and link those products to it.
INSERT INTO sub_categories (category_id, name, slug)
SELECT
  c.id,
  'כל המוצרים',
  c.slug || '-all'
FROM categories c
WHERE c.parent_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM products p
    WHERE p.category_id = c.id
      AND p.sub_category_id IS NULL
  )
ON CONFLICT (slug) DO NOTHING;

UPDATE products p
SET sub_category_id = sc.id
FROM categories c
JOIN sub_categories sc
  ON sc.category_id = c.id
 AND sc.slug = c.slug || '-all'
WHERE p.category_id = c.id
  AND p.sub_category_id IS NULL
  AND c.parent_id IS NULL;

ALTER TABLE sub_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_sub_categories"
  ON sub_categories FOR SELECT TO anon USING (true);

CREATE POLICY "service_all_sub_categories"
  ON sub_categories FOR ALL TO service_role USING (true) WITH CHECK (true);
