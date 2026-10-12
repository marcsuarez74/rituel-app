Design rules:

- always extract design tokens (colors, spacing, radius, typography, shadows)
- never hardcode repeated values
- group styles into reusable patterns

Project constraints (Rituel — override any generic habit):

- light « Marché coloré » theme ONLY (papier/encre/basilic + familles du marché), no dark mode, no prefers-color-scheme logic
- plain CSS in a single file (src/index.css), semantic classes — NO Tailwind, no CSS-in-JS
- tokens live as CSS variables on :root — map every color/spacing/radius to var(--token)
- touch targets >= 48px, contrast >= 4.5:1 ("ultra visible" is a product requirement, enforced by tests/contraste.test.ts)
- texts in French

Component strategy:

- identify reusable components
- split UI into logical blocks
- avoid monolithic components

Spacing:

- use consistent spacing scale
- prefer multiples (4, 8, 16, 24...)

Colors:

- map colors to semantic CSS variables (see ai/context/design-system.md)
- avoid raw hex values in components (white #ffffff on basilic fills, ink --encre on jaune fruit fills are the accepted literals, per design-system.md)

Typography:

- use ONLY the tokens: sizes --fs-hero/--fs-h1/--fs-h2/--fs-h3/--fs-body/--fs-sec/--fs-meta/--fs-micro/--fs-chart (+ --fs-emoji onboarding), line-heights --lh-none/--lh-tight/--lh-title/--lh-body, spacing --sp-2…--sp-24 (échelle 2px), radii --r-orga/--r-orga-2/--r-bouton, shadows --shadow/--shadow-forte/--shadow-bouton — no raw values, enforced by tests/css-tokens.test.ts + tests/contraste.test.ts
- maintain consistency

Responsive:

- mobile-first, content capped at 560px
- respect iOS safe areas (env(safe-area-inset-*))

UX:

- clear interaction states (hover, focus, active)
- accessible contrast
- transitions 0.2s on interactive elements only + prefers-reduced-motion kill switch

Performance:

- avoid unnecessary wrappers
- keep DOM light
