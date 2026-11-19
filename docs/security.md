# Security — Imran Games

> Living source of truth, not a one-time snapshot. Update this file
> every time a finding is fixed or a posture changes, and append a dated
> line to [`CHANGELOG.md`](CHANGELOG.md) at the same time.
>
> State below is as verified live on **2026-11-19 20:30 PKT**
> (audit closed 20:34 PKT). Evidence reports live outside this repo in
> the audit folder; this file summarises what they proved.

## Current state at a glance

| # | Finding | Status |
|---|---|---|
| C-01 | Any authenticated user treated as admin | **Fixed + verified** |
| H-02 | RLS / audit objects not in `supabase.sql` | **Fixed + verified** |
| H-03 | No rate limiting / lockout on login | **Fixed + verified** (CAPTCHA part: owner chose OFF) |
| H-04 | Stored XSS via incomplete escaping | **Fixed + verified** |
| H-05 | Session in `localStorage`, no idle expiry | **Fixed + verified** (idle timer: code/harness only) |
| H-06 | `/supabase.sql` publicly downloadable | **Fixed + verified** |
| H-07 | No CSP / framing protection | **Fixed + verified** (CSP keeps `'unsafe-inline'` — accepted) |
| M-01 | Missing headers; wildcard CORS | **Fixed + verified** |
| M-02 | Unpinned CDN dependency, no SRI | **Fixed + verified** |
| M-03 | Weak password policy (6-char reset) | **Fixed + verified** |
| M-04 | Password-reset mail may not be configured | **Owner-pending** |
| M-05 | Audit IP is client-supplied | **Accepted** |
| M-06 | Duplicate raw-auth fallback path | **Fixed + verified** |
| M-07 | Anon key + project URL hardcoded in pages | **Accepted** |
| L-01 | No CSRF token | **Accepted** |
| L-02 | Login errors distinguish invalid credentials | **Fixed + verified** |
| L-03 | Logout relies on SDK token cleanup | **Fixed + verified** |
| — | Reserve-stock race + weak session key | **Fixed + verified** |
| — | CAPTCHA server-side enforcement | **Off by owner decision** |

13 fixed + verified, 3 accepted with reasons, 1 left open by owner
decision (CAPTCHA). No finding is left unaddressed without a recorded
reason.

## Fixed — and why each fix works

### C-01 — admin role check (Critical, fixed + verified)

**Was:** any authenticated Supabase user was treated as admin. The
admin page's gate was client-side only, and the products write policies
were permissive (`authenticated`, true), so any signed-in account could
write products and read the audit log.

**Fix — why it works:** a `public.admins` table (one row per admin,
keyed by Auth user id, RLS enabled with **no policies** — no client
access at all) plus a `SECURITY DEFINER` function `is_admin()` that
returns true only for a row in that table. The same function gates
*both* layers: the JS check in the admin page **and** the RLS write
policies (`authenticated AND is_admin()`). So even if the JS gate were
bypassed, the database refuses the write (403). The permissive policies
were **dropped** — this matters because RLS policies are OR'd, so
adding an admin-only policy alone would not have fixed anything.

**Verified:** non-admin refused + write 403; real admin PASS (42 products).

### H-03 — login hardening (fixed + verified)

Sign-up disabled, password minimum 12 (Auth config). `is_admin()`
also denies while locked. `log_failed_login()` logs each failure,
silently drops logging from one IP after 10 failures/hour, and locks
the admin for 15 minutes after 5 failures for one email in 15 minutes.
Lock verified end-to-end (login refused, lock cleared, resume PASS).

**Residual risk (accepted with mitigations):** `log_failed_login()` is
anon-callable, so someone who knows the admin email can spam it and
trigger a 15-minute lock. Mitigations: per-IP throttle, short lock,
dashboard unlock (`admins.locked_until = null`). The stronger GoTrue
password-verification hook remains available if this is later judged
unacceptable.

### H-04 — stored XSS (fixed + verified)

All rendered product/user text goes through `escHtml()` (escapes
`& < > " ' \``) and all image URLs through `igSafeImgUrl()` (rejects
`javascript:` / `data:` / `vbscript:` schemes and protocol-relative
URLs; only `https://` or site-relative paths pass). Applied on the
admin list **and** the shop card render, and image URLs are sanitised
at ingestion too. Verified: escaping harness 48/48, API checks 27/27,
live DOM check 6/6.

### H-05 — session storage / idle timeout (fixed + verified, idle live test pending)

Remember-me unchecked by default; 30-minute idle timeout signs the
admin out with a clear message; logout and password-update sweep all
`sb-*` keys from both storages (`igClearAuthStorage()`). The idle
timer was verified by code and harness only — a live 30-minute idle
check in a real browser was not testable from the cloud browser and
remains an optional manual confirmation by the owner.

