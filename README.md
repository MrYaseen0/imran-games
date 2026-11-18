# Imran Games — imrangames.pk

Best Game Shop in Peshawar, Pakistan. All over Pakistan COD Available.

Dark gaming e-commerce store for PS4 / PS5 games, consoles, controllers, headsets and accessories. Design based on the Behance Gaming Hardware E-commerce Landing Page Dark UI, branded Imran Games (pink #EC008C + blue #00AEEF on near-black #0B0D17).

- Live site: deployed on Vercel (see below)
- Shop: Shop #27/28, Block A, S.S Plaza, Karkhano Market, Hayatabad, Peshawar, 25000
- Phone / WhatsApp: +92-332-2202220
- Email: imrangames09@gmail.com
- Tagline: Eat. Sleep. Game. Repeat.

## Files

- `index.html` — the full store UI (exported from Muse, UI-first v2, 40 real products from imrangames.pk with exact PKR prices, 3 real photos per product)
- `logo.png` — transparent Imran Games gamepad logo (icon only, no background, no text)
- `supabase.sql` — products + orders tables for Supabase (run in the Supabase SQL Editor)

## Supabase (LIVE since 2026-11-18 — v10)

The store is Supabase-driven: `index.html` loads all products live from the `imran-games` Supabase project (`public.products`, 40 products, 3 Storage photos each in the `product-images` bucket) with a Realtime subscription — no hardcoded product list, no embedded photos (page is ~1.6 MB, was 6.6 MB). The anon key is embedded in the page (public-safe); writes are gated by the admin passcode header `x-admin-passcode` (RLS policies on INSERT/UPDATE/DELETE).

- **Admin panel** (footer link "Admin — Add / Edit Products"): add a product, edit price / old price / stock inline, delete with confirm. Unlock with the admin passcode (the shop owner has it — it is the value in the Supabase `products … by admin passcode` RLS policies; never commit it here). Writes go straight to Supabase PostgREST and appear on the site instantly via Realtime.
- **Checkout:** WhatsApp COD to +92-332-2202220 (delivery Rs 350, free above Rs 10,000). Orders are NOT saved to Supabase from this static page — anon order INSERT is blocked by RLS (42501) — so checkout stays WhatsApp-only.
- **Old WordPress site** (imrangames.pk) is untouched; audit PDFs live in `~/workspace/your_files/imran-games-audit/`.

## Status

UI-first v2 delivered 2026-11-18. Backend (React / Next.js + Supabase) is the next step.
