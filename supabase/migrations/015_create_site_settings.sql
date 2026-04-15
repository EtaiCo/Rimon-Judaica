-- Site settings for lightweight CMS-style configurable values.
-- Enables dynamic storefront content (for example, homepage hero image URL)
-- without requiring a frontend redeploy.

create table if not exists public.site_settings (
  key text primary key,
  value text not null
);

alter table public.site_settings enable row level security;

create policy "anon_select_site_settings"
  on public.site_settings for select to anon using (true);

create policy "service_all_site_settings"
  on public.site_settings for all to service_role using (true) with check (true);

-- Manual setup after uploading the asset to `site-assets` bucket:
-- insert into public.site_settings (key, value)
-- values ('hero_home_url', '<PUBLIC_URL_OF_HeroImageRimon.jpg>')
-- on conflict (key) do update set value = excluded.value;