### H-06 — schema file exposed (fixed + verified)

`supabase.sql` is excluded from the Vercel deploy. Live
`/supabase.sql` returns 404 (checked 3×). The file still lives in
this repo as the reviewed schema source of truth — it is documentation,
not a deployed asset.

### H-07 / M-01 — headers (fixed + verified)

`vercel.json` sends 7/7 headers live on `/` and `/adminaccess`: CSP,
`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
Referrer-Policy, Permissions-Policy, COOP, and a restricted CORS
origin (no wildcard). **Accepted limitation:** CSP keeps
`'unsafe-inline'` because the pages use heavy inline script/style;
a strict CSP needs an external-JS refactor (out of scope).

### M-02 / M-06 / M-03 / L-02 / L-03 (fixed + verified)

- **M-02:** supabase-js 2.119.1 + Chart.js 4.4.1 self-hosted and
  pinned; zero CDN references remain (hCaptcha's own script excepted).
- **M-06:** the raw `POST /auth/v1/token` fallback login path was
  deleted; SDK-only login.
- **M-03:** server password minimum is 12; an 8-char password gets
  HTTP 422; reset form updated.
- **L-02:** one generic login error — "Wrong email or password —
  try again." — for every failure.
- **L-03:** logout sweeps auth storage (see H-05).

### Reserve-stock race + session key (found during remediation, fixed + verified)

`release_stock()` / `release_expired_reservations()` were read-then-
update: two parallel releases could restore stock twice. Rewritten as
single-statement `DELETE … RETURNING` with the summed total restored
in the same statement. Parallel-release test: restores +1, not +2.
Session keys are now 128-bit random.

## Open / owner-pending / accepted

### CAPTCHA — server-side OFF by owner decision (2026-11-19 20:34 PKT)

- The invisible hCaptcha widget is **live** on the login form (verified:
  no checkbox, dashboard loads, 42 products).
- Server-side enforcement was attempted twice and failed twice, then
  rolled back both times (login rejected even after solving the
  challenge; password unchanged, so both were captcha-verification
  failures, not password failures).
- **Root cause found:** the stored secret was 64 characters; a real
  hCaptcha secret is 42 characters starting with `0x`. The pasted
  value was not a valid secret. The original secret is unrecoverable
  (shown once at generation). Rotations used: 2 of 3 — **1 left**.
- **Protection still in place without CAPTCHA:** 5-in-15 lockout,
  per-IP throttle (10/hour), password minimum 12, sign-up disabled.
- **To enable later:** generate a fresh secret (1 rotation left),
  check it starts with `0x` and is 42 characters **before** pasting,
  submit via the secure form, then enable and re-test the login.
  Never leave enforcement ON with an unverified secret — a wrong
  secret locks the admin out of every login.
- hCaptcha Pro trial ends 3 December 2026; no card on file, so no
  charge is possible — confirm it falls back to the free plan.

### M-04 — password-reset mail (owner-pending)

No custom SMTP configured; built-in mailer, delivery untested.
Owner to configure a custom SMTP provider or accept the built-in
mailer (rate limit 2, delivery untested).

### Owner-pending (not agent work, by design)

1. **Admin password rotation** — owner's job, in the browser.
   12+ characters, memorable, nothing reused. No agent ever touches
   the real admin credential.
2. **M-04 SMTP** — see above.
3. **hCaptcha Pro trial** — ends 3 Dec 2026 (see above).
4. **CAPTCHA server-side** — see above.

### Accepted (with reasons — do not "fix" without re-deciding)

- **M-05:** audit IP is client-supplied and untrustworthy. No
  server-side IP exists for static JS; the audit IP is display-only.
- **M-07:** the anon key is embedded in every page. It is publishable
  by design; RLS is the control. No `service_role` key exists anywhere
  in the client code — keep it that way.
- **L-01:** no CSRF token. Bearer-header auth, no cookies — CSRF does
  not apply.

### Open by design

- **Per-session reservation cap:** an anonymous visitor can
  temporarily drain stock via repeated 15-minute holds; it self-heals
  on expiry. Left open by design (low severity).
- **Session expiry:** never directly observed (open question, not a
  pass). Observed config only: JWT expiry 3600s, refresh-token
  rotation on.

## Hard rule — secrets

No API keys, secrets, connection strings, passwords, admin emails,
user ids, or session tokens go in this repo or in these docs — anywhere,
even as an example or a "redacted-looking" placeholder that resembles
a real value. Reference environment / config values by **name only**.
If a concrete example is genuinely needed, invent an obviously-fake
one (`example@example.com`). Grep every file you write for anything
that looks like a real key, email, or id before finishing, and fix
anything you find.

Note: the anon key embedded in the pages predates this rule and is
accepted under M-07 (publishable by design). That acceptance covers
the existing key only — it is not permission to add new secrets.
