-- ============================================================
-- Rimon Judaica — Seed Data
-- ============================================================

-- ── Categories ──────────────────────────────────────────────

INSERT INTO categories (id, name, slug) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'סידורים', 'siddurim'),
  ('a2000000-0000-0000-0000-000000000002', 'טליתות',  'tallitot');

-- ── Products ────────────────────────────────────────────────

-- Product 1: סידור תפילה יוקרתי (under סידורים)
INSERT INTO products (id, category_id, name, slug, description, image_url) VALUES
  ('b1000000-0000-0000-0000-000000000001',
   'a1000000-0000-0000-0000-000000000001',
   'סידור תפילה יוקרתי',
   'siddur-tefila-yukrati',
   'סידור תפילה מפואר בכריכת עור עם הטבעה בזהב. זמין במספר גרסאות עדתיות.',
   'https://placehold.co/600x800/FAF8F2/2C1A0E?text=סידור');

-- Product 2: סידור כיס מהודר (under סידורים)
INSERT INTO products (id, category_id, name, slug, description, image_url) VALUES
  ('b2000000-0000-0000-0000-000000000002',
   'a1000000-0000-0000-0000-000000000001',
   'סידור כיס מהודר',
   'siddur-kis-mehudar',
   'סידור כיס קומפקטי בכריכה רכה, מושלם לנסיעות ולתפילה בדרכים.',
   'https://placehold.co/600x800/FAF8F2/2C1A0E?text=סידור+כיס');

-- Product 3: טלית צמר Premium (under טליתות)
INSERT INTO products (id, category_id, name, slug, description, image_url) VALUES
  ('b3000000-0000-0000-0000-000000000003',
   'a2000000-0000-0000-0000-000000000002',
   'טלית צמר Premium',
   'tallit-tsemer-premium',
   'טלית צמר רחלים באיכות פרימיום עם עטרה מרוקמת. זמינה במספר גדלים וצבעים.',
   'https://placehold.co/600x800/FAF8F2/2C1A0E?text=טלית+צמר');

-- ── Variants ────────────────────────────────────────────────

-- סידור תפילה יוקרתי — 3 variants
INSERT INTO product_variants (product_id, variant_name, price, stock_quantity, sku) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'עדות המזרח - בז׳',     179.00, 25, 'SID-YUK-MIZR-BEZ'),
  ('b1000000-0000-0000-0000-000000000001', 'עדות המזרח - חום בהיר', 179.00, 18, 'SID-YUK-MIZR-BRN'),
  ('b1000000-0000-0000-0000-000000000001', 'אשכנז - שחור',         199.00, 12, 'SID-YUK-ASHK-BLK');

-- סידור כיס מהודר — 2 variants
INSERT INTO product_variants (product_id, variant_name, price, stock_quantity, sku) VALUES
  ('b2000000-0000-0000-0000-000000000002', 'כריכה רכה - חום',  89.00, 40, 'SID-KIS-SOFT-BRN'),
  ('b2000000-0000-0000-0000-000000000002', 'כריכה רכה - שחור', 89.00, 35, 'SID-KIS-SOFT-BLK');

-- טלית צמר Premium — 3 variants
INSERT INTO product_variants (product_id, variant_name, price, stock_quantity, sku) VALUES
  ('b3000000-0000-0000-0000-000000000003', 'גודל 50 - לבן וכסף', 449.00, 10, 'TAL-PRM-50-WSLV'),
  ('b3000000-0000-0000-0000-000000000003', 'גודל 60 - לבן וכסף', 499.00,  8, 'TAL-PRM-60-WSLV'),
  ('b3000000-0000-0000-0000-000000000003', 'גודל 70 - לבן וזהב', 539.00,  5, 'TAL-PRM-70-WGLD');
