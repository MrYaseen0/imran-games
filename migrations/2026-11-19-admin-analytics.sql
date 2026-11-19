-- ============================================================================
-- Imran Games — Admin upgrade, Wave 2 (Agent 4: Data & Backend)
-- File 3 of 3: ANALYTICS (views + KPI RPC, no new tables)
-- Date: 2026-11-19 | Branch: feat/admin-upgrade
--
-- DO NOT RUN without a backup. Run one wave at a time in the Supabase
-- SQL Editor, in file order (this file AFTER admin-roles-products).
-- Owner runs the migrations; no agent runs them, and no service-role key
-- or DB password is ever asked for or stored.
--
-- IDEMPOTENT: safe to re-run (CREATE OR REPLACE / CREATE INDEX IF NOT EXISTS).
--
-- DEFINITIONS (the UI must use exactly these — do not redefine in JS)
-- - Revenue = sum of order totals with status in
--   ('Paid', 'Processing', 'Shipped', 'Delivered'). Pending orders are
--   pipeline, NOT revenue. Canceled orders count for nothing.
-- - Discounts = sum of discount_amount on non-Canceled orders.
-- - Refunds = sum of refunds.amount (attributed to the refund's own date).
-- - total_spent (customers view) = sum of order totals excluding
--   Canceled and Refunded orders (see file 1).
-- - Low-stock item = a published product with stock 1..10 (the shop
--   already calls stock <= 10 "low"). Sold out (stock = 0) is counted
--   separately and is NOT also low-stock.
-- - All dates are PKT calendar days (created_at AT TIME ZONE
--   'Asia/Karachi'). Days with no orders simply have no row — the UI
--   must fill gaps with zeros, never invent values.
-- - All views are security_invoker: they respect the caller's RLS.
--   The KPI function is SECURITY INVOKER (the default) for the same
--   reason. A Viewer sees the same numbers as an Owner (read-only,
--   but not hidden); a non-admin sees nothing, because the underlying
--   tables deny anon entirely.
--
-- PAGINATION: query the views with PostgREST range/LIMIT+OFFSET and an
-- explicit ORDER BY. The views themselves carry no LIMIT.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Revenue per day (PKT). One row per day that has at least one
--    non-Canceled order or one refund.
-- --------------------------------------------------------------------------
create or replace view public.v_revenue_daily
with (security_invoker = true) as
select
  d.day as period_date,
  coalesce(o.orders_count, 0)::int as orders_count,
  coalesce(o.revenue_pkr, 0)::int as revenue_pkr,
  coalesce(o.discounts_pkr, 0)::int as discounts_pkr,
  coalesce(r.refunds_pkr, 0)::int as refunds_pkr,
  coalesce(o.paid_count, 0)::int as paid_count
from (
  select (created_at at time zone 'Asia/Karachi')::date as day
    from public.orders
   union
  select (created_at at time zone 'Asia/Karachi')::date as day
    from public.refunds
) d
left join (
  select
    (created_at at time zone 'Asia/Karachi')::date as day,
    count(*) filter (where status <> 'Canceled')::int as orders_count,
    coalesce(sum(total) filter (where status in ('Paid', 'Processing', 'Shipped', 'Delivered')), 0)::int as revenue_pkr,
    coalesce(sum(discount_amount) filter (where status <> 'Canceled'), 0)::int as discounts_pkr,
    count(*) filter (where status in ('Paid', 'Processing', 'Shipped', 'Delivered'))::int as paid_count
    from public.orders
   group by 1
) o on o.day = d.day
left join (
  select
    (created_at at time zone 'Asia/Karachi')::date as day,
    coalesce(sum(amount), 0)::int as refunds_pkr
    from public.refunds
   group by 1
) r on r.day = d.day;

-- --------------------------------------------------------------------------
-- 2. Orders by status.
-- --------------------------------------------------------------------------
create or replace view public.v_orders_by_status
with (security_invoker = true) as
select
  status,
  count(*)::int as orders_count,
  coalesce(sum(total), 0)::int as total_pkr
from public.orders
group by status;

-- --------------------------------------------------------------------------
-- 3. Sales by category — from order_items joined to live products for the
--    category. Only non-Canceled orders. Label this "sales", never
--    "products by category" (that is a different, inventory-based chart).
-- --------------------------------------------------------------------------
create or replace view public.v_sales_by_category
with (security_invoker = true) as
select
  coalesce(p.category, 'Unknown') as category,
  coalesce(sum(oi.qty), 0)::int as items_sold,
  coalesce(sum(oi.price * oi.qty), 0)::int as revenue_pkr,
  count(distinct oi.order_id)::int as orders_count
from public.order_items oi
join public.orders o on o.id = oi.order_id and o.status <> 'Canceled'
left join public.products p on p.id = oi.product_id
group by coalesce(p.category, 'Unknown');

-- --------------------------------------------------------------------------
-- 4. Top products — non-Canceled orders only. No LIMIT in the view;
--    the UI orders by revenue_pkr desc and pages with range().
-- --------------------------------------------------------------------------
create or replace view public.v_top_products
with (security_invoker = true) as
select
  oi.product_id as product_id,
  max(oi.product_name) as product_name,
  coalesce(sum(oi.qty), 0)::int as qty_sold,
  coalesce(sum(oi.price * oi.qty), 0)::int as revenue_pkr,
  count(distinct oi.order_id)::int as orders_count
from public.order_items oi
join public.orders o on o.id = oi.order_id and o.status <> 'Canceled'
group by oi.product_id;

-- --------------------------------------------------------------------------
-- 5. Inventory summary — single row. The "Visitors" KPI does not exist:
--    the dashboard shows low_stock_count here instead.
-- --------------------------------------------------------------------------
create or replace view public.v_inventory_summary
with (security_invoker = true) as
select
  count(*)::int as total_products,
  count(*) filter (where is_published)::int as published_products,
  coalesce(sum(stock), 0)::int as stock_units,
  coalesce(sum(price * stock), 0)::int as inventory_value_pkr,
  count(*) filter (where stock = 0)::int as sold_out_count,
  count(*) filter (where is_published and stock between 1 and 10)::int as low_stock_count,
  count(*) filter (where not is_published)::int as unpublished_count
from public.products;

-- --------------------------------------------------------------------------
-- 6. Low-stock list — published products with stock 1..10.
--    Sold-out products (stock = 0) are NOT in this list.
-- --------------------------------------------------------------------------
create or replace view public.v_low_stock
with (security_invoker = true) as
select
  id as product_id,
  name,
  category,
  brand,
  price,
  stock,
  'low'::text as stock_status
from public.products
where is_published and stock between 1 and 10;

-- --------------------------------------------------------------------------
-- 7. Admin activity per day — one row per (day, action).
-- --------------------------------------------------------------------------
create or replace view public.v_admin_activity_daily
with (security_invoker = true) as
select
  (created_at at time zone 'Asia/Karachi')::date as activity_date,
  action,
  count(*)::int as action_count
from public.audit_log
group by 1, 2;

-- --------------------------------------------------------------------------
-- 8. KPI deltas — current period vs the previous period of the same
--    length, for a PKT date range [p_start, p_end] (inclusive).
--    Returns one row per metric; delta_pct is NULL when the previous
--    value is 0 (no division by zero) and for low_stock_items, which
--    is a point-in-time count with no meaningful previous value.
--    Metrics: revenue, orders, orders_paid, discounts, refunds,
--    customers, low_stock_items.
-- --------------------------------------------------------------------------
create or replace function public.get_kpi_deltas(p_start date, p_end date)
returns table (
  metric text,
  current_value numeric,
  previous_value numeric,
  delta_pct numeric
)
language sql
stable
set search_path = public
as $$
  with p as (
    select p_start as s, p_end as e, (p_end - p_start + 1) as len
  ),
  cur as (
    select
      (select coalesce(sum(total), 0) from public.orders o, p
        where o.status in ('Paid', 'Processing', 'Shipped', 'Delivered')
          and (o.created_at at time zone 'Asia/Karachi')::date between p.s and p.e) as revenue,
      (select count(*) from public.orders o, p
        where o.status <> 'Canceled'
          and (o.created_at at time zone 'Asia/Karachi')::date between p.s and p.e) as orders_cnt,
      (select count(*) from public.orders o, p
        where o.status in ('Paid', 'Processing', 'Shipped', 'Delivered')
          and (o.created_at at time zone 'Asia/Karachi')::date between p.s and p.e) as paid_cnt,
      (select coalesce(sum(discount_amount), 0) from public.orders o, p
        where o.status <> 'Canceled'
          and (o.created_at at time zone 'Asia/Karachi')::date between p.s and p.e) as discounts,
      (select coalesce(sum(amount), 0) from public.refunds r, p
        where (r.created_at at time zone 'Asia/Karachi')::date between p.s and p.e) as refunds,
      (select count(distinct phone) from public.orders o, p
        where o.status <> 'Canceled'
          and (o.created_at at time zone 'Asia/Karachi')::date between p.s and p.e) as customers_cnt
  ),
  prev as (
    select
      (select coalesce(sum(total), 0) from public.orders o, p
        where o.status in ('Paid', 'Processing', 'Shipped', 'Delivered')
          and (o.created_at at time zone 'Asia/Karachi')::date between p.s - p.len and p.s - 1) as revenue,
      (select count(*) from public.orders o, p
        where o.status <> 'Canceled'
          and (o.created_at at time zone 'Asia/Karachi')::date between p.s - p.len and p.s - 1) as orders_cnt,
      (select count(*) from public.orders o, p
        where o.status in ('Paid', 'Processing', 'Shipped', 'Delivered')
          and (o.created_at at time zone 'Asia/Karachi')::date between p.s - p.len and p.s - 1) as paid_cnt,
      (select coalesce(sum(discount_amount), 0) from public.orders o, p
        where o.status <> 'Canceled'
          and (o.created_at at time zone 'Asia/Karachi')::date between p.s - p.len and p.s - 1) as discounts,
      (select coalesce(sum(amount), 0) from public.refunds r, p
        where (r.created_at at time zone 'Asia/Karachi')::date between p.s - p.len and p.s - 1) as refunds,
      (select count(distinct phone) from public.orders o, p
        where o.status <> 'Canceled'
          and (o.created_at at time zone 'Asia/Karachi')::date between p.s - p.len and p.s - 1) as customers_cnt
  ),
  low as (
    select count(*)::numeric as low_stock_items
      from public.products
     where is_published and stock between 1 and 10
  )
  select 'revenue', cur.revenue, prev.revenue,
    case when prev.revenue = 0 then null
         else round(100.0 * (cur.revenue - prev.revenue) / prev.revenue, 1) end
    from cur, prev
  union all
  select 'orders', cur.orders_cnt, prev.orders_cnt,
    case when prev.orders_cnt = 0 then null
         else round(100.0 * (cur.orders_cnt - prev.orders_cnt) / prev.orders_cnt, 1) end
    from cur, prev
  union all
  select 'orders_paid', cur.paid_cnt, prev.paid_cnt,
    case when prev.paid_cnt = 0 then null
         else round(100.0 * (cur.paid_cnt - prev.paid_cnt) / prev.paid_cnt, 1) end
    from cur, prev
  union all
  select 'discounts', cur.discounts, prev.discounts,
    case when prev.discounts = 0 then null
         else round(100.0 * (cur.discounts - prev.discounts) / prev.discounts, 1) end
    from cur, prev
  union all
  select 'refunds', cur.refunds, prev.refunds,
    case when prev.refunds = 0 then null
         else round(100.0 * (cur.refunds - prev.refunds) / prev.refunds, 1) end
    from cur, prev
  union all
  select 'customers', cur.customers_cnt, prev.customers_cnt,
    case when prev.customers_cnt = 0 then null
         else round(100.0 * (cur.customers_cnt - prev.customers_cnt) / prev.customers_cnt, 1) end
    from cur, prev
  union all
  select 'low_stock_items', low.low_stock_items, null::numeric, null::numeric
    from low;
$$;

-- --------------------------------------------------------------------------
-- 9. Indexes for the analytics queries (distinct names, so the rollback
--    cannot drop a pre-existing index).
-- --------------------------------------------------------------------------
create index if not exists ig_admin_analytics_orders_created on public.orders (created_at desc);
create index if not exists ig_admin_analytics_orders_status on public.orders (status);
create index if not exists ig_admin_analytics_refunds_created on public.refunds (created_at desc);
create index if not exists ig_admin_analytics_products_category on public.products (category);
create index if not exists ig_admin_analytics_products_stock on public.products (stock);
create index if not exists ig_admin_analytics_audit_created on public.audit_log (created_at desc);

-- --------------------------------------------------------------------------
-- 10. Grants — authenticated only (RLS on the underlying tables still
--     applies through the security_invoker views).
-- --------------------------------------------------------------------------
grant select on public.v_revenue_daily, public.v_orders_by_status,
  public.v_sales_by_category, public.v_top_products,
  public.v_inventory_summary, public.v_low_stock,
  public.v_admin_activity_daily to authenticated;
grant execute on function public.get_kpi_deltas(date, date) to authenticated;

-- End of file 3 (last migration in Wave 2).
-- Rollback: 2026-11-19-admin-analytics-rollback.sql
