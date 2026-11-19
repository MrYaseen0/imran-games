-- ============================================================================
-- Imran Games — Admin upgrade, Wave 2 (Agent 4: Data & Backend)
-- File 2 of 3: ROLES + PRODUCTS
-- Date: 2026-11-19 | Branch: feat/admin-upgrade
--
-- DO NOT RUN without a backup. Run one wave at a time in the Supabase
-- SQL Editor, in file order (this file AFTER admin-orders, BEFORE
-- admin-analytics). Owner runs the migrations; no agent runs them, and
-- no service-role key or DB password is ever asked for or stored.
--
-- IDEMPOTENT: safe to re-run (IF NOT EXISTS / CREATE OR REPLACE /
-- ON CONFLICT DO NOTHING / DROP POLICY IF EXISTS).
--
-- WHAT THIS DOES
-- - Adds `admin_profiles` (Owner / Manager / Viewer) and seeds it from
--   the existing `admins` table: every current admin becomes Owner.
--   ONLY the Owner account is created now — no other user id or email
--   is invented anywhere in this file.
-- - Adds `admin_role()` and replaces the file-1 admin-only policies with
--   role-differentiated policies. Every policy ALSO requires
--   `is_admin()` (row in `admins` + not locked), so the H-03 lockout
--   keeps working and a profile alone grants nothing.
-- - Adds the missing product columns (description, sku, is_published,
--   rating, review_count, updated_at). Rating stays NULL and
--   review_count stays 0 until real reviews exist — never fake stars.
-- - Adds the manual-order stock functions: deducting stock for an
--   order is a PERMANENT decrement (not a 15-minute reserve_stock hold,
--   which belongs to the shop checkout only). See DATA.md for the flow.
-- - Does NOT touch login / CAPTCHA / auth code in any way.
--
-- ROLE MATRIX (enforced by RLS, not just by hiding UI)
--   Viewer : read everything admin-visible, write nothing.
--   Manager: read everything; INSERT/UPDATE orders, order_items,
--            refunds, coupons, categories, notifications, products.
--            DELETE is Owner-only (deleting destroys the audit trail;
--            a Manager cancels an order via status instead).
--   Owner  : everything, plus manage admin_profiles (add/remove roles).
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. admin_profiles — one row per admin, role-checked.
-- --------------------------------------------------------------------------
create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ig_admin_profiles_role_check') then
    alter table public.admin_profiles
      add constraint ig_admin_profiles_role_check
      check (role in ('owner', 'manager', 'viewer'));
  end if;
end $$;

-- Seed ONLY from the existing admins table. No user id or email is
-- invented here; if `admins` is empty, nothing is seeded.
insert into public.admin_profiles (user_id, role)
select user_id, 'owner' from public.admins
on conflict (user_id) do nothing;

-- NOTE: every row in `admins` should have a matching row here. If a new
-- admin is ever added to `admins`, add their profile row too (Owner only,
-- via the Settings page) or they will have NO role and every role policy
-- below will deny them.

drop trigger if exists trg_admin_profiles_set_updated_at on public.admin_profiles;
create trigger trg_admin_profiles_set_updated_at
  before update on public.admin_profiles
  for each row execute function public.set_updated_at();

-- Returns the caller's role, or NULL when they have no profile.
-- SECURITY DEFINER so RLS on admin_profiles cannot block the lookup
-- (and so policies can call it without recursion).
create or replace function public.admin_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.admin_profiles where user_id = auth.uid()
$$;

-- --------------------------------------------------------------------------
-- 2. RLS for admin_profiles itself.
--    Any admin role may read the roster; only Owner may change it.
-- --------------------------------------------------------------------------
alter table public.admin_profiles enable row level security;

drop policy if exists "admin_profiles_select_roles" on public.admin_profiles;
create policy "admin_profiles_select_roles" on public.admin_profiles
  for select to authenticated
  using (public.is_admin() and public.admin_role() is not null);

