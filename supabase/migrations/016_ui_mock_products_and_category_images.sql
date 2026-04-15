-- ============================================================
-- UI Mock Data: 10 products per sub-category + 2-3 variants
-- + parent category image placeholders
-- Idempotent by deleting only mock-tagged rows first.
-- ============================================================

begin;

-- ------------------------------------------------------------------
-- Part A: cleanup (mock rows only)
-- ------------------------------------------------------------------
delete from product_variants
where sku like 'RJ-UI-MOCK-%';

delete from products
where slug like 'ui-mock-%';

-- ------------------------------------------------------------------
-- Part B: insert 10 products for each existing sub-category
-- ------------------------------------------------------------------
with product_suffixes as (
  select *
  from (
    values
      (1, 'דגם ירושלים'),
      (2, 'מהדורת בית המקדש'),
      (3, 'קולקציית מורשת'),
      (4, 'עבודת יד יוקרתית'),
      (5, 'סדרת פרימיום'),
      (6, 'גימור זהב עדין'),
      (7, 'אוסף חגיגי'),
      (8, 'מהדורה קלאסית'),
      (9, 'עיטור מסורתי'),
      (10, 'לוקס אוריגינל')
  ) as t(idx, suffix)
),
base_products as (
  select
    c.id as category_id,
    sc.id as sub_category_id,
    sc.slug as sub_slug,
    sc.name as sub_name,
    s.idx
  from sub_categories sc
  join categories c on c.id = sc.category_id
  cross join generate_series(1, 10) as s(idx)
)
insert into products (
  category_id,
  sub_category_id,
  name,
  slug,
  description
)
select
  bp.category_id,
  bp.sub_category_id,
  bp.sub_name || ' ' || ps.suffix as name,
  'ui-mock-' || bp.sub_slug || '-' || lpad(bp.idx::text, 2, '0') as slug,
  'מוצר יוקרתי בעיצוב מוקפד, חומרי גלם איכותיים וגימור ברמה גבוהה במיוחד.' as description
from base_products bp
join product_suffixes ps on ps.idx = bp.idx
on conflict (slug) do nothing;

-- ------------------------------------------------------------------
-- Part C: insert 2-3 variants for each mock product
-- ------------------------------------------------------------------
with variant_images as (
  select *
  from (
    values
      (1, 'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=1200&q=80'),
      (2, 'https://images.unsplash.com/photo-1514512364185-4c2b4c9f8eb5?auto=format&fit=crop&w=1200&q=80'),
      (3, 'https://images.unsplash.com/photo-1495195134817-aeb325a55b65?auto=format&fit=crop&w=1200&q=80'),
      (4, 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80'),
      (5, 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1200&q=80'),
      (6, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80'),
      (7, 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80'),
      (8, 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80'),
      (9, 'https://images.unsplash.com/photo-1482192596544-9eb780fc7f66?auto=format&fit=crop&w=1200&q=80'),
      (10, 'https://images.unsplash.com/photo-1478147427282-58a87a120781?auto=format&fit=crop&w=1200&q=80'),
      (11, 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80'),
      (12, 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=1200&q=80')
  ) as t(id, image_url)
),
mock_products as (
  select
    p.id,
    p.slug,
    2 + (abs(hashtext(p.slug)) % 2) as variant_count
  from products p
  where p.slug like 'ui-mock-%'
),
variants_to_insert as (
  select
    mp.id as product_id,
    mp.slug,
    gs.v_idx,
    case gs.v_idx
      when 1 then 'זהב'
      when 2 then 'כסף'
      else 'שחור'
    end as variant_name,
    least(
      2500::numeric,
      (
        150 + (abs(hashtext(mp.slug)) % 2201) + ((gs.v_idx - 1) * 75)
      )::numeric
    ) as price,
    5 + (abs(hashtext(mp.slug || '-v' || gs.v_idx::text)) % 21) as stock_quantity,
    'RJ-UI-MOCK-' || upper(replace(mp.slug, '-', '_')) || '-V' || gs.v_idx as sku,
    (
      select vi.image_url
      from variant_images vi
      where vi.id = 1 + (abs(hashtext(mp.slug || '-img-' || gs.v_idx::text)) % 12)
    ) as image_url
  from mock_products mp
  join lateral (
    select generate_series(1, mp.variant_count) as v_idx
  ) gs on true
)
insert into product_variants (
  product_id,
  variant_name,
  price,
  stock_quantity,
  sku,
  image_url
)
select
  vti.product_id,
  vti.variant_name,
  vti.price,
  vti.stock_quantity,
  vti.sku,
  vti.image_url
from variants_to_insert vti
on conflict (sku) do nothing;

-- ------------------------------------------------------------------
-- Part D: update existing parent category images only
-- Note: this schema has categories.image_url (no thumbnail_url column).
-- ------------------------------------------------------------------
update categories c
set image_url = v.image_url
from (
  values
    ('shabbat', 'https://images.unsplash.com/photo-1514512364185-4c2b4c9f8eb5?auto=format&fit=crop&w=1400&q=80'),
    ('chagim', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1400&q=80'),
    ('tallit-tefillin-covers', 'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=1400&q=80'),
    ('tallitot', 'https://images.unsplash.com/photo-1465101178521-c1a9136a3b99?auto=format&fit=crop&w=1400&q=80'),
    ('siddurim-uvirkonim', 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1400&q=80'),
    ('kippot', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1400&q=80')
) as v(slug, image_url)
where c.slug = v.slug
  and c.parent_id is null;

commit;
