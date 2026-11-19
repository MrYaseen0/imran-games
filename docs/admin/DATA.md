# Data & Backend — Admin Upgrade (Agent 4, Wave 2)

- **Date:** 2026-11-19 | **Branch:** `feat/admin-upgrade`
- **Status: NOT RUN.** These migrations are files only. The owner runs them
  in the Supabase SQL Editor after a backup, one wave at a time, in order.
  No agent has run them and no agent will ask for a service-role key or a
  DB password.
- **Run order:** `2026-11-19-admin-orders.sql` → `2026-11-19-admin-roles-products.sql`
  → `2026-11-19-admin-analytics.sql`. Rollbacks run in reverse order.
- **Login / CAPTCHA:** untouched. Nothing in this wave changes auth code.

## 1. Schema (what each migration creates)

### File 1 — `migrations/2026-11-19-admin-orders.sql`

| Object | What it is |
|---|---|
| `orders` (extended) | Legacy table, extended: `order_number` (unique, `#IG-YYYYMMDD-NNNN`), `subtotal`, `discount_amount`, `discount_code`, `delivery_fee`, `total`, `notes`, `deduct_stock` (default false), `stock_deducted` (default false), `created_by`, `updated_at`. Legacy columns kept: `customer_name`, `phone`, `city` (default Peshawar), `address`, `payment_method`, `status`. Status CHECK: Pending / Paid / Processing / Shipped / Delivered / Canceled / Refunded (legacy lowercase values are normalised first). Payment CHECK: COD / JazzCash / Easypaisa / Bank. |
| `order_items` (extended) | `order_id` (FK, cascade delete), `product_id` (FK, nullable), `product_name` + `price` (snapshots — later product edits never rewrite history), `qty`, `created_at`. |
| `refunds` | `order_id` (FK, cascade), `amount` (> 0), `reason`, `created_by`, `created_at`. Recording a refund does NOT change the order status by itself. |
| `coupons` | `code` (unique), `type` (percent / fixed), `value` (> 0), `active`, `created_at`, `updated_at`. The order stores the *applied* amount in `discount_amount` and the code in `discount_code`; there is no auto-apply logic. |
| `categories` | `name` (unique), `sort_order`. Seeded with the 11 existing categories (Consoles, Premium Tech, Controllers, Headsets, Racing Wheels, PS4 Games, PS5 Games, Gift Cards, Gaming Chairs, Gaming Setups, Room Lighting). `products.category` stays free text — no FK (a FK is a later step if wanted). |
| `notifications` | `title`, `body`, `link`, `is_read`, `created_by`, `created_at`. No automatic triggers create notifications in this wave. |
| `customers` (VIEW) | Aggregates orders by `phone`: most-recent `name`/`city`, `orders_count`, `total_spent_pkr`, `last_order_at`, `first_order_at`. A view, not a table — no second source of truth. |
| `next_order_number(p_day)` | Returns the next `#IG-YYYYMMDD-NNNN` for a day (advisory lock + UNIQUE backstop; on collision the insert fails and the form retries). A `BEFORE INSERT` trigger fills `order_number` when blank. |
| `recalc_order_totals(p_order_id)` | SECURITY DEFINER, admin-only. Recomputes `subtotal` from items and `total = max(subtotal - discount_amount + delivery_fee, 0)`. The admin UI calls it after changing order items. |
| `set_updated_at()` | Shared trigger helper (also used by files 2–3). |

### File 2 — `migrations/2026-11-19-admin-roles-products.sql`

| Object | What it is |
|---|---|
| `admin_profiles` | `user_id` (PK, FK to `auth.users`, cascade), `role` CHECK in (`owner`, `manager`, `viewer`). Seeded ONLY from the existing `admins` table: every current admin becomes `owner`. No user id or email is invented. New admins need a profile row too, or every role policy denies them. |
| `admin_role()` | SECURITY DEFINER, returns the caller's role or NULL. |
| Product columns | `description` (text), `sku` (text, unique when set), `is_published` (default true — existing products stay visible), `rating` (numeric NULL — **not** 0, not guessed), `review_count` (default 0), `updated_at`. Rating CHECK: NULL or 0–5. |
| `deduct_stock_for_order(p_order_id)` | SECURITY DEFINER, Owner/Manager only. See §4. |
| `restore_stock_for_order(p_order_id)` | SECURITY DEFINER, Owner/Manager only. See §4. |

### File 3 — `migrations/2026-11-19-admin-analytics.sql`

