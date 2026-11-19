# Auth & App Shell — Imran Games Admin (`/adminaccess`)

- **Wave:** 3, Agent 5 — App Shell + Security + Auth
- **Branch:** `feat/admin-upgrade`
- **Files:** `adminaccess/login.html` (new), `adminaccess/index.html`
  (rewritten — dashboard shell only), `adminaccess/app.js` (new),
  `adminaccess/admin.css` (appended §12 login styles only), this file.
- **Status:** code complete, **not live-tested** — the live login →
  dashboard → logout test is Wave 3 QA by the orchestrator (see §6).

## 1. The split — what lives where

Before Wave 3 the login view and the dashboard lived in one file
(`adminaccess/index.html`, `loginView` + `dashView` toggled by JS), so a
logged-out visitor received the dashboard markup and all its data code.
That is fixed now:

| Page | Who receives it | What it contains |
|---|---|---|
| `adminaccess/login.html` | **Everyone** (logged-out visitors) | Login card, forgot-password card, reset-password card, invisible hCaptcha widget (same public sitekey), "Back to shop". No dashboard markup, no product/analytics code. |
| `adminaccess/index.html` | Only a signed-in admin (see §4 guard) | App shell (sidebar, topbar, routes) + the existing dashboard content (`#/dashboard`). No login markup at all. |
| `adminaccess/app.js` | Loaded by `index.html` only | Session guard, shell (routing/theme/sidebar/topbar/search), and all dashboard data functions. |
| `adminaccess/ui.js` + `admin.css` | Both pages | Design-system helpers/theme (Wave 2). Login uses the `.ig-login-*` classes; the dashboard uses the shell classes. |

The public shop (`index.html`, `styles.css`), `supabase.sql`,
`vercel.json`, and `ui.js` are untouched. No deploy, no commit, no SQL
was run in this wave.

## 2. Login logic — moved verbatim

The following were copied **exactly** from the old `index.html` into
`login.html` (login side) / `index.html` + `app.js` (dashboard side).
No behaviour was "improved". The two files share the same constants:

- `SB_URL`, `SB_ANON` — the publishable anon key already in the file
  (never any other key; no service-role key exists anywhere in the repo).
- `igStorage` — remember-me session/local split, default **unchecked**
  (`localStorage` only when `ig_remember === "1"`, else `sessionStorage`).
- `IG_IDLE_MS` (30 minutes) + `igBumpActivity()` +
  `igStoredLastActivity()` + `igClearAuthStorage()` (clears `sb-*` tokens
  from both storages).
- `ensureSb()` + `igLoadSupabaseLib()` (lazy client, vendor fallback).
- `igDoLogin()` — hCaptcha invisible `execute()` + 30s poll,
  `signInWithPassword` with `captchaToken` when present, 15s race
  timeout, generic error messages only, `logFailedLogin()` on invalid
  credentials, `hcaptcha.reset()` on error.
- `isCurrentUserAdmin()` (RPC `is_admin()`) +
  `igShowAdminIfAllowed()` — a non-admin is signed straight back out,
  no `login_success` audit.
- `logAudit()` / `login_success`, `logFailedLogin()`, `getAdminIP()`,
  `currentActorEmail()`, `sbHeaders()`.
- Forgot-password flow (`resetPasswordForEmail`, see adaptation A1),
  reset-password flow (12-char minimum, mismatch check, sign-out +
  storage clear after update), `checkRecovery()` (`type=recovery` in
  the hash shows the reset card).
- Boot stale-session refusal: last activity > 30 min → sign out, clear
  storage, "Signed out after 30 minutes of inactivity — log in again."
- Idle timer: 60s check, `ADMIN_UNLOCKED` gate, 30 idle minutes → sign
  out with the idle message.
- `showToast()`, password eye toggle, card switching (`showCard`),
  Enter-to-submit on email/password.
