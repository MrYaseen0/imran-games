# CHANGELOG — Imran Games

Append-only log. Add a dated entry every time something changes — a
fix, a migration, a deploy. Never rewrite old entries.

## 2026-11-19 — Reviews section removed + Wave 5 production deploy (orchestrator)

- **Shop (`index.html`):** the whole CUSTOMER REVIEWS section is gone —
  HTML section, the `REVIEWS` sample data (incl. its inline images),
  the `revGrid` render, the nav + footer "Reviews" links, and the
  reviews CSS. No sample stars remain anywhere on the shop; the `stars()`
  helper still renders real ratings only when a product has one (none
  do today). Inline JS still passes `node --check`.
- **Production deploy** of Wave 5 (commit d43e33c + this removal) to
  https://imrangamesofficials.vercel.app/ on Yaseen's "deploy".

## 2026-11-19 — Wave 5 follow-up (orchestrator): banner fix + fake JSON-LD ratings removed

- **Validation banner (`adminaccess/app.js`):** the "Fix the highlighted
  fields first." banner now hides as soon as every field error is gone
  (was lingering after a fix until the next submit).
- **Shop JSON-LD (`index.html`):** removed all 40 hardcoded
  `aggregateRating` values (e.g. 4.9/412) from the static product
  ItemList JSON-LD — ratings are NULL in the database, so no rating is
  claimed anywhere now. All 5 ld+json blocks still parse as valid JSON.

## 2026-11-19 — Admin Wave 5 fix round (Agent 8): truthful import errors, robust upload decode, real ratings/photos

- **Edge Function `import-image` redeployed (ACTIVE v2, `verify_jwt` on):**
  a non-2xx fetch now says the link could not be opened **with the HTTP
  status** (e.g. HTTP 400 — private, expired, or not a direct image
  link); the "not a direct image" message is now only for a 2xx response
  whose content-type is not jpg/png/webp. 403/404 and Drive messages
  unchanged. No-auth POST still 401. Security unchanged (SSRF,
  content-type, 8 MB, 10 s, admin check, Drive conversion).
- **Local upload decode (`adminaccess/app.js` `igPmCompress`):** fallback
  chain `createImageBitmap` → `<img>` + object URL → FileReader data URL
  + `<img>`; still compresses to WebP ≤1600px @0.85. A failure names the
  file and its size and points at the Image URL field; 0-byte files are
  refused plainly in the picker too.
- **Validation:** each modal field's error clears as soon as that field
  is edited (input/change listeners); the "Fix the highlighted fields
  first." banner still clears on the next submit attempt.
- **Shop card (`index.html` `toPageProduct`/`cardHTML`/`openModal`):** the
  hardcoded RATINGS map is gone — ratings now come from the live
  `products.rating` / `review_count` (NULL today, verified), so a product
  with no rating shows **no stars and no number**. Photo count label is
  the real `image_urls` count ("1 Photo" / "3 Photos"), never a hardcoded
  "3 Photos".
- **Product tiles:** Edit/Delete buttons are always visible (was
  hover-only — unusable on touch devices).
- **Delete refresh:** the deleted row/tile is removed from the list
  immediately (both list and tile delete paths), then the reload re-syncs
  — the row no longer lingers after the "Deleted ✓" toast.
- Not live-tested yet — browser retest (upload, Drive import, bad URL,
  delete refresh, shop card) is the orchestrator's job.

## 2026-11-19 — Admin Wave 5: product add/edit/delete flow + deal price

- **One modal for Add AND Edit** (`adminaccess/index.html`, `app.js`):
  name/brand/category (11 live categories) required; old price optional;
  new price required and ≤ old price when old is set; deal price
  optional and < new price; stock whole ≥ 0; Hot/New toggles; inline
  validation, loading state, success toast. Save writes the row
  immediately with optimistic locking (version +1, stale save refused).
  Product Lists table gained a Deal price column; tiles show the deal
  price when set. Every add/edit/delete writes `audit_log`.
- **Images 1–4:** drag & drop + Choose from device (multi-select),
  compressed to WebP ≤ 1600px in the browser, XHR upload with a real
  progress bar, unique filenames, straight to the `product-images`
  bucket; ONE Image URL field — Drive share links and Facebook/direct
  image links go through the `import-image` Edge Function, which copies
  the bytes into the bucket and returns a Supabase URL (never hotlinked).
  Thumbnails drag to reorder (first = card photo, "Cover" badge),
  remove per image; files uploaded in a session that is closed without
  saving are deleted (no orphans).
