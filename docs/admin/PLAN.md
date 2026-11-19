# Admin Upgrade — Plan (Orchestrator)

- **Branch:** `feat/admin-upgrade` (created 2026-11-19, from `main`)
- **Target:** `/adminaccess` only. Public shop (`index.html`, `styles.css`,
  `category/`, `products/`) must stay unchanged and working after every step.
- **Reference:** Behance "DASSMART ECOMMERCE ADMIN DASHBOARD" + 5 screenshots
  in `~/workspace/imran-games-prompts-extract/` (`01-overview` … `05-dark-mode`).
  Screenshots win over the prompt text on any visual detail. Never copy the
  "Dass Mart" name, logo, people, avatars, or text.
- **Stack decision (lowest risk, from Recon):** keep vanilla HTML/JS, no build
  step, no framework. Reuse the already self-hosted Chart.js 4.4.1 for charts.
  Do **not** introduce React/Recharts/TS/build tooling for `/adminaccess` alone.

## Waves (Section 12 order)

1. **Recon & Audit — DONE first.** `ADMIN_AUDIT.md` (repo root) — read it before
   any code change. Nothing is built until Yaseen says "go" after the audit.
2. **Design System + Data & Backend in parallel.** Tokens/components
   (`docs/admin/CONTRACTS.md`); new tables/views/RPCs as SQL migrations only.
3. **App Shell + Security + Auth Screens.** Sidebar/topbar/routing/theme;
   RLS + role model + route guards; login/reset restyled, flows unchanged.
4. **Dashboard, Orders, Products, Reports/Customers/Settings in parallel.**
5. **QA · A11y · Perf.** Screenshot comparison light + dark, Playwright flows,
   axe, Lighthouse, shop smoke test.
6. **Docs & Handover.** `docs/admin/README.md`, rollback notes, finished screenshots.

## Rules for every agent

- Edit **only** the files you own (Section 12 table). Communicate through
  `CONTRACTS.md` (data shapes, API names, component props, token names).
- Commit small; write a short note in `docs/admin/CHANGELOG.md` per task.
- **Preview only, never production without Yaseen's approval.** Note: this
  Vercel project has **no git link** — a git branch does **not** auto-deploy.
  A preview means a file-upload deploy with a preview target, verified at
  its preview URL. GitHub pushes never deploy.
- **No demo numbers, ever.** Every KPI/chart/table reads Supabase. Empty /
  zero states where there is no data (see Audit §5 — orders do not exist yet).
- **No secrets in repo/docs.** Names only, never values. No service-role key
  in client code, ever.
- Keep `noindex, nofollow` on `/adminaccess`; no public link to it anywhere.
- After each wave, the Orchestrator posts a status table and waits for "go".

## Open questions for Yaseen (do not guess)

1. Social links for the sidebar bottom (Facebook / Instagram / WhatsApp):
   the shop footer has **no** social links — only email + phone. Which URLs?
2. Order/payment methods in use: checkout today is WhatsApp COD only, no
   orders are saved. Is the Orders page meant to record WhatsApp orders
   manually, or stay empty until an order system exists? (Audit §5)
3. Admin roles to create: Owner / Manager / Viewer — who is who? Today there
   is exactly 1 admin and no role column.
4. Supabase access: migrations need the owning account (his Gmail holds only
   `qec-page` + `yaseen-portfolio`, not `imran-games`). Who applies the SQL?
5. CAPTCHA: keep the existing invisible hCaptcha (server-side OFF by owner
   decision) or switch to Turnstile as the prompt suggests? Default: keep
   hCaptcha, do not switch without a decision.

## Status

| Wave | State |
|---|---|
| 1 Recon & Audit | Done — `ADMIN_AUDIT.md` delivered, awaiting Yaseen's "go" |
| 2 Design System + Data | Not started — needs "go" |
| 3 Shell + Security + Auth | Not started |
| 4 Pages | Not started |
| 5 QA | Not started |
| 6 Docs & Handover | Not started |
