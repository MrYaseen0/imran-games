-- ==========================================================================
-- ROLLBACK for migrations/2026-11-19-product-images.sql (Wave 5)
-- Run ONLY if the Wave 5 migration must be reverted. Drops ONLY what the
-- migration added; never touches existing data (products, orders, audit_log).
--
-- Deliberately NOT reverted (see the migration header):
--   - The `product-images` bucket row is NOT dropped: the bucket
--     pre-existed this migration and holds all live product photos.
--     Only its size/type limits are reset to NULL below.
--   - `products` is NOT removed from the supabase_realtime publication:
--     it was already a member BEFORE this migration (the shop's live
--     updates depend on it). Removing it would break the shop.
--   - The public products SELECT policy is untouched either way.
-- ==========================================================================

-- 1. Remove the deal_price column (NULL on every row until an admin sets one).
alter table public.products drop column if exists deal_price;

-- 2. Drop the admin-gated storage policies added by the migration.
drop policy if exists "product_images_select_public" on storage.objects;
drop policy if exists "product_images_insert_admin" on storage.objects;
drop policy if exists "product_images_update_admin" on storage.objects;
drop policy if exists "product_images_delete_admin" on storage.objects;

-- 3. Restore the three permissive policies exactly as they were before
--    the migration (bucket check only, role public).
create policy "product images upload by admin" on storage.objects
  for insert to public
  with check (bucket_id = 'product-images');

create policy "product images update by admin" on storage.objects
  for update to public
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

create policy "product images delete by admin" on storage.objects
  for delete to public
  using (bucket_id = 'product-images');

-- 4. Reset the bucket size/type limits (bucket row itself stays).
update storage.buckets
  set file_size_limit = null, allowed_mime_types = null
  where id = 'product-images';