- Dashboard data functions (in `app.js` only, unchanged in behaviour):
  `loadProducts`, `sbWrite`, `renderAdminList`, `renderAnalytics`,
  `loadAuditLog`, `logAudit`, `logFailedLogin`, `escHtml`,
  `igSafeImgUrl`, `fmtPKT`, `subscribeRealtime`, plus `toAdminProduct`,
  `CATMAP`, `slugify`, `sbHeaders`, `renderFlow`, `drawChart`,
  `fmtNum`, the image-error logo fallback, the add-product handler
  (`npAdd`), the product-list Save/Delete handler (optimistic locking
  via `version`, tap-twice delete), and the `adminLock` /
  `adminLockTop` logout wiring.

## 3. Adaptations — the only logic changes

### A1 (briefed) — reset link lands on `login.html`
`resetPasswordForEmail` `redirectTo` changed from
`https://imrangamesofficials.vercel.app/adminaccess/` to
`https://imrangamesofficials.vercel.app/adminaccess/login.html`.
Reason: the reset card now lives on `login.html`, which owns
`checkRecovery()`; the old URL would have landed on the dashboard
page, which has no reset card. The reset flow itself is unchanged.

### A2 (briefed) — sign-out hands over to `login.html`
`signOutAdmin()` on the dashboard no longer toggles views (there is no
login view here). It audits `logout`, signs out, clears storage, then
`location.replace("login.html?signed-out=1")`. `login.html` boot reads
the param and shows "Signed out." in `#adminMsg`. `replace` (not
`href`) so Back does not return to the signed-out dashboard.

### A3 (split-forced) — `showAdmin()` is now a handover, per page
- **Login page:** `showAdmin(email)` schedules
  `location.replace("index.html")` after 1500ms. The delay exists so
  the `login_success` audit that `igDoLogin()` awaits right after
  `igShowAdminIfAllowed()` returns has time to be dispatched before
  navigation (see §5 caveat).
- **Dashboard page:** `showAdmin(email)` sets `ADMIN_UNLOCKED=true`,
  reveals `#adminBody`, fills `#adminWho` and the topbar avatar
  (initial + email), then `renderAdminList()` / `getAdminIP()` /
  `loadAuditLog()` / `renderAnalytics()` — the same calls as before,
  minus the `loginView`/`dashView` toggling (this page IS the dashboard).

### A4 (split-forced) — messages that used to print on a login view
`igSetMsg()` does not exist on the dashboard, so the paths that used it
now redirect with a reason and `login.html` renders the message:
- Idle timeout → `signOutAdmin("idle")` → `login.html?signed-out=idle`
  → "Signed out after 30 minutes of inactivity — log in again."
- Non-admin sign-in → `igShowAdminIfAllowed()` signs out, clears
  storage, `location.replace("login.html?error=not-admin")` →
  "This account doesn't have admin access."
- Stale session at dashboard boot → same `?signed-out=idle` redirect.

### A5 (split-forced) — boot is split by page
- `login.html` boot: **no** `loadProducts()` / `subscribeRealtime()`
  (no dashboard markup here). It reads the redirect reasons (§3 A2/A4),
  runs `checkRecovery()`, then the stale-session check; a valid session
  hands over to `index.html` via A3.
- `app.js` boot (new session guard): `ensureSb()` → `getSession()` →
  no session (or lib unloadable) → `location.replace("login.html")`;
  stale session → sign out + `?signed-out=idle`; valid session →
  `igShowAdminIfAllowed()` → only when `ADMIN_UNLOCKED` do
  `loadProducts()` / `subscribeRealtime()` run.

### Small, non-logic notes
- The toast element is now `<div class="ig-toast" id="toast">` on both
  pages (was `class="toast"`); `showToast()` only toggles the `show`
  class, which `.ig-toast.show` already defines. Same behaviour.
- `login.html` keeps a no-op `loadAuditLog()` stub because `igDoLogin()`
  calls it in a `try/catch` after sign-in; the real list loads on the
  dashboard (`app.js`).
