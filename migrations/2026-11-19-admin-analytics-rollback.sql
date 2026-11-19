-- ============================================================================
-- ROLLBACK for 2026-11-19-admin-analytics.sql (Wave 2, Agent 4)
-- Date: 2026-11-19 | Branch: feat/admin-upgrade
--
-- DO NOT RUN without a backup. Run rollbacks in REVERSE order:
--   1. this file
--   2. 2026-11-19-admin-roles-products-rollback.sql
--   3. 2026-11-19-admin-orders-rollback.sql
--
-- This rollback only drops what file 3 created (views, one function,
-- indexes with ig_admin_analytics_ names). No table data is lost.
-- After this rollback the dashboard falls back to the pre-upgrade
-- client-side analytics (live inventory numbers computed in JS).
-- ============================================================================

drop function if exists public.get_kpi_deltas(date, date);
drop view if exists public.v_admin_activity_daily;
drop view if exists public.v_low_stock;
drop view if exists public.v_inventory_summary;
drop view if exists public.v_top_products;
drop view if exists public.v_sales_by_category;
drop view if exists public.v_orders_by_status;
drop view if exists public.v_revenue_daily;

drop index if exists public.ig_admin_analytics_orders_created;
drop index if exists public.ig_admin_analytics_orders_status;
drop index if exists public.ig_admin_analytics_refunds_created;
drop index if exists public.ig_admin_analytics_products_category;
drop index if exists public.ig_admin_analytics_products_stock;
drop index if exists public.ig_admin_analytics_audit_created;

-- End of rollback for file 3.