- **Delete** keeps the tap-twice confirm and now also removes the
  product's bucket files (exact `image_urls` paths + product-uuid
  prefix listing); audit entry records whether the cleanup succeeded.
- **Migration live** (`migrations/2026-11-19-product-images.sql`,
  backup `~/workspace/imran-games-admin-backup/2026-11-19-wave5-pre-migration/`):
  adds only `deal_price numeric` (CHECK > 0); guards the
  `supabase_realtime` publication entry; bucket `product-images` public
  with 8 MB + jpg/png/webp limits; the 3 permissive Storage policies
  replaced with admin-gated ones (`is_admin()`). Public products SELECT
  untouched. Rollback in `migrations/2026-11-19-product-images-rollback.sql`.
  `supabase.sql` synced (Wave 5 section at the end).
- **Edge Function `import-image` deployed** (ACTIVE v1, verify_jwt on):
  verifies the caller's JWT + `is_admin()` RPC, SSRF protection
  (https only, private/internal IPs blocked, ≤ 3 redirects re-checked
  per hop), content-type jpg/png/webp, 8 MB cap, 10 s timeout, Drive
  links converted to direct form, plain-language errors.
  URL: `https://vnbaizpqucimomrfvfpd.supabase.co/functions/v1/import-image`
  (see `docs/admin/PRODUCT_IMAGES.md`).
- **Shop deal price** (`index.html` `toPageProduct`, minimal change):
  when `deal_price` is set and below the new price, the deal price is
  the shown price and `was_price` stays the struck-through old price.
  `deal_price` is NULL on all 42 products today, so behaviour is
  unchanged until an admin sets a deal. Shop Realtime already existed
  (channel `ig-products`); admin Realtime now also refreshes dashboard
  KPIs on product changes.
- **Theme/color pass (same wave):** default theme is the BLUE light
  theme when nothing is saved (no-flash snippet, toggle, Settings
  "System" all agree); toggle works on all 6 routes and persists;
  contrast fixes — muted text #7A7A85 → #5F5F6B, light success
  #22C55E → #15803D, light danger #E11D1D → #B91C1C, dark danger
  #FF5C5C → #DC2626, link #3B3BFF → #A5A5FF in dark, badge/pill
  colors raised to ≥ 4.5:1, `color-scheme` per theme for native
  controls. No layout change.
- **Not deployed, not committed** — preview + production deploy wait
  for the owner's go-ahead. Live-browser test of the modal, uploads,
  Drive import and the dummy product is still the orchestrator's job.

## 2026-11-19 — Admin Wave 4 (fix + rebuild): root-relative paths, reference dashboard

- **Root cause of the Wave 3 live failure:** Vercel cleanUrls serves the
  dashboard at `/adminaccess` (no trailing slash), so every relative
  asset URL resolved against the site root and 404'd (`admin.css`,
  `ui.js`, `app.js` → `/admin.css` etc.). No CSS, no JS — unstyled
  dashboard, no products, dead routes, dead logout. Fix: every asset
  and navigation URL in `login.html`, `index.html`, and `app.js` is now
  root-relative (`/adminaccess/admin.css`, `/adminaccess/app.js`,
  `/vendor/…`, `/logo.png`, `/adminaccess/login.html`); verified by
  script to resolve from both `/adminaccess` and `/adminaccess/`.
  Login logic, CAPTCHA config, and auth settings unchanged.
- **Dashboard rebuilt to the reference (screenshot 02):** KPI cards
  (Revenue, Orders, Orders Paid, Low stock items — not Visitors) with
  sparklines + deltas from `get_kpi_deltas`; Market Overview line chart
  (Weekly/Monthly/Yearly) from `v_revenue_daily`; Sales by Category
  donut from `v_sales_by_category`; Recent Orders table; Inventory &
  Activity panel + Live Flow + History restyled to the design system
  (light + dark). Real 0s and empty states — no demo numbers.
- **Orders (screenshot 03):** KPI cards (Orders, Orders Paid,
  Discounts, Refunds) + manual "+ Add Order" form (customer, phone,
  city, address, payment, items from live products, discount, delivery
  fee, status, notes, "deduct stock" toggle via
  `deduct_stock_for_order` — never `reserve_stock`); inline status
  edit, tap-twice delete (Owner only), explicit "Restore stock" on
  canceled + deducted orders. Recent Orders table, paginated.