- Dashboard content (`#/dashboard`) is moved **intact** — same markup,
  same inline dark styles, same element IDs. It sits inside a dark
  wrapper (`background:#0B0D17`) in the light shell so it looks the same
  until Wave 4 restyles it with `.ig-card` etc. The only carried-over
  CSS is the legacy `.btn` / `.btn-pink` / `.btn-ghost` block at the top
  of `index.html` (marked for deletion in Wave 4); the old purple login
  header styles are gone with the login view.
- Login restyle: the old purple gradient header is replaced by the
  design-system look — logo + primary-tinted "Hello 👋 Welcome!" pill,
  `.ig-login-wrap` / `.ig-login-card`, `.ig-input` fields,
  `.ig-btn-primary` button (new appended rules in `admin.css` §12;
  the §10 `.ig-login-*` rules were already there and are unchanged).
  Note the tension this resolves: `DESIGN_SYSTEM.md` §4 said the login
  restyle was a Wave 10 target — the Wave 3 brief ordered the restyle
  now ("only restyle it", logic untouched), so it was done here.
- Avatar shows the admin email's first initial + email; the role label
  under it is the static word "Admin" until Wave 4 reads the real role
  from `admin_profiles`.

## 4. How the guard, idle timeout, and lockout interact

1. **Entry:** `index.html` never renders data for a logged-out visitor —
   the boot guard redirects to `login.html` before any product load.
   The guard is a redirect, not a server gate: RLS + `is_admin()` are
   still the real enforcement (per `CONTRACTS.md`).
2. **Login:** `igDoLogin()` → `is_admin()` RPC → non-admin signed out
   immediately (A4). Admin → `login_success` audit → handover to
   `index.html` (A3) → guard passes → dashboard unlocks.
3. **Idle:** activity bumps `ig_last_activity` (throttled to 30s
   persists). 60s check: 30 idle minutes → `signOutAdmin("idle")` →
   login with the idle message. A stale *restored* session is refused
   at boot on both pages (A5 / login boot).
4. **Lockout (H-03, unchanged):** `logFailedLogin()` records failures;
   the server-side lock (`locked_until`, 5-in-15 → 15-min lock, per-IP
   throttle) still applies. Nothing in this wave touches auth settings,
   CAPTCHA config, login logic, or admin accounts.
5. **Sign-out:** every logout path (both Log Out buttons, avatar menu
   Log Out, idle timeout) audits `logout`, signs out, sweeps both
   storages (`igClearAuthStorage`), and lands on `login.html` with a
   reason (A2/A4). Back-button return to the dashboard is blocked by
   `location.replace` + the boot guard.

## 5. Shell behaviour (new in this wave)

- **Routes:** `#/dashboard` (default), `#/orders`, `#/products`,
  `#/reports`, `#/customers`, `#/settings`. Hash routing in `app.js`
  (`igCurrentRoute` / `igRenderRoute`); unknown hash → `#/dashboard`.
  Last route is remembered in `localStorage` (`ig-admin-route`) and
  restored when the page loads with no hash. Back/forward work.
- **Non-dashboard routes** show an honest empty state
  ("Orders — coming in Wave 4." etc.) — no demo data, no fake numbers.
- **Sidebar:** ~240px electric-blue (`#0a00ff` light / `#101a55` dark),
  6 nav items with inline SVG icons, active = white pill. Collapses to
  the 72px rail via the `«` button in the topbar (`body.ig-rail`) and
  automatically at 1024–1279px (CSS); under 768px it is a slide-in
  drawer (`☰` button, scrim dismisses, closes on route change).
  Footer: "← Back to shop" only — the social block
  (`.ig-sidebar-social`) stays `display:none`: no social links were
  provided, none invented.
- **Topbar:** global search pill (`/` focuses it; typing filters the
  dashboard product rows by text, DOM-level only), theme toggle
  (`data-ig-theme-toggle`, `IGAdminUI`, key `ig-admin-theme`, no-flash
  snippet in `<head>` on both pages), bell (badge starts at 0/hidden;
  clicking clears it — no notification source yet), avatar menu
  (Profile / Settings / Log Out; closes on outside click / ESC via
  `ui.js`).
