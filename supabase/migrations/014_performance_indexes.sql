-- Performance index pass for high-frequency API query paths.
-- This migration is non-breaking and does not alter table shape or data.

-- Search-ready support for future partial-text endpoints.
create extension if not exists pg_trgm;

-- Orders list endpoint: where user_id = ? order by created_at desc.
create index if not exists idx_orders_user_created_desc
  on public.orders using btree (user_id, created_at desc);

-- Wishlist list endpoint: where user_id = ? order by created_at desc.
create index if not exists idx_wishlist_user_created_desc
  on public.wishlist using btree (user_id, created_at desc);

-- Cart list endpoint: where user_id = ? order by created_at asc.
create index if not exists idx_cart_items_user_created_asc
  on public.cart_items using btree (user_id, created_at asc);

-- Category products endpoint: where category_id = ? and sub_category_id = ? order by name.
create index if not exists idx_products_category_sub_name
  on public.products using btree (category_id, sub_category_id, name);

-- Parent-category fallback endpoint: where category_id = ? order by name.
create index if not exists idx_products_category_name
  on public.products using btree (category_id, name);

-- Sub-category fetch for header/menu composition: where category_id in (...) order by name.
create index if not exists idx_sub_categories_category_name
  on public.sub_categories using btree (category_id, name);

-- Search-ready trigram indexes for future non-prefix text matching.
create index if not exists idx_products_name_trgm
  on public.products using gin (name gin_trgm_ops);

create index if not exists idx_products_description_trgm
  on public.products using gin (description gin_trgm_ops);

create index if not exists idx_categories_name_trgm
  on public.categories using gin (name gin_trgm_ops);

create index if not exists idx_sub_categories_name_trgm
  on public.sub_categories using gin (name gin_trgm_ops);
