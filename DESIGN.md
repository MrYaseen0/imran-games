# Imran Games design notes (hero redesign)

Written for this repo. Structure ideas (nav, buttons, cards, oversized headlines) follow the general patterns of console-brand and sportswear sites. No third-party colours or logos are used.

## Colours
- Pink #EC008C, cyan #00AEEF, background #0B0D17, deep #05060C, white for primary buttons.
- Slide glows: violet, cyan-blue, red, amber, magenta (backgrounds only).

## Type
- Headline: Anton, uppercase, clamp(56px, 11vw, 168px), 15vw on phones.
- UI and body: Inter. Brand wordmark keeps the site's Orbitron.

## Shape
- Buttons and chips: full pill. Glass cards: 22px radius. Hot Deals sheet: 28px top corners.

## Motion
- Slide change 900ms cubic-bezier(.22,1,.36,1). Search expand 250ms (44px to 420px). Autoplay 5s, paused on hover, focus and touch.
- Product float plus sway, mouse tilt up to 6deg. Only transform and opacity animate. Reduced motion turns it all off.

## Hero v3 update
- Headline: Unbounded 800 uppercase, second line neon pink/cyan glow. Nav, chips, buttons, body: Space Grotesk. Fonts self-hosted in /fonts (latin subset).
- Imagery: owner-supplied photos only, cut out per product; backgrounds are separate gradient/bokeh layers per slide. Concept images are labelled and never carry price, stock or cart.
- Not derived from the PlayStation or Nike DESIGN.md sources (they could not be read).
