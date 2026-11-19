# ADMIN_AUDIT.md — Imran Games `/adminaccess` upgrade (Recon, before any change)

- **Date:** 2026-11-19 (PKT)
- **Branch:** `feat/admin-upgrade` (from `main`)
- **Target:** `https://imrangamesofficials.vercel.app/adminaccess` only
- **Reference:** Behance "DASSMART ECOMMERCE ADMIN DASHBOARD" + screenshots
  `01-overview` … `05-dark-mode` (all 5 viewed)
- **Method:** read the live repo files + `supabase.sql` + `migrations/` +
  the 2026-11-19 security audit final report. No code was changed in this
  step, except creating this branch and `docs/admin/PLAN.md` + `CONTRACTS.md`.
  No production deploy was made. Backup: `adminaccess/index.html`,
  `products.json`, `supabase.sql` copied to
  `~/workspace/imran-games-admin-backup/` (dated 2026-11-19, before upgrade).

## 1. Repository, framework, build setup

| Item | Finding |
|---|---|
| Repo | Git repo, `origin` = `MrYaseen0/imran-games`, branch `main`. Working tree was **dirty** when this branch was created: modified `adminaccess/index.html`, `index.html`, `supabase.sql`, `vercel.json`; untracked `AGENTS.md`, `docs/`, `migrations/`, `vendor/`, `.gitignore` (the 2026-11-19 knowledge-base work, uncommitted). The dirty state carried onto `feat/admin-upgrade` — commit or review it before merging anything back. |
| Framework / build | **None. Vanilla HTML/JS, no build step, no `package.json`, no TypeScript, no React, no tests.** One shop page, one admin page, one stylesheet. |
| Vendor JS (self-hosted, pinned) | supabase-js 2.119.1, Chart.js 4.4.1 in `vendor/`. Zero CDN for app code. The only external script is the hCaptcha provider script on the admin login. |
| Deploy | Vercel project has **no git link**. GitHub pushes **never** deploy. Deploys are file-upload only from this folder. Consequence: the prompt's "deploy only to a Vercel preview" cannot happen via a git branch — a preview must be an explicit file-upload deploy with a preview target, verified at its preview URL. Do not assume a branch = a preview. |
| Public shop | `index.html` (854 lines) + `styles.css` (168 lines), 42 products + 11 category pages (generated). Must stay untouched by this upgrade and smoke-tested after every deploy. |
| Docs (new, 2026-11-19) | `AGENTS.md` + `docs/` knowledge base (architecture / security / structure / files / design / CHANGELOG) — the current source of truth; read it before building. |

**Decision (lowest risk): keep vanilla HTML/JS for `/adminaccess`.** Do not
introduce React/Recharts/TS/a build step for the admin alone — it would be
the only built part of a static site, and a build failure would block the
whole deploy. Reuse Chart.js (already present) for all charts.

## 2. Current admin — feature inventory (verified from code, all must be preserved)

- **Login:** logo, "Hello 👋 Welcome!", Email/Username + Password (show/hide
  eye), Remember me (unchecked by default), Forgot password?, Login button,
  "← Back to shop". Generic error only ("Wrong email or password — try again").
- **Password reset:** "Reset password" (email → reset link) and "Set new
  password" (new + confirm, minimum 12 chars) screens; recovery via URL hash
  `type=recovery`.
- **Meta:** `noindex, nofollow`, "Private admin area… not linked from the shop",
  dark colour-scheme. No link to `/adminaccess` from the public shop (verified:
  the shop footer has no admin link).
- **Header (dashboard):** logo, "Admin Dashboard", "← Back to shop",
  "Signed in as …", Log Out (top + bottom).
- **Add product:** name, brand, category (11 — see §3), price, old price,
  stock, photo URLs (one per line, first = card photo), 🔥 Hot deal,
  🆕 New toggles. Photos are uploaded **manually** in Supabase Storage
  (`product-images` bucket) and pasted as URLs — there is **no** in-app upload.
