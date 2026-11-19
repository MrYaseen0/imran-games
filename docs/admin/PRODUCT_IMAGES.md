# Product images — how it works (Wave 5, 2026-11-19)

One modal (`#prodModal` in `adminaccess/index.html`, logic in
`adminaccess/app.js`) handles **Add** and **Edit**. A product has **1–4
photos**; the first photo is the card photo (marked with a "Cover"
badge). Drag thumbnails to reorder, ✕ to remove one.

## Where photos live

- Storage bucket **`product-images`** (public read). Every photo URL
  stored in `products.image_urls` is a Supabase public URL of the form
  `https://<project>.supabase.co/storage/v1/object/public/product-images/<prefix>/<uuid>.webp`.
  The original link (Drive, Facebook, any site) is **never stored or
  hotlinked** — it is only ever used once, server-side, to fetch the
  bytes.
- File layout: `<prefix>/<uuid>.webp`, where `<prefix>` is the product
  UUID when editing, or `draft-<uuid>` while adding (the files stay
  under the draft prefix — the row still points at them, so they are
  not orphaned). Filenames are UUIDs, so uploads never overwrite.
- Limits (enforced in three places — bucket, Edge Function, client):
  **jpg/png/webp only, max 8 MB each, max 4 photos per product.**
  Device uploads are compressed in the browser to **WebP, max 1600px**
  (canvas, quality 0.85) before upload.

## The two ways to add a photo

1. **Drag & drop / "Choose from device"** — multi-select. Each file is
   validated (type, size), compressed to WebP, then uploaded by XHR
   straight to the bucket with the signed-in admin's session (real
   progress bar on the thumbnail). The Storage INSERT policy requires
   `is_admin()`, so a non-admin session is refused server-side.
2. **"Image URL" field + Add** — paste any direct image link:
   Google Drive share links (`file/d/ID/view`, `open?id=ID`,
   `uc?id=ID`), Facebook image links, or any direct link. The client
   sends `{url, prefix}` to the **`import-image` Edge Function** and
   attaches the Supabase URL it returns. The popup stays open on
   failure and shows the error in plain language.

## Edge Function `import-image`

- URL: `https://vnbaizpqucimomrfvfpd.supabase.co/functions/v1/import-image`
- Code: `~/workspace/imran-games-functions/supabase/functions/import-image/index.ts`
  (Deno/TypeScript). Deployed: ACTIVE v1, `verify_jwt` on.
- Auth: the caller sends its user JWT (`Authorization: Bearer <token>`
  + `apikey`). The function calls `auth.getUser(token)` and then the
  `is_admin()` RPC **as that user** — non-admins get 403. No auth
  header → gateway 401.
- SSRF protection: https only; the hostname is resolved with
  `Deno.resolveDns` (A + AAAA) and private/internal ranges are blocked
  (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, 100.64/10, 0/8,
  192.0/24, 198.18/15, TEST-NETs, multicast/reserved, ::1, fe80::/10,
  fc00::/7, IPv4-mapped). At most 3 redirects, host/IP re-checked on
  every hop.
- Fetch rules: content-type must be `image/jpeg`, `image/png` or
  `image/webp`; max **8 MB** (header check + streamed reader); **10 s**
  timeout (`AbortController`).
- Google Drive: share links are converted to the direct download form
  (`uc?export=download&id=ID`) before fetching.
- On success it stores the bytes in `product-images` and returns
  `{url, path, size, contentType}`. On failure it returns a
  plain-language `error`, e.g. *"This Drive file is not shared as
  Anyone with the link — open the file in Google Drive, click Share,
  and set it to 'Anyone with the link'."*
- Secrets: the function uses only the auto-injected `SUPABASE_URL` /
  `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY`. Nothing secret is
  in the code or the repo.
- Redeploy (Management API — the Supabase CLI rejects the `hsurr:`
  credential this project uses, so deploy via the API, same credential
  as `supabase.py`):
  `POST /v1/projects/vnbaizpqucimomrfvfpd/functions/deploy?slug=import-image`
  with a multipart form (`file` = the `index.ts`, `entrypoint_path` =
  `index.ts`). See `/tmp/deploy_import_image_curl.py` (deleted after
  use — token via a 0600 curl config file, never in argv/logs).

## Save / edit / delete