drop policy if exists "admin_profiles_write_owner" on public.admin_profiles;
create policy "admin_profiles_write_owner" on public.admin_profiles
  for all to authenticated
  using (public.is_admin() and public.admin_role() = 'owner')
  with check (public.is_admin() and public.admin_role() = 'owner');

-- --------------------------------------------------------------------------
-- 3. Replace the file-1 admin-only policies with role policies.
--    Pattern per table: SELECT = any role; INSERT/UPDATE = Owner/Manager;
--    DELETE = Owner only. Anon has no policy on any of these tables.
-- --------------------------------------------------------------------------

-- orders
drop policy if exists "orders_admin_all" on public.orders;
drop policy if exists "orders_select_roles" on public.orders;
create policy "orders_select_roles" on public.orders
  for select to authenticated
  using (public.is_admin() and public.admin_role() is not null);
drop policy if exists "orders_write_manager" on public.orders;
create policy "orders_write_manager" on public.orders
  for insert to authenticated
  with check (public.is_admin() and public.admin_role() in ('owner', 'manager'));
drop policy if exists "orders_update_manager" on public.orders;
create policy "orders_update_manager" on public.orders
  for update to authenticated
  using (public.is_admin() and public.admin_role() in ('owner', 'manager'))
  with check (public.is_admin() and public.admin_role() in ('owner', 'manager'));
drop policy if exists "orders_delete_owner" on public.orders;
create policy "orders_delete_owner" on public.orders
  for delete to authenticated
  using (public.is_admin() and public.admin_role() = 'owner');

-- order_items
drop policy if exists "order_items_admin_all" on public.order_items;
drop policy if exists "order_items_select_roles" on public.order_items;
create policy "order_items_select_roles" on public.order_items
  for select to authenticated
  using (public.is_admin() and public.admin_role() is not null);
drop policy if exists "order_items_write_manager" on public.order_items;
create policy "order_items_write_manager" on public.order_items
  for insert to authenticated
  with check (public.is_admin() and public.admin_role() in ('owner', 'manager'));
drop policy if exists "order_items_update_manager" on public.order_items;
create policy "order_items_update_manager" on public.order_items
  for update to authenticated
  using (public.is_admin() and public.admin_role() in ('owner', 'manager'))
  with check (public.is_admin() and public.admin_role() in ('owner', 'manager'));
drop policy if exists "order_items_delete_owner" on public.order_items;
create policy "order_items_delete_owner" on public.order_items
  for delete to authenticated
  using (public.is_admin() and public.admin_role() = 'owner');

-- refunds
drop policy if exists "refunds_admin_all" on public.refunds;
drop policy if exists "refunds_select_roles" on public.refunds;
create policy "refunds_select_roles" on public.refunds
  for select to authenticated
  using (public.is_admin() and public.admin_role() is not null);
drop policy if exists "refunds_write_manager" on public.refunds;
create policy "refunds_write_manager" on public.refunds
  for insert to authenticated
  with check (public.is_admin() and public.admin_role() in ('owner', 'manager'));
drop policy if exists "refunds_update_manager" on public.refunds;
create policy "refunds_update_manager" on public.refunds
  for update to authenticated
  using (public.is_admin() and public.admin_role() in ('owner', 'manager'))
  with check (public.is_admin() and public.admin_role() in ('owner', 'manager'));
drop policy if exists "refunds_delete_owner" on public.refunds;
create policy "refunds_delete_owner" on public.refunds
  for delete to authenticated
  using (public.is_admin() and public.admin_role() = 'owner');

-- coupons
drop policy if exists "coupons_admin_all" on public.coupons;
drop policy if exists "coupons_select_roles" on public.coupons;
create policy "coupons_select_roles" on public.coupons
  for select to authenticated
  using (public.is_admin() and public.admin_role() is not null);
drop policy if exists "coupons_write_manager" on public.coupons;
create policy "coupons_write_manager" on public.coupons
  for insert to authenticated
  with check (public.is_admin() and public.admin_role() in ('owner', 'manager'));