- **Product list:** "All products (n)" — edit price / old price / stock /
  photo URLs → Save (optimistic locking via `products.version`; stale save
  refused); Delete = tap twice to confirm. Every change goes live instantly.
- **Analytics (live, no demo numbers):** Total products, Stock units,
  Inventory value, Sold out, Admin actions logged; charts Products by
  category, Stock overview, Admin activity last 7 days, Price range
  (all Chart.js); "Live Flow" latest-activity feed.
- **Audit log:** every sign-in / sign-out / add / edit / delete, newest first,
  latest 50, times in PKT (`Asia/Karachi`).
- **Session:** 30-min idle timeout, storage sweep on logout (`sb-*` keys from
  both storages), stale-session refusal at boot. Remember-me = localStorage,
  otherwise sessionStorage.

## 3. Supabase — what exists, what is missing

Project: `imran-games` (ap-south-1). Verified live state 2026-11-19 20:30 PKT:
**42 products, 912 stock units, inventory value Rs 14,390,815, 5 sold out,
1 admin, 0 locked.**

### Tables that exist

| Table | Columns (key ones) | RLS |
|---|---|---|
| `products` | `id, name, slug, category, brand, price, was_price, stock, is_hot, is_new, image_urls, created_at, version` | Public SELECT; writes admin-only |
| `reservations` | `product_id, qty, session_key, expires_at` | No policies — RPCs only |
| `admins` | `user_id, locked_until` | No policies — no client access |
| `audit_log` | `actor_email, action, entity, record_id, record_name, details, ip_address, user_agent, created_at` | Insert authenticated; Select admin-only |
| `orders` / `order_items` | `customer_name, phone, address, city, payment_method, total, status` (+ items) — **schema only** | See note below |

### RPCs that exist (all `SECURITY DEFINER`)

`is_admin()`, `reserve_stock()`, `release_stock()`,
`release_expired_reservations()`, `log_failed_login()`.

### Categories (11, hardcoded in the admin form + `CATMAP` in JS)

Consoles, Premium Tech, Controllers, Headsets, Racing Wheels, PS4 Games,
PS5 Games, Gift Cards, Gaming Chairs, Gaming Setups, Room Lighting.
There is **no** `categories` table — adding one is optional; do not break
the 11 existing values.

### Storage

Bucket `product-images`, public read, manual upload only. Product photos:
3 per product. No upload limits enforced in-app today (manual flow).

### Tables / columns that DO NOT exist (the upgrade needs most of these)

`customers`, `payments`, `refunds`, `discounts/coupons`, `categories`,
`site_visits`, `admin_profiles` (role), `notifications`. Product columns
missing: `description`, `sku`, `is_published`, `rating`, `review_count`,
`updated_at`.

### Orders — read this before planning the Orders page

- The `orders` table exists in `supabase.sql` but **no order row is ever
  written by the live site**. Checkout is WhatsApp COD: the shop reserves
  stock for 15 minutes, opens WhatsApp, and saves nothing.
- The schema file says orders are "insertable by everyone", but the live
  check recorded anon order INSERT as blocked — **schema file and live RLS
  disagree here; verify live before writing any order code.**
- There are no customers, payments, refunds, or discounts anywhere in the
  data. There is no visitor tracking at all.

## 4. Reference screenshots — what was seen

- **01-overview:** three screens (Products, Dashboard, Orders) in one shell.
- **02-dashboard:** electric-blue sidebar, topbar, 4 KPI cards with
  sparklines, Market Overview line chart (Weekly/Monthly/Yearly), Sales by
  Category donut, Recent Orders table.
- **03-orders:** KPI row (Orders, Orders Paid, Discounts, Refunds) + full
  Recent Orders table with status pills and pagination.
- **04-products:** category filter, "+ Add New Item", 4-column pink-tint
  product tiles with green discount badges, star ratings, struck old price,
  then a "Product Lists" table.
