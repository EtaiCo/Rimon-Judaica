-- Move product images from products → product_variants (variant-level imagery)

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS image_url TEXT;

UPDATE product_variants pv
SET image_url = NULLIF(trim(p.image_url), '')
FROM products p
WHERE pv.product_id = p.id
  AND (pv.image_url IS NULL OR trim(COALESCE(pv.image_url, '')) = '')
  AND p.image_url IS NOT NULL
  AND trim(p.image_url) <> '';

ALTER TABLE products
  DROP COLUMN IF EXISTS image_url;
