-- ============================================================
-- Reset product/category catalog and seed 2-tier hierarchy
-- ============================================================

-- Clean slate for catalog entities (FK-safe).
TRUNCATE TABLE product_variants, products, sub_categories, categories
RESTART IDENTITY CASCADE;

-- Parent categories.
INSERT INTO categories (name, slug, parent_id)
VALUES
  ('שבת', 'shabbat', NULL),
  ('חגים', 'chagim', NULL),
  ('כיסויי טלית ותפילין', 'tallit-tefillin-covers', NULL),
  ('טליתות', 'tallitot', NULL),
  ('סידורים וברכונים', 'siddurim-uvirkonim', NULL),
  ('כיפות', 'kippot', NULL);

-- Sub-categories (2nd tier).
INSERT INTO sub_categories (category_id, name, slug)
SELECT c.id, s.name, s.slug
FROM categories c
JOIN (
  VALUES
    ('shabbat', 'כוסות קידוש', 'kiddush-cups'),
    ('shabbat', 'פמוטים', 'candlesticks'),
    ('shabbat', 'כיסויי חלות', 'challah-covers'),
    ('shabbat', 'כיסויי פלטה', 'blech-covers'),
    ('shabbat', 'סט הבדלה', 'havdalah-sets'),
    ('shabbat', 'מגשי חלה', 'challah-trays'),

    ('chagim', 'ראש השנה', 'rosh-hashanah'),
    ('chagim', 'פורים', 'purim'),
    ('chagim', 'פסח', 'pesach'),
    ('chagim', 'חנוכה', 'hanukkah'),
    ('chagim', 'סט מחזורים', 'machzor-sets'),
    ('chagim', 'ספר הקידוש', 'sefer-kiddush'),

    ('tallit-tefillin-covers', 'כיסויי טלית ותפילין', 'tallit-tefillin-cover'),
    ('tallitot', 'טלית', 'tallit'),
    ('tallitot', 'גופית ציצית', 'tzitzit-undershirt'),
    ('siddurim-uvirkonim', 'סידורים', 'siddurim'),
    ('siddurim-uvirkonim', 'ברכונים', 'birkonim'),
    ('kippot', 'כיפות', 'kippot-sub')
) AS s(category_slug, name, slug)
  ON c.slug = s.category_slug;

-- One sample product per sub-category.
WITH product_seed AS (
  SELECT *
  FROM (
    VALUES
      ('shabbat', 'kiddush-cups', 'כוס קידוש מהודרת', 'kiddush-cup-mehuderet', 289.00, 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38'),
      ('shabbat', 'candlesticks', 'פמוטי שבת יוקרתיים', 'shabbat-candlesticks-premium', 349.00, 'https://images.unsplash.com/photo-1469474968028-56623f02e42e'),
      ('shabbat', 'challah-covers', 'כיסוי חלה קטיפה רקום', 'embroidered-challah-cover-velvet', 219.00, 'https://images.unsplash.com/photo-1478147427282-58a87a120781'),
      ('shabbat', 'blech-covers', 'כיסוי פלטה מעוצב', 'designer-blech-cover', 179.00, 'https://images.unsplash.com/photo-1473091534298-04dcbce3278c'),
      ('shabbat', 'havdalah-sets', 'סט הבדלה קלאסי', 'classic-havdalah-set', 399.00, 'https://images.unsplash.com/photo-1495195134817-aeb325a55b65'),
      ('shabbat', 'challah-trays', 'מגש חלה מהודר', 'premium-challah-tray', 259.00, 'https://images.unsplash.com/photo-1514512364185-4c2b4c9f8eb5'),

      ('chagim', 'rosh-hashanah', 'סט ראש השנה מהודר', 'rosh-hashanah-premium-set', 319.00, 'https://images.unsplash.com/photo-1506744038136-46273834b3fb'),
      ('chagim', 'purim', 'מארז פורים חגיגי', 'purim-festive-kit', 189.00, 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518'),
      ('chagim', 'pesach', 'ערכת פסח יוקרתית', 'pesach-luxury-kit', 459.00, 'https://images.unsplash.com/photo-1519681393784-d120267933ba'),
      ('chagim', 'hanukkah', 'חנוכייה עבודת יד', 'handmade-hanukkah-menorah', 379.00, 'https://images.unsplash.com/photo-1482192596544-9eb780fc7f66'),
      ('chagim', 'machzor-sets', 'סט מחזורים מהודר', 'machzorim-elegant-set', 329.00, 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07'),
      ('chagim', 'sefer-kiddush', 'ספר הקידוש מהדורת פרימיום', 'sefer-kiddush-premium-edition', 169.00, 'https://images.unsplash.com/photo-1472162072942-cd5147eb3902'),

      ('tallit-tefillin-covers', 'tallit-tefillin-cover', 'כיסוי טלית ותפילין עור', 'leather-tallit-tefillin-cover', 299.00, 'https://images.unsplash.com/photo-1465101046530-73398c7f28ca'),
      ('tallitot', 'tallit', 'טלית צמר מהודרת', 'premium-wool-tallit', 489.00, 'https://images.unsplash.com/photo-1465101178521-c1a9136a3b99'),
      ('tallitot', 'tzitzit-undershirt', 'גופית ציצית איכותית', 'quality-tzitzit-undershirt', 159.00, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab'),
      ('siddurim-uvirkonim', 'siddurim', 'סידור תפילה מפואר', 'luxury-prayer-siddur', 149.00, 'https://images.unsplash.com/photo-1455390582262-044cdead277a'),
      ('siddurim-uvirkonim', 'birkonim', 'ברכון שולחני אלגנטי', 'elegant-table-birkon', 139.00, 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6'),
      ('kippot', 'kippot-sub', 'כיפה מהודרת לאירועים', 'event-kippah-premium', 99.00, 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518')
  ) AS x(category_slug, sub_slug, name, slug, base_price, image_url)
),
inserted_products AS (
  INSERT INTO products (category_id, sub_category_id, name, slug, description)
  SELECT
    c.id,
    sc.id,
    ps.name,
    ps.slug,
    'מוצר יוקרתי בעיצוב מוקפד, חומרי גלם איכותיים וגימור ברמה גבוהה במיוחד.'
  FROM product_seed ps
  JOIN categories c ON c.slug = ps.category_slug
  JOIN sub_categories sc
    ON sc.slug = ps.sub_slug
   AND sc.category_id = c.id
  RETURNING id, slug
)
INSERT INTO product_variants (
  product_id,
  variant_name,
  price,
  stock_quantity,
  sku,
  image_url
)
SELECT
  ip.id,
  'ברירת מחדל',
  ps.base_price,
  10,
  'RJ-' || upper(replace(ps.slug, '-', '_')),
  ps.image_url
FROM inserted_products ip
JOIN product_seed ps ON ps.slug = ip.slug;