- **05-dark-mode:** same three screens in navy dark mode.
- Screenshots win over the prompt text on visual details. Values marked
  (≈) in the prompt are estimates — verify visually while building.
- **Never copy:** "Dass Mart" name, logo, the person in the avatar
  (Akinsipe Philip), or any reference customer names / amounts.

## 5. Biggest gap — the dashboard assumes an order system that does not exist

The reference KPIs have **no source data** in this project:

| Reference KPI / chart | Source data today? |
|---|---|
| Revenue, Orders, Orders Paid | **No.** No orders are saved. |
| Discounts, Refunds | **No.** No discounts, refunds, or payments exist. |
| Visitors | **No.** No visit tracking exists. |
| Market Overview (revenue/sale lines) | **No.** No revenue time series exists. |
| Sales by Category (donut) | Partial — can be computed from **products by category** (counts), not sales. Do not label counts as sales. |
| Recent Orders table | **No.** Empty state required. |
| Product tiles: star rating + review count | **No.** `products` has no rating/review columns; the shop's displayed stars have no stored source in `products.json`. Show "no ratings yet" — never invent stars. |
| Customers page | **No.** No customer records exist. |

**Rule for the build:** show proper empty / zero states, never fake values.
If Yaseen wants real revenue/orders, that is a **separate decision**: either
(a) record WhatsApp checkouts as orders (new write path + backfill = none),
or (b) keep Orders/Customers as empty shells until an order system exists.
Do not build a fake history to fill the charts. This needs Yaseen's answer
before Agent 4 (Data) designs the tables (see §9, Q2).

What **is** real and can power the dashboard today: inventory KPIs (total
products, stock units, inventory value, sold out), products by category,
stock overview, price bands, admin activity (last 7 days), Live Flow,
audit log. Those stay, restyled, as the "Inventory & Activity" section.

## 6. What the build must add (only what is missing)

- **Migrations** (idempotent, reversible, in `migrations/` — the repo has no
  `/supabase/migrations/` folder; use the existing `migrations/` convention):
  new tables/views/RPCs from §3, plus product columns
  (`description, sku, is_published, rating, review_count, updated_at`).
  Backup/export existing data first (products snapshot already in
  `~/workspace/imran-games-admin-backup/`).
- **Image upload:** drag-and-drop / multi-select upload straight to
  `product-images` (progress, WebP ≤ 1600px, reorder, first = card photo,
  delete, still allow pasting URLs). Storage RLS: public read, admin-only write.
- **Roles:** `admin_profiles` with Owner / Manager / Viewer; UI hides what a
  role cannot do **and** RLS enforces it. Today there is 1 admin, no roles.
- **Reports / Customers / Settings pages** in the same visual language.
  Customers stays empty until orders exist (see §5).
- **Settings:** profile, store (delivery fee etc.), appearance, security
  (sessions, 2FA option), admins & roles, filterable audit-log table (PKT).

## 7. Security — confirmed findings (do not weaken any of these)

**Already fixed + verified 2026-11-19 (13 findings):** C-01 admin role check
via `is_admin()` + RLS (non-admin refused + write 403); H-03 lockout
(5-in-15, per-IP 10/hr, password min 12, sign-up disabled); H-04 XSS
escaping (`escHtml()` + `igSafeImgUrl()`); H-05 idle timeout + storage
sweep; H-06 `supabase.sql` not deployed (404 live); H-07/M-01 headers 7/7;
M-02 pinned self-hosted JS; M-06 SDK-only login; M-03/L-02/L-03; reserve-stock
race fix (single-statement `DELETE … RETURNING`).

**The prompt's §2 security observation is CONFIRMED and must be fixed:**
the logged-out page ships the full dashboard markup in the same file
(`loginView` + `dashView` in `adminaccess/index.html`, shown/hidden by JS).
Hiding UI is not security — the server-side RLS is what protects the data
today, and it holds, but the dashboard code must not be delivered to
unauthenticated visitors at all. Fix: split the login view and the dashboard
into separate files (or a server-gated render) so only the login ships
before auth. Route guard + `is_admin()` re-check on every dashboard load.

