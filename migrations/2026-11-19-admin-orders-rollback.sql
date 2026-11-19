-- ============================================================================
-- ROLLBACK for 2026-11-19-admin-orders.sql (Wave 2, Agent 4)
-- Date: 2026-11-19 | Branch: feat/admin-upgrade
--
-- DO NOT RUN without a backup. Run rollbacks in REVERSE order:
--   1. 2026-11-19-admin-analytics-rollback.sql
--   2. 2026-11-19-admin-roles-products-rollback.sql
--   3. this file
-- (By the time this runs, the analytics views and the role policies that
-- depend on file 1 must already be gone.)
--
-- WARNING — DATA LOSS: this drops the new tables. Every manually added
-- order, refund, coupon, category row and notification created after
-- file 1 was applied is DELETED by this rollback. Export them first if
-- they matter. Dropping the added orders columns also discards
-- order numbers, discounts, delivery fees, notes and stock flags.
--
-- WARNING — RESTORED POLICIES: the two anon INSERT policies restored at
-- the end are the PRE-EXISTING state (from supabase.sql), not a
-- recommendation. They were flagged in the audit as a discrepancy
-- (live RLS was reported to block anon order INSERTs). After a rollback,
-- re-verify live behaviour before trusting either state.
-- ============================================================================

-- Views / functions defined in file 1.
drop view if exists public.customers;
drop function if exists public.recalc_order_totals(uuid);
drop function if exists public.set_order_number() cascade;
drop function if exists public.next_order_number(date);

-- Triggers created by file 1 (set_updated_at itself is dropped last,
-- after file 2's triggers are already gone — see reverse order above).
drop trigger if exists trg_orders_set_updated_at on public.orders;
drop trigger if exists trg_coupons_set_updated_at on public.coupons;

-- New tables (reverse order of creation; order_items is dropped with
-- the orders columns step below — it existed before file 1, so only its
-- added column is removed, not the table itself).
drop table if exists public.notifications cascade;
drop table if exists public.categories cascade;
drop table if exists public.coupons cascade;
drop table if exists public.refunds cascade;

-- Undo the file-1 policy changes on orders / order_items.
drop policy if exists "orders_admin_all" on public.orders;
drop policy if exists "order_items_admin_all" on public.order_items;

-- Remove columns file 1 added to the legacy tables.
alter table public.orders
  drop column if exists order_number,
  drop column if exists subtotal,
  drop column if exists discount_amount,
  drop column if exists discount_code,
  drop column if exists delivery_fee,
  drop column if exists notes,
  drop column if exists deduct_stock,
  drop column if exists stock_deducted,
  drop column if exists created_by,
  drop column if exists updated_at;

alter table public.order_items drop column if exists created_at;

alter table public.orders drop constraint if exists ig_orders_status_check;
alter table public.orders drop constraint if exists ig_orders_payment_check;
alter table public.orders drop constraint if exists ig_orders_amounts_check;
alter table public.order_items drop constraint if exists ig_order_items_qty_check;

-- Indexes created by file 1.
drop index if exists public.ig_admin_orders_created_at;
drop index if exists public.ig_admin_orders_status;
drop index if exists public.ig_admin_orders_phone;
drop index if exists public.ig_admin_order_items_order;
drop index if exists public.ig_admin_order_items_product;
drop index if exists public.ig_admin_refunds_order;

-- Restore the pre-migration anon INSERT policies (see WARNING above).
-- The legacy table definitions (id, customer_name, phone, address, city,
-- payment_method, total, status, created_at) are left as they were.
do $$ begin
  create policy "orders insertable by everyone" on public.orders
    for insert with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "order_items insertable by everyone" on public.order_items
    for insert with check (true);
exception when duplicate_object then null; end $$;

-- Last: the shared helper. Only drop it here (not in the file-2 rollback),
-- because file 2's triggers depend on it until file 2 is rolled back.
drop function if exists public.set_updated_at() cascade;

-- End of rollback for file 1.