- **Products (screenshot 04):** category filter (live `categories`
  table), product tiles (pink tint, real photo, price + was-price,
  green discount badge, "No ratings yet" — no invented stars) with
  Edit/Delete, 8/page pagination; Product Lists table (inline
  price/stock/photo editing, optimistic locking, tap-twice delete),
  10/page. Add form moved to a modal; edit form is a modal too.
- **Reports / Customers / Settings:** revenue-by-day chart + top
  products + orders by status (real views); customers view by phone;
  account card with the real role from `admin_role()`, theme choice
  (Light/Dark/System), filterable audit log (PKT).
- **Roles in the UI:** Owner/Manager/Viewer — Viewer hides all write
  buttons, Manager hides delete buttons; the database (RLS) still
  enforces everything. Avatar shows the real role.
- Not live-tested yet — preview deploy + live login → dashboard →
  orders → products → logout is the orchestrator's QA. No deploy, no
  commit, no SQL run in this wave.

## 2026-11-19 — Admin Wave 3: login/dashboard split + app shell

- Split `/adminaccess`: new `login.html` (only thing logged-out visitors
  receive — login/forgot/reset cards + invisible hCaptcha, same sitekey),
  `index.html` rewritten as the dashboard shell only (sidebar, topbar,
  hash routes `#/dashboard` … `#/settings`, no login markup), new
  `app.js` (session guard, routing, shell wiring, dashboard data
  functions moved verbatim). Login restyled with `admin.css` (§12
  appended, §10 rules untouched). See `docs/admin/AUTH.md` for the full
  list of moved functions and the adaptations (reset redirectTo →
  `login.html`; sign-out → `login.html?signed-out=1`; `showAdmin`
  handover). Login logic, CAPTCHA config, and auth settings unchanged.
  Not live-tested yet — live login → dashboard → logout is Wave 3 QA.

## 2026-11-19 — Project knowledge base created

- Added `AGENTS.md` (router, <200 lines) + `docs/` (architecture,
  security, structure, files, design, CHANGELOG). Verified the
  AGENTS.md conventions against current sources before building:
  root-file router + linked `/docs/` folder, no required fields,
  keep the root file short.
- **Correction recorded here:** the build brief listed H-04, H-05,
  and H-07 as still open. They were in fact fixed + verified live on
  2026-11-19 (see `docs/security.md`); this knowledge base records
  the verified state, not the brief's stale list.

## 2026-11-19 — Security audit closed (20:34 PKT)

- Audit: 17 findings. 13 fixed + verified live, 3 accepted with
  reasons, 1 left open by owner decision (CAPTCHA server-side off).
- C-01 fixed + verified: `admins` table + `is_admin()` + admin-only
  RLS writes; non-admin refused + write 403; real admin PASS.
- Reserve-stock race fixed + verified: single-statement
  `DELETE … RETURNING`; parallel releases restore +1, not +2;
  128-bit session keys.
- H-06 fixed + verified: `supabase.sql` excluded from deploy; live
  `/supabase.sql` 404.
- H-03 fixed + verified: sign-up disabled, password minimum 12,
  5-in-15 lock, per-IP throttle 10/hr; lock test PASS.
- H-04 fixed + verified: `escHtml()` + `igSafeImgUrl()` on admin list
  and shop cards; image URLs sanitised at ingestion; harness 48/48,
  API 27/27, live DOM 6/6.
- H-05 fixed + verified: remember-me unchecked by default, 30-min
  idle timeout; logout storage sweep. Idle live test not testable in
  cloud browser (code/harness only).
- H-07 / M-01 fixed + verified: 7/7 security headers live on `/` and
  `/adminaccess` (CSP keeps `'unsafe-inline'` — accepted).
- M-02 fixed: self-hosted pinned supabase-js 2.119.1 + Chart.js 4.4.1;
  zero CDN references remain (hCaptcha provider script excepted).
- M-06 fixed: raw auth fallback login path deleted; SDK-only login.
- M-03 / L-02 / L-03 fixed: password minimum 12 enforced (8-char →
  HTTP 422), one generic login error, logout storage sweep.