| Object | What it is |
|---|---|
| `v_revenue_daily` | Per PKT day: `orders_count`, `revenue_pkr`, `discounts_pkr`, `refunds_pkr`, `paid_count`. Days with no orders have no row — the UI fills gaps with zeros. |
| `v_orders_by_status` | `status`, `orders_count`, `total_pkr`. |
| `v_sales_by_category` | From order items joined to live products: `items_sold`, `revenue_pkr`, `orders_count`. Non-Canceled orders only. |
| `v_top_products` | `product_id`, `product_name`, `qty_sold`, `revenue_pkr`, `orders_count`. No LIMIT in the view — the UI orders by `revenue_pkr` desc and pages with `range()`. |
| `v_inventory_summary` | Single row: `total_products`, `published_products`, `stock_units`, `inventory_value_pkr`, `sold_out_count`, `low_stock_count`, `unpublished_count`. |
| `v_low_stock` | Published products with stock 1–10 (`product_id`, `name`, `category`, `brand`, `price`, `stock`, `stock_status='low'`). Sold out (0) is NOT in this list. |
| `v_admin_activity_daily` | Per (PKT day, action): `action_count` from `audit_log`. |
| `get_kpi_deltas(p_start, p_end)` | SECURITY INVOKER. One row per metric (`revenue`, `orders`, `orders_paid`, `discounts`, `refunds`, `customers`, `low_stock_items`) with `current_value`, `previous_value` (same-length period before), `delta_pct` (NULL when previous is 0; NULL for low-stock, a point-in-time count). PKT dates, inclusive. |

All views are `security_invoker = true` — they respect the caller's RLS.

## 2. Definitions the UI must use (do not redefine in JS)

- **Revenue** = sum of order totals with status in (Paid, Processing,
  Shipped, Delivered). **Pending is pipeline, not revenue.** Canceled
  counts for nothing.
- **Discounts** = sum of `discount_amount` on non-Canceled orders.
- **Refunds** = sum of `refunds.amount`, attributed to the refund's own date.
- **total_spent** (customers view) = sum of order totals excluding Canceled
  and Refunded orders (delivery fee included).
- **Low-stock item** = published product with stock **1–10** (the shop
  already calls stock ≤ 10 "low"). Sold out (stock = 0) is separate.
- **Dates** are PKT calendar days everywhere in analytics.
- **Rating:** `rating` NULL + `review_count` 0 means "no ratings yet".
  Never display invented stars.

## 3. RLS policy list

Anon has **no policy and no grant** on any new table — every anon
read/write is denied. The old permissive anon INSERT policies on
`orders`/`order_items` are dropped in file 1 (RLS policies are OR'd,
so adding admin policies alone would not have closed the hole).

| Table | SELECT | INSERT / UPDATE | DELETE |
|---|---|---|---|
| `orders`, `order_items`, `refunds`, `coupons`, `categories`, `notifications` | Any role (`is_admin()` + `admin_role()` not null) | Owner / Manager | Owner only |
| `products` | Public (unchanged — shop reads anonymously) | Owner / Manager | Owner only |
| `admin_profiles` | Any role | Owner only | Owner only |
| `admins` | No policies (no client access — unchanged) | — | — |
| `audit_log` | Admin-only (unchanged) | Authenticated insert (unchanged) | — |
| `customers` (view) | Authenticated via underlying `orders` RLS | — (view) | — |

Every role policy ALSO requires `is_admin()` (row in `admins` + not
locked), so the H-03 lockout still blocks a locked admin from everything,
and a profile alone grants nothing. **DELETE is Owner-only by design:**
deleting destroys the audit trail; a Manager cancels an order via status
instead. To widen delete to Manager, add `'manager'` to the
`*_delete_owner` policies — a one-line change per table, Owner's call.

## 4. How "+ Add Order" maps to the tables

Form field → storage:

| Form field | Stored as |
|---|---|
| Customer name / phone / city / address | `orders.customer_name` / `phone` / `city` / `address` |
| Payment method | `orders.payment_method` (COD / JazzCash / Easypaisa / Bank) |
| Items picked from products | One `order_items` row each: `product_id`, `product_name` + `price` copied from the product at order time, `qty` |
| Discount (amount, optional coupon code) | `orders.discount_amount`, `orders.discount_code` |
| Delivery fee | `orders.delivery_fee` |
| Status | `orders.status` |
| Notes | `orders.notes` |
| "Deduct stock" toggle | `orders.deduct_stock` |
| Created by | `orders.created_by` = the admin's user id |

Flow (admin UI — Agents 7/8, not this task):

1. Insert the order (status as chosen, usually Pending). `order_number`
   is generated by the trigger.