drop policy if exists "coupons_update_manager" on public.coupons;
create policy "coupons_update_manager" on public.coupons
  for update to authenticated
  using (public.is_admin() and public.admin_role() in ('owner', 'manager'))
  with check (public.is_admin() and public.admin_role() in ('owner', 'manager'));
drop policy if exists "coupons_delete_owner" on public.coupons;
create policy "coupons_delete_owner" on public.coupons
  for delete to authenticated
  using (public.is_admin() and public.admin_role() = 'owner');

-- categories
drop policy if exists "categories_admin_all" on public.categories;
drop policy if exists "categories_select_roles" on public.categories;
create policy "categories_select_roles" on public.categories
  for select to authenticated
  using (public.is_admin() and public.admin_role() is not null);
drop policy if exists "categories_write_manager" on public.categories;
create policy "categories_write_manager" on public.categories
  for insert to authenticated
  with check (public.is_admin() and public.admin_role() in ('owner', 'manager'));
drop policy if exists "categories_update_manager" on public.categories;
create policy "categories_update_manager" on public.categories
  for update to authenticated
  using (public.is_admin() and public.admin_role() in ('owner', 'manager'))
  with check (public.is_admin() and public.admin_role() in ('owner', 'manager'));
drop policy if exists "categories_delete_owner" on public.categories;
create policy "categories_delete_owner" on public.categories
  for delete to authenticated
  using (public.is_admin() and public.admin_role() = 'owner');

-- notifications
drop policy if exists "notifications_admin_all" on public.notifications;
drop policy if exists "notifications_select_roles" on public.notifications;
create policy "notifications_select_roles" on public.notifications
  for select to authenticated
  using (public.is_admin() and public.admin_role() is not null);
drop policy if exists "notifications_write_manager" on public.notifications;
create policy "notifications_write_manager" on public.notifications
  for insert to authenticated
  with check (public.is_admin() and public.admin_role() in ('owner', 'manager'));
drop policy if exists "notifications_update_manager" on public.notifications;
create policy "notifications_update_manager" on public.notifications
  for update to authenticated
  using (public.is_admin() and public.admin_role() in ('owner', 'manager'))
  with check (public.is_admin() and public.admin_role() in ('owner', 'manager'));
drop policy if exists "notifications_delete_owner" on public.notifications;
create policy "notifications_delete_owner" on public.notifications
  for delete to authenticated
  using (public.is_admin() and public.admin_role() = 'owner');

-- --------------------------------------------------------------------------
-- 4. Products — replace the single admin write policy with role policies.
--    The PUBLIC SELECT policy ("products readable by everyone") is NOT
--    touched: the shop must keep reading the catalogue anonymously.
-- --------------------------------------------------------------------------
drop policy if exists "products_write_admin" on public.products;

drop policy if exists "products_insert_manager" on public.products;
create policy "products_insert_manager" on public.products
  for insert to authenticated
  with check (public.is_admin() and public.admin_role() in ('owner', 'manager'));

drop policy if exists "products_update_manager" on public.products;
create policy "products_update_manager" on public.products
  for update to authenticated
  using (public.is_admin() and public.admin_role() in ('owner', 'manager'))
  with check (public.is_admin() and public.admin_role() in ('owner', 'manager'));

drop policy if exists "products_delete_owner" on public.products;
create policy "products_delete_owner" on public.products
  for delete to authenticated
  using (public.is_admin() and public.admin_role() = 'owner');

-- --------------------------------------------------------------------------
-- 5. Product columns. Rating is NULL (not 0, not a guessed value) and
--    review_count is 0 until real reviews exist. is_published defaults
--    to true so every existing product stays visible on the shop.
-- --------------------------------------------------------------------------
alter table public.products add column if not exists description text;
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists is_published boolean not null default true;
alter table public.products add column if not exists rating numeric;
alter table public.products add column if not exists review_count int not null default 0;
alter table public.products add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ig_products_rating_check') then
    alter table public.products
      add constraint ig_products_rating_check
      check (rating is null or (rating >= 0 and rating <= 5));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ig_products_review_count_check') then
    alter table public.products
      add constraint ig_products_review_count_check
      check (review_count >= 0);
  end if;
