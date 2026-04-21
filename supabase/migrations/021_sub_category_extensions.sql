-- ============================================================
-- Rimon Judaica — Extend sub_categories for admin management.
--
-- Adds image / SEO / ordering / updated_at columns and attaches
-- the shared set_updated_at trigger (defined in migration 017).
-- ============================================================

ALTER TABLE sub_categories
  ADD COLUMN IF NOT EXISTS image_url       TEXT,
  ADD COLUMN IF NOT EXISTS seo_title       TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS sort_order      INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_sub_categories_category_sort
  ON sub_categories (category_id, sort_order);

DROP TRIGGER IF EXISTS sub_categories_set_updated_at ON sub_categories;
CREATE TRIGGER sub_categories_set_updated_at
  BEFORE UPDATE ON sub_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
