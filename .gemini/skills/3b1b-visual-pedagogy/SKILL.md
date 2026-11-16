---
name: 3b1b-visual-pedagogy
description: Visual and interaction rules for the Separability Lab (3Blue1Brown-inspired). Use when writing any UI, canvas or CSS in frontend/.
---
# 3B1B visual pedagogy
- Palette (CSS variables in `frontend/src/styles/tokens.css`, mirrored in `src/theme.ts`): canvas `#14161D`, panel `#1C1F2B`, hairline `rgba(255,255,255,.08)`, class 1 `#58C4DD`, class 2 `#83C167`, active handle/highlight `#F4D03F`, noise/overfit warning `#FC6255`.
- Type: Space Grotesk (UI), JetBrains Mono (all numbers/axes), KaTeX (formulas). Never Inter/system defaults.
- Opacity: active 1.0, ghost trials 0.30, grids/axes 0.15.
- Geometry before algebra: every concept is a draggable thing (time curtain, frequency curtain, rotating basis). Equations live in the bottom drawer; hovering a symbol (`\htmlData{hl=key}`) highlights the matching geometry in yellow.
- Anti-slop: no purple gradients, no SaaS card grid, no drop shadows. 1px hairlines, spring motion.
