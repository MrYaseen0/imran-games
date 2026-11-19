# Design — Imran Games

## Theme

Dark gaming storefront. One stylesheet (`styles.css`), CSS variables
only — never hardcode a colour in a page; use a variable.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0B0D17` | Page background (near-black) |
| `--bg2` | `#0E1120` | Drawer / modal background |
| `--card` / `--card2` | `#121527` / `#171B31` | Cards, gradient top → bottom |
| `--line` | `rgba(255,255,255,.09)` | Borders, dividers |
| `--pink` | `#EC008C` | Primary accent, logo "IMRAN", CTAs |
| `--blue` | `#00AEEF` | Secondary accent, logo "GAMES", prices |
| `--text` | `#F4F6FF` | Body text |
| `--muted` | `#A7ADC4` | Secondary text |
| `--gold` | `#FFC531` | Stars, badges, countdowns |
| `--green` | `#22C55E` | In-stock |
| `--red` | `#E11D2E` | Badges, sold-out |

Gradient signature (use it, don't invent a new one): pink `#EC008C` →
purple `#7B2FF7` → blue `#00AEEF`. It appears in the topbar, the header
underline, the hero headline, and the primary buttons
(`btn-pink`: pink gradient; `btn-blue`: blue gradient).

## Typography

- **Display:** Orbitron — logo, hero headline, section headings, banners,
  countdown numbers. Uppercase, letter-spaced where the existing styles do it.
- **Body/UI:** Inter, system-ui fallback — everything else.
- Tagline: "Eat. Sleep. Game. Repeat."

## Components & patterns

- **Cards:** `border-radius: 20px`, `1px` `--line` border, `--card2` →
  `--card` gradient, hover lift (`translateY(-6px)`) with a coloured
  shadow (pink for active category, blue otherwise). Product cards use
  a staggered entrance (`--d` delay, 60 ms steps).
- **Buttons:** pill / `12px` radius, bold. Primary = pink gradient;
  secondary = blue gradient; ghost = translucent white + `--line`
  border. Add-to-cart spans the card width.
- **Badges:** pill, top-left (HOT = pink→orange gradient, red default);
  discount badge top-right, blue. Stock line: green "In Stock", amber
  "Low stock", red "SOLD OUT".
- **Header:** sticky, blurred (`rgba(11,13,23,.92)` + blur), 2 px
  gradient underline. Logo: "IMRAN" pink + "GAMES" blue, tagline
  "Official Game Shop in Peshawar" underneath.
- **Hero:** dark photo background + pink/blue radial glows, gradient
  headline (white → pink → blue), floating info cards.
- **Cart drawer:** fixed right, `min(420px, 94vw)`, `--bg2`, slides in;
  cart items are rounded cards with 64 px thumbs and quantity steppers.
- **Modal / lightbox:** centred box (`max-width: 880px`, 2-column on
  desktop), `22px` radius; lightbox is near-black (`rgba(0,0,0,.94)`).
- **Admin panel:** same dark theme as the shop — do not restyle it
  light. Tables are flex rows with `10px` dividers on `#232842`.

## Conventions for new work

1. **Match, don't reinvent.** New sections reuse the existing card,
   chip, button, and badge classes. A new colour or radius needs a
   reason, not a preference.
2. **Responsive first.** The shop is checked phone-sized first; the
   modal collapses to one column and the drawer goes full-width on
   small screens. Verify at the live URL on a phone-sized view.
3. **Images:** 600 × 450 product photos, `loading="lazy"`,
   `decoding="async"`, 3 photos per product (card, alt, fallback).
   Never upscale a small image.
4. **Copy:** prices in PKR (`Rs.` format via the shared `fmt()`
   helper), stock messages exactly as the existing strings ("In Stock
   — ships in 24 hours, COD available", "Low stock — only N left",
   "Sold Out — WhatsApp … to reserve the next piece").
5. **Accessibility basics already in place:** `alt` text on product
   images, `aria-label` on wishlist buttons, `summary`/`details` for
   FAQ. Keep them when you touch those elements.
6. **Do not change the brand.** Name everywhere is "Imran Games
   Officials"; wordmark stays "IMRAN GAMES". The Google Search Console
   verification meta tag in `index.html` must never be removed.
