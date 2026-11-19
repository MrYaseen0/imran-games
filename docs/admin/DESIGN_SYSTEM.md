# Design System — Imran Games Admin (`/adminaccess`)

- **Wave:** 2, Agent 2 — Design System
- **Branch:** `feat/admin-upgrade`
- **Files:** `adminaccess/admin.css`, `adminaccess/ui.js` (both new, vanilla only)
- **Sources:** `docs/admin/CONTRACTS.md` (tokens, routes, components) +
  the 5 reference screenshots in `~/workspace/imran-games-prompts-extract/`
  (`01-overview` … `05-dark-mode`, all 5 viewed).
- **Scope:** the admin area only. The public shop is untouched — its theme
  lives in `docs/design.md` and `styles.css`. (Note the tension, resolved by
  the upgrade brief: the shop stays dark-gaming; the admin follows the
  reference dashboard — light-first with a dark mode — because the brief
  says the screenshot wins on visual details.)
- **Hard rules kept:** no "Dass Mart" name, logo, people, avatars, or text
  anywhere. No social links were provided, so the sidebar social block is
  **hidden by default** — see §5. No fake data anywhere: helpers render
  only what the caller passes in; empty states and "No ratings yet" are
  the correct output where data does not exist.

## 1. How to use these files (Wave 3)

Dashboard page (Wave 3, App Shell):

```html
<head>
  <!-- 1. No-flash theme snippet FIRST, before admin.css (see §3) -->
  <script>
  try{var t=localStorage.getItem("ig-admin-theme");
    if(!t)t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
    document.documentElement.setAttribute("data-theme",t);}catch(e){
    document.documentElement.setAttribute("data-theme","light");}
  </script>
  <link rel="stylesheet" href="admin.css">
</head>
<body class="ig-admin">
  <!-- AppShell markup: .ig-shell > aside.ig-sidebar + div.ig-main -->
  <script src="ui.js"></script>
  <script>
    IGAdminUI.initTheme();
    IGAdminUI.initTopbar();
    IGAdminUI.initGlobalSearch(function (q) { /* Wave 3: filter products/orders/customers */ });
  </script>
</body>
```

- `admin.css` is self-contained: no other stylesheet is needed on the
  dashboard page. Do **not** load the shop `styles.css` there — the two
  themes would fight (different `--text`, `--card`, radius, and fonts).
- `ui.js` exposes `window.IGAdminUI`. Every function is a no-op when its
  elements are absent, so the file is safe to load on the login page too.
- Login page: keep its current styles until Wave 10. The `.ig-login-*`
  classes in `admin.css` (§4) are the restyle target for Wave 10 — do not
  wire them up in Wave 2 or 3.

## 2. Tokens

All colours are CSS variables on `:root[data-theme="light"]` (default) and
`:root[data-theme="dark"]`. Never hardcode a colour in page markup — use a
variable. Values marked (≈) were read from the screenshots and are
estimates; see §7 for what was and was not verified.

### Light theme (`:root`, `:root[data-theme="light"]`)

