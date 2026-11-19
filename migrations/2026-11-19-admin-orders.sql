-- ============================================================================
-- Imran Games — Admin upgrade, Wave 2 (Agent 4: Data & Backend)
-- File 1 of 3: ORDERS (manual "+ Add Order" records only)
-- Date: 2026-11-19 | Branch: feat/admin-upgrade
--
-- DO NOT RUN without a backup. Run one wave at a time in the Supabase
-- SQL Editor, in file order:
--   1. 2026-11-19-admin-orders.sql        (this file)
--   2. 2026-11-19-admin-roles-products.sql
--   3. 2026-11-19-admin-analytics.sql
-- Owner runs the migrations; no agent runs them, and no service-role key
-- or DB password is ever asked for or stored.
--
-- IDEMPOTENT: safe to re-run. Uses IF NOT EXISTS / CREATE OR REPLACE /
-- ON CONFLICT DO NOTHING and guarded DO blocks throughout.
--
-- WHAT THIS DOES
-- - Replaces the legacy schema-only `orders` / `order_items` tables with
--   real manual-order tables. Orders come ONLY from the admin "+ Add Order"
--   form. The public shop checkout is NOT touched and NO WhatsApp order
--   is auto-saved (that is a separate later task).
-- - Adds `refunds`, `coupons`, `categories`, `notifications`.
-- - Adds a `customers` VIEW (aggregated from orders by phone) — NOT a
--   table, so there is no second source of truth for customer data.
-- - Drops the old permissive anon INSERT policies on orders/order_items
--   ("orders insertable by everyone") and replaces them with admin-only
--   policies. File 2 refines these into Owner/Manager/Viewer policies.
-- - Deliberately NOT created here: a `site_visits` table (the Visitors KPI
--   is replaced by Low-stock items), a `payments` table (payment method is
--   a field on the order), 2FA / Turnstile changes (login logic untouched).
-- ============================================================================

-- --------------------------------------------------------------------------
-- 0. Shared helper: keep `updated_at` fresh. Also used by files 2 and 3.
-- --------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- --------------------------------------------------------------------------
-- 1. orders — extend the legacy table (or create it fully on a fresh DB).
--    Existing rows: status values are normalised to Title Case first,
--    because the new CHECK constraint requires Title Case.
-- --------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique,
  customer_name text not null,
  phone text not null,
  city text not null default 'Peshawar',
  address text not null,
  payment_method text not null default 'COD',
  status text not null default 'Pending',
  subtotal int not null default 0,
  discount_amount int not null default 0,
  discount_code text,
  delivery_fee int not null default 0,
  total int not null default 0,
  notes text,
  deduct_stock boolean not null default false,
  stock_deducted boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders add column if not exists order_number text;
alter table public.orders add column if not exists subtotal int not null default 0;
alter table public.orders add column if not exists discount_amount int not null default 0;
alter table public.orders add column if not exists discount_code text;
alter table public.orders add column if not exists delivery_fee int not null default 0;
alter table public.orders add column if not exists notes text;
alter table public.orders add column if not exists deduct_stock boolean not null default false;
alter table public.orders add column if not exists stock_deducted boolean not null default false;
alter table public.orders add column if not exists created_by uuid;
alter table public.orders add column if not exists updated_at timestamptz not null default now();
-- Legacy columns that already exist keep their definitions (total, status,
-- payment_method, customer_name, phone, city, address, created_at).

-- Normalise any legacy lowercase status values before the CHECK goes on.
update public.orders set status = 'Pending'    where status = 'pending';
update public.orders set status = 'Paid'       where status = 'paid';
update public.orders set status = 'Processing' where status = 'processing';
update public.orders set status = 'Shipped'    where status = 'shipped';
update public.orders set status = 'Delivered'  where status = 'delivered';
update public.orders set status = 'Canceled'   where status in ('canceled', 'cancelled');
update public.orders set status = 'Refunded'   where status = 'refunded';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ig_orders_status_check') then
    alter table public.orders
      add constraint ig_orders_status_check
      check (status in ('Pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Canceled', 'Refunded'));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ig_orders_payment_check') then
    alter table public.orders
      add constraint ig_orders_payment_check
      check (payment_method in ('COD', 'JazzCash', 'Easypaisa', 'Bank'));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ig_orders_amounts_check') then
    alter table public.orders
      add constraint ig_orders_amounts_check
      check (subtotal >= 0 and discount_amount >= 0 and delivery_fee >= 0 and total >= 0);
  end if;