- CAPTCHA: invisible hCaptcha widget live on login; server-side
  enforcement attempted twice, failed twice (wrong secret — stored
  value 64 chars, real secrets are 42 chars starting with `0x`),
  rolled back both times. Owner decision 20:34 PKT: leave server-side
  CAPTCHA OFF. 1 secret rotation left. Pro trial ends 3 Dec 2026.
- Final live state 20:30:55 PKT: admin login PASS, 42 products,
  stock 912, inventory value Rs 14,390,815, 5 sold out, logout PASS,
  0 admins locked, 1 admin / 1 auth user.
- Owner-pending: admin password rotation, M-04 SMTP, hCaptcha Pro
  trial fallback, CAPTCHA re-enable (needs a correct 0x/42-char secret).

## 2026-11-18 — Rebrand + SEO + v13 reservations (live)

- Rebrand to "Imran Games Officials" everywhere (title, meta, JSON-LD,
  footer, WhatsApp order text); canonical hostname
  `imrangamesofficials.vercel.app` (no dashes); old hostnames 308-redirect.
- v13: stock reservations + optimistic locking — `reserve_stock` /
  `release_stock` / `release_expired_reservations` RPCs (15-min holds),
  `products.version`; checkout reserves every cart item before
  WhatsApp; any failure releases the rest and never opens WhatsApp.
- Catalogue: 42 products live (incl. GTA VI pre-order, Rs 27,999,
  stock 10; MacBook Pro M1 Pro, Rs 120,000). Sitemap: 54 real URLs.
- Google Search Console ownership verified via HTML meta tag (never
  remove). Bing Webmaster: imported from GSC, sitemap submitted,
  0 errors. PageSpeed: Mobile 44 / Desktop 92.
- AI search: robots allows AI crawlers, `llms.txt` live, IndexNow
  (Bing), sitemap image namespace, Store JSON-LD shipping, 2 new FAQs.
- Merchant Center: stopped by owner (sitemap feed failed, 0 products);
  do not retry unless asked.

## 2026-11-18 — Store live on Supabase (v10)

- Store went Supabase-driven: products load live from `public.products`
  with Realtime; no hardcoded product list; 3 Storage photos per
  product in the `product-images` bucket.
- Admin panel: add/edit/delete products, inline price/stock editing,
  audit log (latest 50), analytics (summary cards, Chart.js charts,
  activity timeline) — all computed live.
- Checkout: WhatsApp COD (delivery Rs 350, free above Rs 10,000).
  Orders are not saved to Supabase (anon order INSERT blocked by RLS).
- Old WordPress site `imrangames.pk` untouched (compromised —
  Indonesian gambling spam; SSL expires 17 Dec 2026).
- Hero redesign: slim announcement line, transparent header with expanding search, 5-slide hero from live products, Hot Deals sheet (branch hero-redesign).
- Hero v3 (branch hero-redesign, local, not deployed): hero now 7 slides built from the owner's own supplied pictures (background removed with rembg; derivatives, not regenerated). Slide 5 and slide 6 (helmet/headset + two controller mounts) are split into separate product layers; slide 7 is the Gamers Ultra Chair. Concept slides (GTA VI card, rumored PS5 Pro bundle) carry visible concept notes and no price/stock/cart. Typography: Unbounded (headline, counter) and Space Grotesk (nav, chips, buttons), self-hosted in /fonts. Added per-letter headline reveal, neon flicker line, nav fade-in, CTA shimmer, masked product reveals, slide counter. Reduced motion: static first slide, carousel off, reveals off. Archive tags: 7ece4e7, lighting-pass, user-images, user-images-v2, wall-mounts-6, chair-7.

## Hero v3.1 (local preview, not deployed)
- Hero is 10 slides (slides 8-10: Xbox Phantom Dust skin concept with Xbox emblem, PS5 setup, controllers on flame stand). Counter and dots are 10.
- Product images: classical enhancement (Lanczos, denoise, unsharp, local contrast) on all slide assets; Real-ESRGAN x4plus (ONNX, CPU) on x-stand, s-game, s-headset, s-ps5, w-white, w-black, p5 disc case, p5 controller. Originals in assets/hero/u/orig/.
- gold.css: restrained gold on icons, arrows, active dot, counter. Remove its link to revert (tag enhance-pre-gold has the pre-gold build).
- Softer product entry bounce (cutePopSoft), disabled under reduced motion.
- Not done: formal taste-skill gate (checker timed out), PlayStation/Nike DESIGN.md source failure stands.