**Still open / owner-pending (do not silently change):**
- CAPTCHA server-side **OFF by owner decision** (2026-11-19 20:34 PKT).
  Widget is live; enforcement failed twice (wrong secret — stored value was
  64 chars, real secrets are 42 chars starting with `0x`); 1 rotation left.
  Do **not** switch to Turnstile without Yaseen's decision (prompt §10
  suggests it as "optional").
- Password-reset mail (M-04): no custom SMTP, built-in mailer, delivery
  untested. Admin password rotation is the owner's job, in the browser.
- hCaptcha Pro trial ends 3 Dec 2026 — confirm free-plan fallback.
- Accepted: audit IP is client-supplied/display-only (M-05); anon key is
  publishable by design, RLS is the control, no service-role key in client
  code (M-07); no CSRF token — bearer auth, no cookies (L-01).
- Open by design: per-session reservation cap (anon can temporarily drain
  stock via 15-min holds, self-heals); session expiry never directly observed.

**New-build security requirements:** RLS on every new table + the bucket;
role-based policies (not UI-only); audit every create/edit/delete with
before/after summary; validate inputs, escape output, restrict uploads;
secrets by name only, never values; `.env.example` with no real values.

## 8. Risks

1. **Breaking the admin login** — the hCaptcha + `is_admin()` + idle-timer
   flow is delicate (two failed CAPTCHA rollbacks on 2026-11-19). Any
   restyle must keep the exact login logic; test login → dashboard →
   logout on every change.
2. **Breaking the shop** — low if only `adminaccess/` is touched, but the
   shop shares the Supabase project. Never change `products` RLS or the
   public SELECT policy without a separate check. Smoke-test the shop
   after every deploy (home loads, products show, add to cart works).
3. **Losing data** — products (42) + audit log are live data. No migration
   runs without a backup/export first; no `DROP` without a rollback note.
4. **Fake-data trap** — the reference screenshots are full of demo numbers
   (8,520 orders, revenue figures, named customers). Copying any of them
   into the build would be fraud-adjacent and breaks the "no demo numbers"
   rule. Empty states are the correct output where data does not exist.
5. **Preview confusion** — no git link means no automatic preview. A
   "preview" that is actually a production file-upload deploy would put an
   unfinished admin live. Verify the deploy target before every deploy.
6. **Scope creep** — roles, 2FA, reports, customers, settings, image upload,
   bulk actions, CSV import/export are all in the prompt. Each is a real
   build; do them wave by wave, not all at once.

## 9. Decisions needed from Yaseen (ask only these — do not guess)

1. **Social links** for the sidebar bottom: the shop footer has **no**
   social links (only email + phone). Which Facebook / Instagram / WhatsApp
   URLs should the sidebar use?
2. **Orders:** checkout today is WhatsApp COD with no saved orders. Should
   the Orders page record WhatsApp checkouts manually, or stay empty until
   an order system exists? (Decides the whole Data wave.)
3. **Roles:** Owner / Manager / Viewer — who is who? Today: 1 admin, no roles.
4. **Supabase access:** migrations need the owning account. His Gmail holds
   only `qec-page` + `yaseen-portfolio`, not `imran-games`. Who applies the SQL?
5. **CAPTCHA:** keep existing invisible hCaptcha (server-side OFF) or switch
   to Turnstile? Default: keep hCaptcha, do not switch without a decision.

## 10. Recommendation

**Go, with the §9 answers first — in this order:** Q2 (orders) decides the
Data wave; Q1 + Q3 are needed before the Shell/Settings waves; Q4 decides
who runs the migrations; Q5 is a one-line decision. Until Yaseen says "go",
**no code changes, no deploys.** The next step after "go" is Wave 2
(Design System + Data & Backend in parallel), per `docs/admin/PLAN.md`.
