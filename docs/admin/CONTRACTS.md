# Admin Upgrade — Contracts

Shared contracts for all sub-agents. If a contract must change, change it
here first and update every agent that uses it. No agent invents a new
shape, name, or token on its own.

## Routes (hash, under `/adminaccess`)

`#/dashboard`, `#/orders`, `#/products`, `#/reports`, `#/customers`,
`#/settings`. Deep-linkable, back/forward works, last view remembered.
Default route: `#/dashboard`. Login is **not** a hash route — it is the
gate shown before any route renders (see Security).

## Design tokens (from the screenshots, ≈ = verify visually)

Light: `--sidebar-bg: #0A00FF`, `--page-bg: #F0F1FA`, `--card-bg: #FFFFFF`,
`--text: #0D0D0D`, `--text-muted: #7A7A85`, `--primary: #0A00FF`,
`--success: #22C55E`, `--danger: #E11D1D`, `--warning: #F59E0B`,
`--table-head-bg: #E3DEDE`, `--table-line: #BDBDBD`,
`--search-bg: #E4E4E4`, `--tile-bg: #F8E4E4`, `--discount-bg: #8FE04A`.
Card radius 6–8px, shadow `0 2px 8px rgba(20,20,60,.18)`.
Sidebar ≈ 240px (collapses to 72px icon rail; <768px slide-in drawer).
Content padding 32px, grid gap 24px, KPI cards 4-up.

Dark (screenshot 05): `--sidebar-bg: #101A55`, `--page-bg: #141E5C`,
`--card-bg: #1B2A6E`, `--topbar-bg: #14215F`, `--text: #FFFFFF`,
`--text-muted: #A9B2E0`, `--primary: #3B3BFF`, `--tile-bg: #27388A`.
Theme toggle = sun icon in topbar; persist in `localStorage`
key `ig-admin-theme`; default `prefers-color-scheme`; no flash on load.

Typography: headings/page titles Roboto (or Inter) 900/700 UPPERCASE
~28–32px; card titles 12–14px 700 UPPERCASE; body/table Roboto 13–14px;
sidebar labels 11–12px 700 UPPERCASE, letter-spacing .03em.

## Data shapes (Supabase — names only, never values)

Existing (do not rename): `products` (`id, name, slug, category, brand,
price, was_price, stock, is_hot, is_new, image_urls, created_at, version`),
`reservations`, `admins` (`user_id, locked_until`), `audit_log`
(`actor_email, action, entity, record_id, record_name, details, ip_address,
user_agent, created_at`).

Proposed (only what is missing, as migrations — see Audit §6):
`orders`, `order_items`, `customers`, `payments`, `refunds`,
`discounts/coupons`, `categories`, `site_visits`, `admin_profiles` (role),
`notifications`. Product fields to add: `description, sku, is_published,
rating, review_count, updated_at` (rating/review_count have **no** source
data today — display "no ratings yet", never invent stars).

## API / RPC names (existing — keep)

`is_admin()`, `reserve_stock()`, `release_stock()`,
`release_expired_reservations()`, `log_failed_login()`.
New analytics must be SQL views / RPCs, not client-side loops over whole
tables. Pagination server-side (`range`). Indexes on date/status/category.

## Formatting

- Currency: `Intl.NumberFormat('en-PK', {style:'currency', currency:'PKR'})`.
  Reference shows ₦ — always use PKR.
- Dates: `DD-MM-YYYY`; times in PKT (`Asia/Karachi`).
- Numbers: compact (`98.7k`) in cards, full in tables.
- Order ID format: `#IG-YYYYMMDD-NNNN` (example only — real IDs come from data).

## Component names (build once, reuse)

`AppShell, Sidebar, Topbar, GlobalSearch, ThemeToggle, NotificationBell,
AvatarMenu, PageHeader, DateRangePicker, KpiCard (with Sparkline), ChartCard,
LineChart, DonutChart, BarChart, SegmentedControl, DataTable, StatusPill,
Badge, Button, IconButton, Input, Select, Toggle, Modal, Drawer, ConfirmTap
(tap-twice delete), Toast, Skeleton, ImageUploader, ProductTile, StarRating,
Tabs, EmptyState, ErrorBoundary`.
Charts: Chart.js (already self-hosted, pinned 4.4.1). Curves smooth
(monotone), dots on key points, tooltip pills like the reference.

## Security contract

- Every read/write is protected server-side (RLS + `is_admin()` / role).
  The JS gate only decides what to show.
- Dashboard markup/code must **not** be shipped to logged-out visitors:
  login view and dashboard must be separate (split file or server-gated
  render) — see Audit §7. This is a required fix, not polish.
- Roles: Owner / Manager / Viewer. UI hides what a role cannot do **and**
  the database enforces it.
- Audit every sign-in, sign-out, create/edit/delete (product, order,
  setting, admin) with before/after summary; store UTC, display PKT.
- Inputs validated, output escaped (`escHtml()` / `igSafeImgUrl()` pattern),
  uploads restricted (type/size, WebP ≤ 1600px), no XSS.
