# CHANGELOG — Imran Games

Append-only log. Add a dated entry every time something changes — a
fix, a migration, a deploy. Never rewrite old entries.

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
