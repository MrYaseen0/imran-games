# Imran Games design notes (hero redesign)

Written for this repo. Structure ideas (nav, buttons, cards, oversized headlines) follow the general patterns of console-brand and sportswear sites. No third-party colours or logos are used.

## Colours
- Pink #EC008C, cyan #00AEEF, background #0B0D17, deep #05060C, white for primary buttons.
- Slide glows: violet, cyan-blue, red, amber, magenta (backgrounds only).

## Type
- (Historical, v1 of the hero, superseded by Hero v3 below.) Headline was Anton and UI was Inter. Current fonts are listed under Hero v3. Brand wordmark keeps the site's Orbitron.

## Shape
- Buttons and chips: full pill. Glass cards: 22px radius. Hot Deals sheet: 28px top corners.

## Motion
- Slide change 900ms cubic-bezier(.22,1,.36,1). Search expand 250ms (44px to 420px). Autoplay 5s, paused on hover, focus and touch.
- Product float plus sway, mouse tilt up to 6deg. Only transform and opacity animate. Reduced motion turns it all off.

## Hero v3 update
- Headline: Unbounded 800 uppercase, second line neon pink/cyan glow. Nav, chips, buttons, body: Space Grotesk. Fonts self-hosted in /fonts (latin subset).
- Imagery: owner-supplied photos only, cut out per product; backgrounds are separate gradient/bokeh layers per slide. Concept images are labelled and never carry price, stock or cart.
- Not derived from the PlayStation or Nike DESIGN.md sources (they could not be read).

## v3.2 Baked product glows (performance)
Stacked live drop-shadow filters on large product layers caused 200-300 ms first-frame spikes after a slide change (headless software render). Slides 1-10 now use a pre-baked static glow image (assets/hero/g/*.webp, padded alpha, `img.glow` behind each product, same colors as before). Products stay separate animated layers. Measured worst frame 300 ms -> 133 ms (p95 33 ms, median 16.7 ms). Real-device numbers not measured. Prior version: tag gold-v12. Glow does not follow the soft pop squash on the product (static).

## v3.3 Full-visibility margins
Check now uses each product's layout box against the left/right viewport edge (margin >= 7.5% of half width + 6 px, for bob rotateY 8deg plus tilt 6deg perspective growth) and against the top of the Hot deals sheet (>= 16 px). Fixed: slide 2 and 4 and 9 at <=860px, slide 1 and 5 at 861-1100px, slide 5 at <=720px. Result: 0 violations at 390x844, 768x1024, 1024x768, 1440x900.

## v4 Intro type (user request 22:10)
Per slide: gold kicker "IMRAN GAMES" (Space Grotesk), bold italic product name (Kanit 900 italic, white fill, accent stroke and glow), neon script line (Mr Dafoe). Fonts self-hosted in fonts/ (both SIL OFL, from Google Fonts). No text boxes or backgrounds. Reveal: kicker tracks in, name wipes up with skew, script writes on, then a slow neon breathe, started with the slide entry. Names are the supplied product names from the slide alt text; script lines are descriptors from the same text, no prices or sales claims. Desktop: products scaled to 0.88 to open a band; text in front in that band; credit note moved to bottom left. Phone and tablet: text in a band under the product. Slide 1 keeps its headline and gets the product name beside the product. Reduced motion: static text.

v4.1 naming: only supplied or visible names are used. Slide 7 is "Gaming Chair / For gamers" (site category), PS5 Pro and Xbox lines are labelled "Concept" / "Skin concept", no bundle or availability claims, no manufacturer authenticity implied. Desktop text band raised to clear pagination (verified with measured boxes).