2. Insert the `order_items` rows.
3. Call `recalc_order_totals(order_id)` — sets `subtotal` and `total`.
4. If `deduct_stock` is ON, call `deduct_stock_for_order(order_id)`:
   - Returns **true** when stock was deducted, or was already deducted
     (idempotent — safe to call twice).
   - Returns **false** when the toggle is off (stock untouched).
   - **Raises an exception and changes nothing** when any item lacks
     stock (single transaction) — the UI must show the error and let
     the admin fix quantities; the order row itself stays.
   - This is a **permanent** decrement. It does NOT use `reserve_stock()`
     — that creates a 15-minute reservation that expires and restores
     stock, which is the shop checkout's behaviour, not a manual order's.
5. If the order is later canceled and stock was deducted, call
   `restore_stock_for_order(order_id)` (adds the quantities back; a
   no-op returning false when nothing was deducted). Canceling an order
   does **not** auto-restore stock — the UI must offer the restore
   explicitly, so a canceled-but-kept order cannot silently re-add stock.
6. Write an `audit_log` entry for the create/edit (the UI already logs
   product actions the same way).

## 5. Empty-state behaviour

Until the first manual order is added, every order-derived number is
**0 / empty** by construction: Revenue 0, Orders 0, Orders Paid 0,
Discounts 0, Refunds 0, Customers 0 rows, Recent Orders empty, Market
Overview empty, Sales by Category empty, Top Products empty. The views
return zero rows (not errors) on empty tables, and `get_kpi_deltas`
returns 0s with NULL deltas. The dashboard must render the empty state,
not a demo chart. Inventory KPIs (products, stock, value, sold out,
**low-stock items**) are real from day one — low-stock replaces the
Visitors KPI.

## 6. How to run + roll back (owner only)

1. Back up first: export `products`, `orders`, `order_items`,
   `audit_log`, `admins` (SQL Editor → export, or the dashboard).
2. Run the three files **in order**, one at a time, in the Supabase
   SQL Editor. After each file, verify with the checks in §7 before
   running the next.
3. Rollback (only if a file fails or must be reverted), in **reverse**
   order: `2026-11-19-admin-analytics-rollback.sql` →
   `2026-11-19-admin-roles-products-rollback.sql` →
   `2026-11-19-admin-orders-rollback.sql`.
4. Rollback warnings: the orders rollback drops manually added orders
   (export first); the roles rollback drops product descriptions/SKUs/
   ratings and all role assignments (`admins` itself survives); the
   orders rollback restores the old anon INSERT policies — re-verify
   live behaviour afterwards (see the warning in that file).

## 7. Verification checks (after running, before calling it done)

- `select count(*) from public.categories;` → 11.
- `select * from public.admin_profiles;` → 1 row, role `owner`
  (the existing admin; no other rows).
- `select count(*) from public.customers;` → 0 (no orders yet).
- `select * from public.v_inventory_summary;` → matches the live
  shop numbers (42 products — verify against the shop, do not assume).
- `select * from public.get_kpi_deltas(current_date - 6, current_date);`
  → 7 rows, current values 0, deltas NULL.
- Anon check (signed-out client): `select` on `orders` is denied;
  insert into `orders` is denied.
- Viewer check (a Viewer account, when one exists): can read orders,
  cannot insert/update/delete (403 / policy violation).

## 8. What was deliberately NOT created

- **`site_visits`** — the Visitors KPI is replaced by Low-stock items
  (a real number). No visit tracking, no personal data collected.
- **`payments` table** — payment method lives on the order. There are
  no payment transactions to reconcile (COD / JazzCash / Easypaisa /
  Bank are methods, recorded per order).
- **`customers` table** — customers are a view over orders (§1). A
  table would duplicate the source of truth and drift.
- **Auto-saving WhatsApp orders** — the shop checkout is untouched.
  Orders exist only when an admin adds them manually. Auto-save is a
  separate later task, by owner decision.
- **FK from `products.category` to `categories`** — deferred; the
  category list is canonical for the dropdown, the product column
  stays free text for now.
- **2FA, Turnstile, login changes** — out of scope for this task;
  login logic is untouched.
- **Automatic notifications** — the table exists; no triggers create
  rows yet.

## 9. What could NOT be verified without DB access

- SQL syntax was **not** executed against a live database in this task
  (no DB access, by design). All three files + rollbacks need a real
  run in the SQL Editor; the §7 checks are the acceptance test.
- Whether the legacy `orders` / `order_items` tables exist live with
  the exact columns `supabase.sql` shows (the audit flagged a
  schema-vs-live discrepancy on anon order INSERTs). The migrations
  are written to be safe either way (`IF NOT EXISTS` / `ADD COLUMN
  IF NOT EXISTS`), but the first run may surface a live difference —
  stop and report it rather than forcing it through.
- `security_invoker = true` on views requires Postgres 15+. If the
  project runs an older Postgres, that option must be removed from
  the view definitions before running file 1 / file 3.
- The exact live product count / stock totals at run time (audit said
  42 products on 2026-11-19 20:30 PKT — re-check live, do not assume).