| Token | Value | Use |
|---|---|---|
| `--sidebar-bg` | `#0A00FF` | Electric-blue sidebar, full height |
| `--sidebar-text` | `#FFFFFF` | Sidebar labels / icons |
| `--sidebar-active-bg` | `#FFFFFF` | Active nav pill (white, bleeds to right edge) |
| `--sidebar-active-text` | `#0A00FF` | Active nav label / icon |
| `--sidebar-hover-bg` | `rgba(255,255,255,.12)` | Nav hover |
| `--page-bg` | `#F0F1FA` | Soft lavender-grey content background |
| `--card-bg` | `#FFFFFF` | Cards, topbar, modal, drawer |
| `--card-shadow` | `0 2px 8px rgba(20,20,60,.18)` | Card shadow |
| `--topbar-bg` | `#FFFFFF` | Topbar (2px bottom border) |
| `--search-bg` | `#E4E4E4` | Grey search pill |
| `--table-head-bg` | `#E3DEDE` | Warm light-grey header row |
| `--table-line` | `#BDBDBD` | Row separators, input borders |
| `--text` | `#0D0D0D` | Body text |
| `--text-muted` | `#7A7A85` | Muted labels |
| `--primary` | `#0A00FF` | Buttons, links, active states |
| `--success` | `#22C55E` | Positive %, delivered |
| `--danger` | `#E11D1D` | Notification badge, negative, delete |
| `--warning` | `#F59E0B` | Pending, low stock |
| `--chart-blue` / `--chart-green` | `#0A00FF` / `#A8D98A` | Revenue / Sale lines |
| `--chart-orange` / `--chart-yellow` / `--chart-grey` | `#E8650A` / `#FFEB00` / `#C4C4C4` | Donut slices |
| `--tile-bg` | `#F8E4E4` | Pinkish product tile |
| `--discount-bg` | `#8FE04A` | Green `-16%` badge (text `#14532D`) |

### Dark theme (`:root[data-theme="dark"]`, screenshot 05)

| Token | Value |
|---|---|
| `--sidebar-bg` | `#101A55` |
| `--page-bg` | `#141E5C` |
| `--card-bg` | `#1B2A6E` |
| `--topbar-bg` | `#14215F` |
| `--search-bg` | `#22337E` |
| `--table-head-bg` | `#1A2A70` |
| `--table-line` | `rgba(255,255,255,.14)` |
| `--text` | `#FFFFFF` |
| `--text-muted` | `#A9B2E0` |
| `--primary` | `#3B3BFF` |
| `--tile-bg` | `#27388A` |
| `--card-shadow` | `0 6px 18px rgba(0,0,0,.35)` |

Chart hues stay the same in dark mode; grid lines are
`rgba(255,255,255,.12)` (Chart.js config, Wave 4 — not in this CSS).

### Layout tokens

- Sidebar `--sidebar-width: 240px`; collapsed rail `--sidebar-rail-width: 72px`.
- Content padding `--content-padding: 32px`; grid gap `--grid-gap: 24px`.
- Card radius `--radius-card: 8px` (cards 6–8px in the reference);
  input/pill radius `--radius-input: 6px`; full pill `--radius-pill: 999px`.
- Topbar height `--topbar-height: 64px`.

### Typography

- Font: Roboto, Inter fallback, system-ui. (No webfont is loaded by these
  files — Wave 3 may add Roboto via the existing font stack; Inter is
  already used by the shop/admin.)
- Page titles (`.ig-page-title`): 900, UPPERCASE, 28–32px (30px default,
  24px under 768px).
- Card titles (`.ig-card-title`): 12–14px, 700, UPPERCASE.
- Body/table: 13–14px. Sidebar labels: 11–12px, 700, UPPERCASE,
  letter-spacing `.03em`, with an outline icon on the left.

## 3. Theme — init, persist, no flash

- Key: `localStorage` **`ig-admin-theme`** (`"light"` / `"dark"`).
- Default when nothing is stored: `prefers-color-scheme`.
- Toggle: the sun icon in the topbar (`[data-ig-theme-toggle]`;
  `ui.js` swaps it to a moon in dark mode, sets `aria-pressed`).
- **No flash:** the snippet in §1 must run in `<head>` before `admin.css`.
  `IGAdminUI.initTheme()` in `ui.js` is only the fallback — it sets the
  theme on `DOMContentLoaded` if the `<head>` snippet did not already set
  `data-theme`. A page that loads `ui.js` without the snippet will flash
  light before switching; that is a Wave 3 wiring bug, not a token bug.
- `IGAdminUI.getTheme() / setTheme(t) / toggleTheme()` are exposed for
  Wave 3 (e.g. a theme choice in Settings).

## 4. Components

