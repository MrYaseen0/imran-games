# Imran Games — AGENTS.md

> Read this file first. It is the router, not the whole manual.
> Detail lives in `docs/` — follow the links, do not duplicate facts here.

## What this is

- **Imran Games Officials** — a dark gaming e-commerce store for a real
  Peshawar gaming shop (PS4/PS5 games, consoles, controllers, headsets,
  accessories, gaming chairs, room lighting).
- **Live site:** `https://imrangamesofficials.vercel.app/` (canonical, no dashes).
- **Shop:** Shop #27/28, Block A, S.S Plaza, Karkhano Market, Hayatabad,
  Peshawar. WhatsApp / COD checkout to the shop's public WhatsApp number
  (see `index.html` footer — do not invent a new number).
- **Ownership (important):** this is **not** Yaseen's shop. He built the
  site to sell to the shop owner. Treat the owner as the client; do not
  assume Yaseen can change the shop's Google/Bing listings, phone, or
  address — only the owner can.
- **Catalogue (verified 2026-11-19):** 42 products, 912 stock units,
  inventory value Rs 14,390,815, 5 sold out. Prices in PKR.

## Stack in one paragraph

Static HTML/CSS/JS (no build step, no framework) hosted on Vercel, backed
by Supabase (Auth, Postgres, RLS, RPCs). The shop page reads products live
from Supabase with a Realtime subscription; the hidden admin page at
`/adminaccess` lets an admin add/edit/delete products. Checkout is
WhatsApp COD — orders are **not** saved to Supabase. Stock is held for
15 minutes per checkout via atomic RPCs. Full flow: [`docs/architecture.md`](docs/architecture.md).

## Deploy truth — read before you touch anything

- The Vercel project has **no git link**. Pushing to GitHub **never**
  deploys. Deploys happen only by file upload from this folder.
- After any change, verify at the **live URL** (phone-sized view first),
  not from code counts alone. A fix is not done until the live page
  shows it.
- `supabase.sql` is the reviewed source of truth for the schema. It is
  **not** deployed as a file (it 404s live by design). Apply schema
  changes in the Supabase SQL Editor / via migration, then keep
  `supabase.sql` and `migrations/` in sync.

## Where to look

- [Architecture — how it fits together, request flow, Mermaid diagrams](docs/architecture.md)
- [Security — current posture: fixed, open, accepted, and why each fix works](docs/security.md)
- [Structure — folder-by-folder layout](docs/structure.md)
- [Files — one line per key file, what it does](docs/files.md)
- [Design — theme, components, UI/UX conventions](docs/design.md)
- [CHANGELOG — dated, append-only history; never rewrite old entries](docs/CHANGELOG.md)

## Rules for working on this project

1. **Check live first.** Before advising or changing anything, check the
   live site / live Supabase state. Never answer from cached analysis.
2. **Assigned scope only.** Do exactly what was asked, nothing extra.
   A per-PR / per-change go-ahead from Yaseen is required before any
   push or deploy.
3. **Never put secrets in the repo or in these docs.** No API keys,
   secrets, connection strings, passwords, admin emails, user ids, or
   session tokens — not even as an example. Reference env / config
   values by **name only**. Obviously-fake examples only
   (`example@example.com`). See [`docs/security.md`](docs/security.md).
4. **Admin access is server-enforced.** The `is_admin()` check + RLS
   policies are the real gate; the JS check in the admin page is defence
   in depth only. Never "fix" admin access by weakening a policy.
5. **Stock is money.** `reserve_stock` / `release_stock` /
   `release_expired_reservations` must stay atomic (single-statement
   `DELETE … RETURNING`). Never restore stock from a client-side count.
6. **Escape everything rendered.** All product/user text goes through
   `escHtml()`; all image URLs through `igSafeImgUrl()`. No raw
   `innerHTML` with unescaped data. See [`docs/security.md`](docs/security.md).
7. **Keep the docs alive.** After any fix or change: append a dated line
   to `docs/CHANGELOG.md` and update `docs/architecture.md` or
   `docs/security.md` if the change affects them. Stale docs are worse
   than no docs.
8. **SEO files are generated.** `sitemap.xml`, `products/`, `category/`
   come from `build_pages.py` — re-run it after a price/stock change,
   then deploy. Never remove the Google Search Console verification
   meta tag from `index.html`.

## Quick checks (live, 2026-11-19 20:30 PKT)

- Admin login: PASS (dashboard, 42 products). Logout: PASS.
- `/supabase.sql`: 404. Security headers: 7/7 on `/` and `/adminaccess`.
- Sign-up: disabled. Password minimum: 12. CAPTCHA server-side:
  **off by owner decision** — see [`docs/security.md`](docs/security.md).
- Admins: 1. Admins locked: 0.