end $$;

-- Order numbers look like #IG-20261119-0001 (date + per-day sequence).
-- The advisory lock serialises generation inside a transaction; the UNIQUE
-- constraint is the backstop — on a collision the insert fails and the
-- admin form must retry (expected to be rare: manual entry only).
create or replace function public.next_order_number(p_day date default current_date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_seq int;
begin
  perform pg_advisory_xact_lock(20261119);
  v_prefix := '#IG-' || to_char(p_day, 'YYYYMMDD') || '-';
  select count(*) + 1 into v_seq
    from public.orders
   where order_number like v_prefix || '%';
  return v_prefix || lpad(v_seq::text, 4, '0');
end;
$$;

create or replace function public.set_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := public.next_order_number();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_set_order_number on public.orders;
create trigger trg_orders_set_order_number
  before insert on public.orders
  for each row execute function public.set_order_number();

drop trigger if exists trg_orders_set_updated_at on public.orders;
create trigger trg_orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Backfill an order number for any pre-existing order that lacks one
-- (uses that order's own creation date, one row at a time, in order).
do $$
declare
  r record;
begin
  for r in
    select id, created_at from public.orders
     where order_number is null
     order by created_at asc, id asc
  loop
    update public.orders
       set order_number = public.next_order_number((r.created_at)::date)
     where id = r.id;
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- 2. order_items — price / product_name are snapshots taken at order time,
--    so later product edits never rewrite history.
-- --------------------------------------------------------------------------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,
  price int not null,
  qty int not null default 1,
  created_at timestamptz not null default now()
);

alter table public.order_items add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ig_order_items_qty_check') then
    alter table public.order_items
      add constraint ig_order_items_qty_check
      check (qty >= 1 and price >= 0);
  end if;
end $$;

-- Recompute an order's subtotal/total from its items after items change.
-- The admin UI calls this after inserting/updating/deleting order items.
-- total = max(subtotal - discount_amount + delivery_fee, 0).
create or replace function public.recalc_order_totals(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal int;
  v_discount int;
  v_delivery int;
begin
  if not public.is_admin() then
    raise exception 'not admin';
  end if;
  select coalesce(sum(price * qty), 0) into v_subtotal
    from public.order_items where order_id = p_order_id;
  select discount_amount, delivery_fee into v_discount, v_delivery
    from public.orders where id = p_order_id;
  if not found then
    raise exception 'order not found';
  end if;
  update public.orders
     set subtotal = v_subtotal,
         total = greatest(v_subtotal - coalesce(v_discount, 0) + coalesce(v_delivery, 0), 0),
         updated_at = now()
   where id = p_order_id;
end;
$$;

-- --------------------------------------------------------------------------
-- 3. refunds — a record of money returned for an order. Recording a refund
--    does NOT by itself change the order status; the admin sets the order
--    to Refunded (full refund) or leaves it as-is (partial refund).
-- --------------------------------------------------------------------------
create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount int not null,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ig_refunds_amount_check') then
    alter table public.refunds
      add constraint ig_refunds_amount_check check (amount > 0);
  end if;
end $$;

-- --------------------------------------------------------------------------
-- 4. coupons — minimal. `value` is a percent (type='percent', 1-100) or a
--    flat PKR amount (type='fixed'). The order stores the APPLIED amount
--    in discount_amount and the code in discount_code; no auto-apply logic.
-- --------------------------------------------------------------------------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null default 'fixed',
  value int not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ig_coupons_type_check') then
    alter table public.coupons
      add constraint ig_coupons_type_check
      check (type in ('percent', 'fixed') and value > 0);
  end if;
end $$;

drop trigger if exists trg_coupons_set_updated_at on public.coupons;
create trigger trg_coupons_set_updated_at
  before update on public.coupons
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------------------
-- 5. categories — the canonical list for the admin filter dropdown.
--    products.category stays free text for now (no FK): the 11 existing
--    values match these names exactly, and a FK is a later step if wanted.
-- --------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

insert into public.categories (name, sort_order) values
  ('Consoles', 1),
  ('Premium Tech', 2),
  ('Controllers', 3),
  ('Headsets', 4),
  ('Racing Wheels', 5),
  ('PS4 Games', 6),
  ('PS5 Games', 7),
  ('Gift Cards', 8),
  ('Gaming Chairs', 9),
  ('Gaming Setups', 10),
  ('Room Lighting', 11)
on conflict (name) do nothing;

-- --------------------------------------------------------------------------
-- 6. notifications — minimal. Created by the admin UI / future automation;
--    this migration creates NO automatic notification triggers.
-- --------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 7. customers — a VIEW, not a table. Aggregates orders by phone so there
--    is no second source of truth. total_spent_pkr sums order totals
--    excluding Canceled and Refunded orders (delivery fee included).
--    security_invoker: the view respects the caller's RLS (admin-only).
-- --------------------------------------------------------------------------
create or replace view public.customers
with (security_invoker = true) as
select
  o.phone as phone,
  (select o2.customer_name from public.orders o2
    where o2.phone = o.phone
    order by o2.created_at desc, o2.id desc limit 1) as name,
  (select o2.city from public.orders o2
    where o2.phone = o.phone
    order by o2.created_at desc, o2.id desc limit 1) as city,
  count(*)::int as orders_count,
  coalesce(sum(case when o.status not in ('Canceled', 'Refunded') then o.total else 0 end), 0)::int as total_spent_pkr,
  max(o.created_at) as last_order_at,
  min(o.created_at) as first_order_at
from public.orders o
group by o.phone;

-- --------------------------------------------------------------------------
-- 8. RLS — admin-only for now (is_admin = row in `admins` + not locked).
--    File 2 replaces these with Owner/Manager/Viewer policies.
--    Anon gets NO policy and NO grant on any of these tables: every anon
--    read/write is denied. The old permissive anon INSERT policies are
--    dropped here (RLS policies are OR'd — adding admin-only policies
--    alone would NOT have closed the hole; this is the C-01 lesson).
-- --------------------------------------------------------------------------
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.refunds enable row level security;
alter table public.coupons enable row level security;
alter table public.categories enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "orders insertable by everyone" on public.orders;
drop policy if exists "order_items insertable by everyone" on public.order_items;

drop policy if exists "orders_admin_all" on public.orders;
create policy "orders_admin_all" on public.orders
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "order_items_admin_all" on public.order_items;
create policy "order_items_admin_all" on public.order_items
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "refunds_admin_all" on public.refunds;
create policy "refunds_admin_all" on public.refunds
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "coupons_admin_all" on public.coupons;
create policy "coupons_admin_all" on public.coupons
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "categories_admin_all" on public.categories;
create policy "categories_admin_all" on public.categories
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "notifications_admin_all" on public.notifications;
create policy "notifications_admin_all" on public.notifications
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------------
-- 9. Indexes (server-side pagination uses range/LIMIT on these).
-- --------------------------------------------------------------------------
create index if not exists ig_admin_orders_created_at on public.orders (created_at desc);
create index if not exists ig_admin_orders_status on public.orders (status);
create index if not exists ig_admin_orders_phone on public.orders (phone);
create index if not exists ig_admin_order_items_order on public.order_items (order_id);
create index if not exists ig_admin_order_items_product on public.order_items (product_id);
create index if not exists ig_admin_refunds_order on public.refunds (order_id);

-- --------------------------------------------------------------------------
-- 10. Grants — authenticated only. Anon is deliberately NOT granted
--     anything on the new tables (RLS would deny it anyway).
-- --------------------------------------------------------------------------
grant select, insert, update, delete
  on public.orders, public.order_items, public.refunds,
     public.coupons, public.categories, public.notifications
  to authenticated;
grant select on public.customers to authenticated;
grant execute on function public.next_order_number(date) to authenticated;
grant execute on function public.recalc_order_totals(uuid) to authenticated;

-- End of file 1. Next: 2026-11-19-admin-roles-products.sql
-- Rollback: 2026-11-19-admin-orders-rollback.sql (run rollbacks in
-- reverse order: analytics, then roles-products, then this file).