- **Theme:** `localStorage` key `ig-admin-theme`, default
  `prefers-color-scheme`; the `<head>` snippet runs before `admin.css`
  so there is no flash.

## 6. Acceptance checks (Wave 3 QA — orchestrator, live)

- [ ] `login.html`: loads alone, login card + forgot + reset cards
  render, hCaptcha widget present (invisible), no dashboard markup in
  source.
- [ ] Wrong password → generic error, `login_failed` audit row.
- [ ] Right password → `login_success` audit row, lands on
  `index.html#/dashboard`, products + analytics + audit log render.
- [ ] `index.html` with no session → redirects to `login.html`.
- [ ] Log Out (both buttons + avatar menu) → `login.html?signed-out=1`,
  "Signed out." shown; Back does not reopen the dashboard.
- [ ] Idle 30 min → sign-out with the idle message (code only — the
  live 30-min wait was already untestable in the 2026-11-19 audit).
- [ ] Non-admin sign-in → signed out, `login.html?error=not-admin`.
- [ ] Forgot → reset link lands on `login.html`, reset card shows,
  12-char minimum enforced, new password logs in.
- [ ] Theme toggle persists across both pages, no flash on load;
  routes switch, last route remembered; mobile drawer works.
- [ ] Shop smoke test: home loads, products show, add to cart works.

## 7. Known caveats (for QA, not hidden)

- **Login_success audit race (A3):** the 1500ms redirect delay is a
  heuristic. On a very slow connection the audit POST may still be cut
  off by navigation. QA should confirm the `login_success` row exists
  after a live login; if it is missing, the fix is `keepalive: true`
  on the audit fetch (Wave 4), not a longer delay.
- **Dashboard content was the old dark markup** inside the new light
  shell (see §3) until Wave 4 restyled it to the reference (see §8).
  Wave 5 does the side-by-side screenshot comparison.
- **No live render was done in this wave** (no browser here): HTML tag
  balance was checked by eye, `node --check app.js` passed (see
  report). Contrast ratios and the live login flow are QA's job.

## 8. Wave 4 — root-relative paths (2026-11-19, the Wave 3 live fix)

- **Root cause:** Vercel `cleanUrls` serves the dashboard at
  `/adminaccess` with no trailing slash, so every relative asset URL
  resolved against the site root and 404'd — `admin.css` →
  `/admin.css`, `ui.js` → `/ui.js`, `app.js` → `/app.js`. With no CSS
  and no JS the dashboard rendered unstyled, with no products, dead
  routes, and a dead Log Out. The login page worked only because its
  URL (`/adminaccess/login`) resolves relatives against
  `/adminaccess/`.
- **Fix:** every asset and navigation URL in `login.html`,
  `index.html`, and `app.js` is now root-relative:
  `/adminaccess/admin.css`, `/adminaccess/ui.js`,
  `/adminaccess/app.js`, `/adminaccess/login.html`,
  `/adminaccess/` (dashboard), `/logo.png`,
  `/vendor/supabase-js-2.119.1.min.js`,
  `/vendor/chart-4.4.1.umd.min.js`. The password-reset `redirectTo`
  keeps its full `https://imrangamesofficials.vercel.app/adminaccess/login.html`
  URL. A scripted check resolves every literal URL against both
  `/adminaccess` and `/adminaccess/` — all resolve to files in the
  deploy folder. No relative `src`/`href`/`location.replace` remains
  in either page or in `app.js`.
- **Rule going forward:** never use a bare relative asset path in the
  admin area — always root-relative. (`../logo.png` and
  `../vendor/…` happened to resolve correctly from both bases, but
  they were changed anyway so there is exactly one rule.)
- **What else changed in Wave 4** (same wave, same files): the
  dashboard, orders, and products routes were rebuilt to the
  reference screenshots with real Supabase data (see
  `docs/CHANGELOG.md` 2026-11-19 Wave 4 entry). Login logic,
  CAPTCHA config, and auth settings are still unchanged.