end $$;

-- SKU unique, but only when set (many products have no SKU yet).
create unique index if not exists ig_admin_products_sku_unique
  on public.products (sku) where sku is not null;

drop trigger if exists trg_products_set_updated_at on public.products;
create trigger trg_products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------------------
-- 6. Manual-order stock functions.
--    These are PERMANENT deductions for admin-created orders — NOT the
--    shop's 15-minute reserve_stock holds. Never call reserve_stock()
--    for a manual order (it would create a reservation row that expires
--    and restores the stock after 15 minutes).
--    - deduct_stock_for_order: only when the order's deduct_stock flag
--      is true and stock has not already been deducted (stock_deducted
--      guard makes repeat calls a safe no-op returning true).
--      Decrements each item's product stock, or raises an exception and
--      changes NOTHING (single transaction) when any item lacks stock.
--    - restore_stock_for_order: adds the quantities back, only when
--      stock_deducted is true; otherwise a safe no-op returning false.
--    Both require Owner or Manager. Viewer calls are rejected.
-- --------------------------------------------------------------------------
create or replace function public.deduct_stock_for_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deduct boolean;
  v_deducted boolean;
  r record;
  v_rows int;
begin
  if not public.is_admin() or public.admin_role() not in ('owner', 'manager') then
    raise exception 'not allowed';
  end if;
  select deduct_stock, stock_deducted into v_deduct, v_deducted
    from public.orders where id = p_order_id;
  if not found then
    raise exception 'order not found';
  end if;
  if not coalesce(v_deduct, false) then
    return false; -- deduct_stock toggle was off: stock stays untouched
  end if;
  if coalesce(v_deducted, false) then
    return true; -- already deducted: idempotent no-op
  end if;
  for r in
    select product_id, qty from public.order_items
     where order_id = p_order_id and product_id is not null
  loop
    update public.products
       set stock = stock - r.qty
     where id = r.product_id and stock >= r.qty;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      raise exception 'insufficient stock for product %', r.product_id;
    end if;
  end loop;
  update public.orders
     set stock_deducted = true, updated_at = now()
   where id = p_order_id;
  return true;
end;
$$;

create or replace function public.restore_stock_for_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deducted boolean;
  r record;
begin
  if not public.is_admin() or public.admin_role() not in ('owner', 'manager') then
    raise exception 'not allowed';
  end if;
  select stock_deducted into v_deducted
    from public.orders where id = p_order_id;
  if not found then
    raise exception 'order not found';
  end if;
  if not coalesce(v_deducted, false) then
    return false; -- nothing was deducted: nothing to restore
  end if;
  for r in
    select product_id, qty from public.order_items
     where order_id = p_order_id and product_id is not null
  loop
    update public.products
       set stock = stock + r.qty
     where id = r.product_id;
  end loop;
  update public.orders
     set stock_deducted = false, updated_at = now()
   where id = p_order_id;
  return true;
end;
$$;

-- --------------------------------------------------------------------------
-- 7. Grants — authenticated only; anon gets nothing on admin_profiles.
-- --------------------------------------------------------------------------
grant select, insert, update, delete on public.admin_profiles to authenticated;
grant execute on function public.admin_role() to authenticated;
grant execute on function public.deduct_stock_for_order(uuid) to authenticated;
grant execute on function public.restore_stock_for_order(uuid) to authenticated;

-- End of file 2. Next: 2026-11-19-admin-analytics.sql
-- Rollback: 2026-11-19-admin-roles-products-rollback.sql (run rollbacks
-- in reverse order: analytics, then this file, then admin-orders).