Every component is a CSS class in `admin.css`, usually with a `ui.js`
helper. Class names are the contract — Wave 3/4 must use these names,
not invent new ones.

### Layout — AppShell / Sidebar / Topbar

| Class | What it is | Usage |
|---|---|---|
| `.ig-shell` | Flex row, full viewport height | `<div class="ig-shell">` wrapping sidebar + main |
| `.ig-sidebar` | Fixed, full-height, electric blue | `<aside class="ig-sidebar">` |
| `.ig-sidebar-brand` | Logo mark + wordmark (use `/logo.png`, never the reference wordmark) | Top of sidebar |
| `.ig-nav` / `.ig-nav-item` / `.active` | Nav list; active = white pill, blue text, rounded left / flat right, bleeds to the edge | Items in order: DASHBOARD, ORDERS, PRODUCT, REPORTS, CUSTOMERS, SETTINGS |
| `.ig-sidebar-foot` | Bottom of sidebar | "← Back to shop" + social block |
| `.ig-main` | Content column, `margin-left: 240px` | `<div class="ig-main">` |
| `.ig-topbar` | Sticky white topbar, 2px bottom border | Search, toggle, mail, bell, avatar |
| `.ig-content` | 32px padding, 24px gap column | Page content |
| `.ig-grid`, `.ig-grid-2`, `.ig-grid-4`, `.ig-grid-products` | Grid helpers (2 = 2fr/1fr, 4 = 4-up, products = 4-up tiles) | Dashboard / Products |

Responsive behaviour (in `admin.css`, no JS needed except the menu button):
1024–1279px the sidebar collapses to the 72px icon rail automatically
(`body.ig-rail` also forces it); under 768px the sidebar becomes a
slide-in drawer (`body.ig-sidebar-open` toggled by `[data-ig-menu-btn]`,
`.ig-sidebar-scrim` dismisses it), KPIs go 2×2, tiles 2-up (1-up under
420px), the topbar search hides and the avatar name hides.

### Topbar pieces

