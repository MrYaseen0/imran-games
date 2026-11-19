-- ==========================================================================
-- Imran Games — Wave 5: product images (deal price + Storage bucket)
-- Date: 2026-11-19 | Branch: main (merged admin upgrade)
-- Run: python3 ~/workspace/custom-connectors/custom.legacy-supabase/bin/supabase.py
--      query vnbaizpqucimomrfvfpd migrations/2026-11-19-product-images.sql
-- Backup first: ~/workspace/imran-games-admin-backup/2026-11-19-wave5-pre-migration/
-- (products 42, audit_log 84, orders 0 — verified live before running.)
--
-- What this does (additive + idempotent — safe to re-run):
--   1. Adds ONLY the missing column `deal_price` to products.
--   2. Makes sure `products` is in the supabase_realtime publication
--      (it already is — the guard below is a no-op on re-run).
--   3. Makes sure the `product-images` bucket exists (public) with
--      8 MB / jpg+png+webp limits enforced server-side.
--   4. Replaces the three permissive storage write policies (anyone
--      could upload/delete — bucket_id check only) with admin-gated
--      ones: public SELECT, INSERT/UPDATE/DELETE only when is_admin().
--      The public products SELECT policy is NOT touched.
-- Rollback: migrations/2026-11-19-product-images-rollback.sql
-- ==========================================================================

-- 1. deal_price (nullable; NULL = no deal). All other product columns
--    already exist (name, brand, category, price, was_price, stock,
--    is_hot, is_new, image_urls, version).
alter table public.products
  add column if not exists deal_price numeric
  constraint products_deal_price_positive check (deal_price is null or deal_price > 0);

-- 2. Realtime on products (guarded — re-running is safe).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'products'
  ) then
    execute 'alter publication supabase_realtime add table public.products';
  end if;
end $$;

-- 3. Bucket (already exists — upsert keeps it public and sets limits).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 8388608,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 4. Storage policies — replace the permissive ones with admin-gated ones.
--    Old policies (dropped here, restored by the rollback):
--      "product images upload by admin"  INSERT, public, bucket check only
--      "product images update by admin"  UPDATE, public, bucket check only
--      "product images delete by admin"  DELETE, public, bucket check only
drop policy if exists "product images upload by admin" on storage.objects;
drop policy if exists "product images update by admin" on storage.objects;
drop policy if exists "product images delete by admin" on storage.objects;
drop policy if exists "product_images_select_public" on storage.objects;
drop policy if exists "product_images_insert_admin" on storage.objects;
drop policy if exists "product_images_update_admin" on storage.objects;
drop policy if exists "product_images_delete_admin" on storage.objects;

create policy "product_images_select_public" on storage.objects
  for select to public
  using (bucket_id = 'product-images');

create policy "product_images_insert_admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and is_admin());

create policy "product_images_update_admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and is_admin())
  with check (bucket_id = 'product-images' and is_admin());

create policy "product_images_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and is_admin());
