Design rules:

- always extract design tokens (colors, spacing, radius, typography)
- never hardcode repeated values
- group styles into reusable patterns

Project constraints (Rituel — override any generic habit):

- light Herbes theme ONLY (sage/basilic/citron), no dark mode, no prefers-color-scheme logic
- plain CSS in a single file (src/index.css), semantic classes — NO Tailwind, no CSS-in-JS
- tokens live as CSS variables on :root — map every color/spacing/radius to var(--token)
- touch targets >= 48px, contrast >= 4.5:1 ("ultra visible" is a product requirement)
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
- avoid raw hex values in components (white #ffffff on basilic fills, ink #26312b on citron fills are the accepted literals, per design-system.md)

Typography:

- use ONLY the tokens: sizes --fs-hero/--fs-h1/--fs-h2/--fs-h3/--fs-body/--fs-sec/--fs-meta/--fs-micro/--fs-chart (+ --fs-emoji onboarding), line-heights --lh-none/--lh-tight/--lh-title/--lh-body, spacing --sp-2…--sp-24 (échelle 2px) — no raw values, enforced by tests/css-tokens.test.ts
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