| Class / helper | Notes |
|---|---|
| `.ig-search` (+ `[data-ig-global-search]`) | Grey pill, search icon + input + `/` kbd hint. `IGAdminUI.initGlobalSearch(onQuery)` wires input + the `/` shortcut (ignored while typing in a field). |
| `[data-ig-theme-toggle]` | Sun/moon button; `IGAdminUI.initTopbar()` wires it. |
| `.ig-icon-btn` + `.ig-bell-badge` | Mail / bell buttons. `IGAdminUI.setBellCount(n)` sets the red badge; `0` hides it. Clicking the bell clears it (Wave 3 can replace this with opening notifications). |
| `.ig-avatar-btn` / `.ig-avatar` / `.ig-avatar-who` / `.ig-avatar-drop` | Avatar (initials on a primary circle until a real avatar exists — never the reference person's photo), name + "Admin" role, dropdown with Profile / Settings / Log out. |

### Page header + date range

- `.ig-page-header` — title left, date-range pill right.
- `.ig-daterange` — pill with a preset `<select>`. Build it with
  `IGAdminUI.buildDateRangePicker(container, { presets, defaultPreset, onChange })`.
  Presets: Today, 7 days, 30 days, This month, Custom (Custom reveals two
  date inputs). `onChange({ preset, start, end, label })` — the caller
  filters KPIs/charts/tables with that range. No data is fetched here.

### KPI cards

- `.ig-card.ig-kpi` — label top-left (`.ig-kpi-label`), % change top-right
  (`.ig-kpi-delta.pos/.neg/.flat`), big value (`.ig-kpi-value`), optional
  sub-line, sparkline bottom-right (`.ig-kpi-spark`).
- `IGAdminUI.buildKpiCard({ label, value, deltaText, deltaKind, sparkValues, sub })`
  builds one from real values. `sparkValues` is an array of real numbers;
  an empty array renders no sparkline (no fake line). The sparkline is a
  tiny inline SVG polyline with a dot on the last point
  (`IGAdminUI.sparklineSVG(values, stroke)`).
- Formatting: `IGAdminUI.formatPKR(n)` (`Intl en-PK, PKR` — the reference
  shows ₦; this admin always uses PKR), `formatNum(n)` (compact `98.7k`
  in cards), `formatFull(n)` (full number in tables),
  `formatDateDDMMYYYY(iso)` / `formatDateTimePKT(iso)` (PKT, Asia/Karachi).

### Chart cards + segmented control

- `.ig-card` + `.ig-card-head` + `.ig-card-title` + `.ig-chart-wrap`
  (260px, `.tall` 300px) + `.ig-chart-legend` (`.ig-dot` swatches).
  Charts themselves are Chart.js (self-hosted 4.4.1, Wave 4) — this file
  only provides the card, the canvas area, and the legend.
- `.ig-segmented` — WEEKLY | MONTHLY | YEARLY; active = filled blue.
  `IGAdminUI.buildSegmented(container, ["Weekly","Monthly","Yearly"], onChange)`.
- `.ig-card-menu` / `.ig-card-menu-btn` ("⋯" — Export, View report; Wave 4).

### Data tables

- `.ig-table-wrap` (horizontal scroll on small screens) + `.ig-table`.
  Header row: warm-grey (`--table-head-bg`), sticky (`position: sticky;
  top: 0`), sortable headers get `.ig-sortable` + `.ig-sort-arrow`.
  Rows: thin `--table-line` dividers, hover tint, right-aligned numbers
  (`.ig-num`), row checkbox column (`.ig-row-check`), actions right
  (`.ig-actions`).
- `.ig-table-toolbar` — search + filters + export, above the table.
- `.ig-pagination` — `‹ 1 2 3 … N ›` buttons + page-size select +
  `.ig-page-info` ("Showing X–Y of Z").
  `IGAdminUI.paginate(total, page, pageSize)` (pure) and
  `IGAdminUI.buildPagination(total, page, pageSize, onPage)` build it.
- States: `.ig-state` (empty / error, with optional action button via
  `IGAdminUI.emptyState({ title, message, actionLabel, onAction })`),
  skeletons via `IGAdminUI.showSkeleton(container, rows)` /
  `clearSkeleton(container)`. Loading shows skeletons; an empty result
  shows the empty state — never a fake row.

### Status pills + badges

- `.ig-pill` + one class per status — Pending (amber), Paid (blue),
  Processing (indigo), Shipped (teal), Delivered (green), Canceled (red),
  Refunded (grey). Dark-mode text colours are lightened in `admin.css`
  so the pills stay readable on navy cards.
- `IGAdminUI.statusPill(status)` returns an escaped HTML string;
  `statusPillEl(status)` returns a DOM element. Unknown values fall back
  to the neutral pill with the value shown escaped.
- `.ig-badge` (red default), `.ig-badge-hot` (pink→orange gradient),
  `.ig-badge-new` (blue), `.ig-badge-soldout` (black),
  `.ig-badge-discount` (green `#8FE04A`, dark-green text).

### Buttons / inputs / selects / toggles

- `.ig-btn` + `.ig-btn-primary` (blue), `.ig-btn-ghost` (bordered),
  `.ig-btn-danger`, `.ig-btn-success`, `.ig-btn-sm`, `.ig-btn-block`.
- `.ig-input`, `.ig-select`, `.ig-textarea`, `.ig-field` (label + input +
  `.ig-hint` / `.ig-error`), `aria-invalid="true"` turns the border red.
- `.ig-toggle` — switch with a sliding knob; markup:
  `<label class="ig-toggle"><input type="checkbox"><span class="ig-track"></span> Label</label>`.

### Modal / drawer / toast / tabs

- Modal: `.ig-overlay` (fixed, centred, `display: none` until `.open`) >
  `.ig-modal` (max 560px, 92vh, scrollable), `.ig-modal-head` /
  `.ig-modal-foot`. `IGAdminUI.openModal(id) / closeModal(id)`.
  Overlay click, `[data-ig-close-modal]`, and ESC close it; focus returns
  to the opener.
- Drawer: `.ig-drawer` (right, `min(480px, 94vw)`, slides in) +
  `.ig-drawer-scrim[data-for="<id>"]`. `openDrawer(id) / closeDrawer(id)`.
  Use for order details and add/edit product (Wave 4).
- Toast: `.ig-toast` bottom-centre pill; `IGAdminUI.toast(msg, type)`
  (`"success"` / `"error"` border tints, auto-hides after 2.6s).
  A `#ig-toast` element is created on demand if Wave 3 did not add one.
- Tabs: `.ig-tabs` buttons with `data-ig-tab="<id>"` + panels with
  `data-ig-tab-panel="<id>"`; `IGAdminUI.initTabs()` wires them
  (auto-run on load).

### Product tiles

- `.ig-tile-grid` (4-up) + `.ig-tile` (pink-tint `--tile-bg`, 14px pad,
  hover lift). Image (`.ig-tile-img`, 4:3, `object-fit: contain`),
  green discount badge top-right (`.ig-badge-discount`),
  category tag (`.ig-tile-cat`), name, price + struck old price
  (`.ig-tile-price`), rating (`.ig-tile-rating`), hover quick actions
  (`.ig-tile-actions`: Edit, Duplicate, Delete, Toggle visibility).
- `IGAdminUI.buildProductTile(product)` builds one from a real product
  object `{ name, category, price, oldPrice, imageUrl, discountPct,
  isHot, isNew, soldOut, rating, reviewCount }`. The discount is computed
  from old vs current price when `discountPct` is not given.
- **Ratings:** if `rating`/`reviewCount` are missing, the tile shows
  "No ratings yet" (`.ig-no-rating`, italic, muted) — it never invents
  stars. The reference tiles show stars; this store has no rating data,
  so Wave 4 must not copy the reference stars.

### Image uploader (Wave 4 target)

- `.ig-uploader` (dashed drop zone, `.dragging` state) +
  `.ig-uploader-thumbs` (72px thumbs; `.first` gets the primary border).
  No JS uploader is built in this wave — Wave 4 wires drag-and-drop /
  multi-select upload to Supabase Storage here.

### Login (Wave 10 target — classes only, not wired up)

- `.ig-login-wrap` / `.ig-login-card` — white card, 28px centred title,
  muted subtitle. The current login keeps its purple gradient until
  Wave 10 restyles it with these classes. **Wave 3 must not restyle the
  login** — the user ordered: keep hCaptcha untouched, do not change any
  login logic, only restyle it (Wave 10).

### Escaping (security — read before rendering anything)

- `ui.js` exports `IGAdminUI.escHtml(x)` and `IGAdminUI.igSafeImgUrl(u)`
  — the same implementations as the existing admin page (H-04). Every
  helper that builds HTML (`statusPill`, `buildKpiCard`, `buildProductTile`,
  `emptyState`, `sparklineSVG`) escapes text before inserting it.
- Rule for Wave 3/4: never use `innerHTML` with unescaped data; build
  with these helpers or `textContent`. Image URLs go through
  `igSafeImgUrl()` (only `https://` or site-relative; `javascript:` /
  `data:` / `vbscript:` / protocol-relative rejected); unsafe URLs fall
  back to `../logo.png` in `buildProductTile`.

## 5. Social icons — hidden by default

No social links were provided (the user left the Facebook / Instagram /
WhatsApp fields empty). The sidebar social block (`.ig-sidebar-social`)
is therefore `display: none` in `admin.css`. Wave 3 must **not** invent
links: it adds the class `.ig-sidebar-social--visible` to the block only
when at least one real link exists, and renders only the icons that have
a real URL. If all three stay empty, the block stays hidden and the
sidebar footer shows only "← Back to shop".

## 6. What Wave 3 (App Shell) does with these files

1. Split the login page from the dashboard page (per the audit — logged-out
   visitors must receive only the login page). The dashboard page loads
   `admin.css` + `ui.js` as in §1; the login page does not load them yet.
2. Build the shell markup with the classes in §4: `.ig-shell`,
   `.ig-sidebar` (brand = `/logo.png` + "Imran Games" wordmark — never the
   reference wordmark), `.ig-nav` (6 items, hash routes `#/dashboard`,
   `#/orders`, `#/products`, `#/reports`, `#/customers`, `#/settings`),
   `.ig-topbar` (search, theme toggle, mail, bell, avatar menu),
   `.ig-page-header` + date-range picker per page.
3. Wire `IGAdminUI.initTopbar()` and `IGAdminUI.initGlobalSearch()`;
   persist the last route (hash) and restore it on load.
4. Do not restyle the login, do not change login logic, do not touch the
   shop. Do not deploy without a preview URL and the user's approval.

## 7. Visual verification against the screenshots

Checked by viewing all five screenshots (01–05) while writing the tokens:

- **Confirmed:** electric-blue sidebar with white active pill bleeding to
  the right edge; white topbar with grey search pill and sun/mail/bell/
  avatar on the right; lavender-grey page background; white cards with
  soft shadows; KPI cards (label top-left, % top-right, big value,
  sparkline bottom-right); Market Overview line chart with
  WEEKLY/MONTHLY/YEARLY segmented control; donut with legend dots;
  warm-grey table header + thin row dividers; product tiles pink-tinted
  with green discount badges, struck old prices, and star ratings;
  dark mode navy sidebar/page/cards (screenshot 05).
- **Estimated (≈), not pixel-measured:** the exact hex values in the
  prompt's token list (e.g. `--page-bg #F0F1FA`, `--table-head-bg
  #E3DEDE`, dark `--page-bg #141E5C`) were read from the screenshots and
  the prompt — no colour-picker measurement was run on the screenshots.
  The sidebar width (~240px), content padding (32px), grid gap (24px),
  and card radius (6–8px) are likewise the prompt's (≈) values, matched
  by eye against screenshots 02–04.
- **Deliberately different from the reference:** currency is PKR, not ₦;
  brand is Imran Games (`/logo.png`), not the reference wordmark; the
  avatar is an initials circle, not the reference person's photo;
  customer names / amounts / order IDs from the screenshots are **not**
  copied anywhere (they are demo data); star ratings are replaced by
  "No ratings yet" until real rating data exists.
- **Could not verify in this wave:** no live render — these files are not
  yet wired into any page (Wave 3 does that), so there is no browser
  screenshot to compare side by side, no Lighthouse run, and no
  instrument-measured contrast ratios. Light sidebar (white on `#0A00FF`)
  and dark-mode pills were checked by eye only; Wave 5 (QA) must measure
  contrast (target ≥ 4.5:1 in both themes) and do the side-by-side
  screenshot comparison at 1440px in both themes. The `prefers-reduced-motion`
  rule and focus rings are in the CSS but untested in a browser yet.
- **Shop-theme note:** `docs/design.md` says the admin panel matches the
  shop's dark theme. This design system intentionally departs from that
  for `/adminaccess` only, per the upgrade brief (screenshot wins). The
  shop itself is unchanged.

## 8. File inventory (this wave only)

| File | Lines | What it is |
|---|---|---|
| `adminaccess/admin.css` | 809 | Tokens, layout, all components, responsive rules |
| `adminaccess/ui.js` | 580 | Theme, toast, modal/drawer, ConfirmTap, pills, KPI/sparkline, pagination, tabs, date-range, product tile, formatting, escaping |
| `docs/admin/DESIGN_SYSTEM.md` | 387 | This file |

No other file was edited. No deploy, no commit, no SQL was run.
