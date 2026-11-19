# Files — Imran Games

One line per important file: what it is responsible for. If a file is
not listed here, it is generated output, an asset, or a verification
file — see [`structure.md`](structure.md).

## Entry points & docs

- `AGENTS.md` — router for agents and new readers; links to everything in `docs/`.
- `README.md` — human intro to the store (older; `AGENTS.md` + `docs/` are current).
- `docs/architecture.md` — how frontend, Supabase, and checkout fit together; Mermaid flows.
- `docs/security.md` — current security posture: fixed, open, accepted, and why.
- `docs/structure.md` — folder-by-folder layout and why it is organised that way.
- `docs/files.md` — this file: the "where do I even look" index.
- `docs/design.md` — theme, components, UI/UX conventions.
- `docs/CHANGELOG.md` — dated, append-only log; never rewrite old entries.

## Frontend

- `index.html` — the whole shop: live product grid, search/filter, quick-view modal, cart, wishlist, WhatsApp COD checkout with 15-minute stock holds.
- `styles.css` — the only stylesheet; CSS variables define the whole theme.
- `adminaccess/index.html` — hidden admin panel: login, product add/edit/delete, optimistic locking, audit-log history, analytics charts.
- `logo.png` — transparent gamepad logo (icon only).
- `logo-small.png` — small logo variant.

## Data & generation

- `build_pages.py` — generates `category/`, `products/`, and `sitemap.xml` from the catalogue; re-run after any price/stock change.
- `products.json` — 42-product catalogue snapshot (id, slug, category, brand, price, `was_price`, stock, flags, image URLs, `version`).
- `sitemap.xml` — 54 real URLs for search engines.
- `robots.txt` — allows all crawlers, including AI crawlers.
- `llms.txt` — AI-readable store summary (featured products, visit info).

## Backend (Supabase)

- `supabase.sql` — reviewed schema source of truth: tables, RLS policies, RPCs (`is_admin`, `reserve_stock`, `release_stock`, `release_expired_reservations`, `log_failed_login`); NOT deployed.
- `migrations/2026-11-19-c01-admin-flag.sql` — C-01 fix: `admins` table + `is_admin()` + admin-only write policies.
- `migrations/2026-11-19-h03-lockout.sql` — H-03 fix: lockout column, `is_admin()` lock check, `log_failed_login()` throttle + lock.
- `migrations/2026-11-19-reserve-stock-race.sql` — race fix: single-statement `DELETE … RETURNING` stock restore.

## Hosting & vendor

- `vercel.json` — 308 redirects to the canonical hostname, `cleanUrls`, and the 7 security headers.
- `vendor/supabase-js-2.119.1.min.js` — self-hosted, pinned Supabase client.
- `vendor/chart-4.4.1.umd.min.js` — self-hosted, pinned Chart.js for admin analytics.
- `category/*.html` (11 files) — generated category landing pages.
- `products/*.html` (42 files) — generated per-product pages.
