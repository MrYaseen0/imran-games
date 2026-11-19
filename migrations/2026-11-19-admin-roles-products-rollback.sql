-- ============================================================================
-- ROLLBACK for 2026-11-19-admin-roles-products.sql (Wave 2, Agent 4)
-- Date: 2026-11-19 | Branch: feat/admin-upgrade
--
-- DO NOT RUN without a backup. Run rollbacks in REVERSE order:
--   1. 2026-11-19-admin-analytics-rollback.sql
--   2. this file
--   3. 2026-11-19-admin-orders-rollback.sql
-- (By the time this runs, the analytics views/RPCs that read these
-- tables must already be gone.)
--
-- WARNING — DATA LOSS: dropping the product columns discards any
-- descriptions, SKUs, publish flags, ratings and review counts entered
-- after file 2 was applied. Dropping admin_profiles discards every
-- role assignment (the `admins` table itself is NOT touched — admin
-- status survives; only roles are lost). Export first if they matter.
-- ============================================================================

-- Stock functions defined in file 2.
drop function if exists public.deduct_stock_for_order(uuid);
drop function if exists public.restore_stock_for_order(uuid);
drop function if exists public.admin_role();

-- Product trigger + columns added by file 2.
drop trigger if exists trg_products_set_updated_at on public.products;
drop index if exists public.ig_admin_products_sku_unique;
alter table public.products drop constraint if exists ig_products_rating_check;
alter table public.products drop constraint if exists ig_products_review_count_check;
alter table public.products
  drop column if exists description,
  drop column if exists sku,
  drop column if exists is_published,
  drop column if exists rating,
  drop column if exists review_count,
  drop column if exists updated_at;

-- Restore the file-1 admin-only policies on the order tables.
-- (The role policies are dropped first, below.)
drop policy if exists "orders_select_roles" on public.orders;
drop policy if exists "orders_write_manager" on public.orders;
drop policy if exists "orders_update_manager" on public.orders;
drop policy if exists "orders_delete_owner" on public.orders;
drop policy if exists "orders_admin_all" on public.orders;
create policy "orders_admin_all" on public.orders
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "order_items_select_roles" on public.order_items;
drop policy if exists "order_items_write_manager" on public.order_items;
drop policy if exists "order_items_update_manager" on public.order_items;
drop policy if exists "order_items_delete_owner" on public.order_items;
drop policy if exists "order_items_admin_all" on public.order_items;
create policy "order_items_admin_all" on public.order_items
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "refunds_select_roles" on public.refunds;
drop policy if exists "refunds_write_manager" on public.refunds;
drop policy if exists "refunds_update_manager" on public.refunds;
drop policy if exists "refunds_delete_owner" on public.refunds;
drop policy if exists "refunds_admin_all" on public.refunds;
create policy "refunds_admin_all" on public.refunds
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "coupons_select_roles" on public.coupons;
drop policy if exists "coupons_write_manager" on public.coupons;
drop policy if exists "coupons_update_manager" on public.coupons;
drop policy if exists "coupons_delete_owner" on public.coupons;
drop policy if exists "coupons_admin_all" on public.coupons;
create policy "coupons_admin_all" on public.coupons
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "categories_select_roles" on public.categories;
drop policy if exists "categories_write_manager" on public.categories;
drop policy if exists "categories_update_manager" on public.categories;
drop policy if exists "categories_delete_owner" on public.categories;
drop policy if exists "categories_admin_all" on public.categories;
create policy "categories_admin_all" on public.categories
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "notifications_select_roles" on public.notifications;
drop policy if exists "notifications_write_manager" on public.notifications;
drop policy if exists "notifications_update_manager" on public.notifications;
drop policy if exists "notifications_delete_owner" on public.notifications;
drop policy if exists "notifications_admin_all" on public.notifications;
create policy "notifications_admin_all" on public.notifications
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Restore the single admin write policy on products (the public SELECT
-- policy was never touched and stays as it is).
drop policy if exists "products_insert_manager" on public.products;
drop policy if exists "products_update_manager" on public.products;
drop policy if exists "products_delete_owner" on public.products;
drop policy if exists "products_write_admin" on public.products;
create policy "products_write_admin" on public.products
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Drop the roles table itself (trigger + constraint go with it).
drop trigger if exists trg_admin_profiles_set_updated_at on public.admin_profiles;
drop table if exists public.admin_profiles cascade;

-- End of rollback for file 2.