- **Save** writes the row immediately: name, brand, category, price,
  `was_price`, `deal_price`, stock, `is_hot`, `is_new`,
  `image_urls[1..4]`, `version`. Validation (inline, per field):
  name/brand/category required; price > 0 and ≤ old price when old is
  set; deal price > 0 and < new price; stock a whole number ≥ 0; at
  least 1 photo and no upload still in progress.
- **Optimistic locking:** edit sends
  `PATCH ?id=eq.<uuid>&version=eq.<loadedVersion>` with
  `version = loaded + 1`. If the row changed underneath, the PATCH
  matches 0 rows and the modal says "Someone changed this product —
  refresh and try again." (Same pattern as the Product Lists table
  Save, which also gained a Deal price column.)
- **Delete** (tap-twice confirm, Owner/Manager only — Viewer sees no
  buttons, Manager sees no delete; RLS enforces server-side anyway):
  deletes the row, then deletes the product's bucket files — the exact
  paths in `image_urls` plus anything listed under the
  `<product-uuid>/` prefix. If file cleanup fails, the row is still
  deleted, the toast warns, and the audit entry records
  `storage_files_removed: false`.
- **Audit:** every add/edit/delete writes `audit_log`
  (`product_added` / `product_edited` / `product_deleted`) with the
  old/new prices, stock, photo counts and (on delete/edit) whether the
  Storage cleanup succeeded.
- **Orphan cleanup:** files uploaded in a modal session that is closed
  **without** saving (Cancel, overlay click, ESC) are deleted by a
  `MutationObserver` on `#prodModal` — they are not referenced by any
  product. Removing a photo inside an edit deletes it immediately only
  if it was uploaded in that session; a photo that belongs to the saved
  product is deleted on Save (so Cancel keeps the product's photos).

## Deal price

- Column `products.deal_price numeric` (nullable, CHECK > 0).
  Migration: `migrations/2026-11-19-product-images.sql` (rollback in
  `migrations/2026-11-19-product-images-rollback.sql`).
- Shop (`index.html` `toPageProduct`): when `deal_price` is set and
  below the new price, the deal price is the shown price and
  `was_price` stays the struck-through old price. NULL today on all
  products, so behaviour is unchanged until an admin sets a deal.
  Admin tiles show the same deal price. Static JSON-LD / generated
  product pages do **not** show deal prices until `build_pages.py`
  re-runs + redeploy (documented SEO flow).

## Realtime

- `products` is in the `supabase_realtime` publication. The admin
  subscribes (channel `ig-admin-products`) and reloads the list, tiles,
  analytics and — when on the dashboard — the KPIs. The shop already
  subscribes (channel `ig-products`), so a save appears on the shop
  without refresh.

## When an import fails

| What the admin sees | What it means / what to do |
|---|---|
| "This Drive file is not shared as Anyone with the link" | In Google Drive: Share → General access → "Anyone with the link" (Viewer), then paste the link again. |
| "That link could not be opened (HTTP 400)" | The link answered with that HTTP status (private, expired, or not a direct image link). Check the share settings or use the direct image address. |
| "That link is not a direct image link — open the Facebook post…" | The link is a post/page, not the image itself. On Facebook: open the photo, right-click → "Copy image address", paste that. |
| "That image is too large (over 8 MB)" | Compress it or pick a smaller file; the limit is 8 MB per photo. |
| "That link did not return an image (content type …)" | The URL serves a page/file that is not jpg/png/webp. Use the direct image address. |
| "That image took too long to download" | Slow/large source — retry once; if it repeats, download the photo and upload it from the device instead. |
| "Sign in again and retry." | The admin session expired — log in again at `/adminaccess/login.html`. |
| Upload progress stuck / "Upload failed — try again." | Network or session problem — check the connection, log in again if needed, retry. The photo is not saved until its thumbnail shows "Cover"/filename with no progress bar. |

**Nothing is lost on a failed import:** the popup stays open, the
other fields and photos are untouched, and no half-saved product is
created — the row is only written when Save succeeds.

## Known inconsistencies (not fixed in Wave 5)

- The `ig.py` CLI caps photos at 3 and pads `image_urls` to 3 with
  duplicates — the admin UI now uses 1–4 real photos with no padding.
  If the CLI is ever used to edit a product, it will still pad.
- Static JSON-LD + generated product pages under `products/` carry the
  old prices until `build_pages.py` re-runs + redeploy.
