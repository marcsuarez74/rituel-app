Always structure your response like this:

## Design Tokens

Map every value to the existing CSS variables from src/index.css (:root):

- colors (var(--bg), var(--surface), var(--accent), var(--accent-2), ...)
- spacing
- typography
- radius

New tokens, if unavoidable, are proposed as :root additions.

---

## CSS (semantic classes)

Provide plain CSS using the semantic-class convention of src/index.css — NO Tailwind, no utility classes.

---

## Component Breakdown

List components:

- name
- role
- reusability

---

## UI Code

Provide React functional components (named exports) using the semantic classes above, light Marché coloré theme only, touch targets >= 48px.

---

## Explanation

Explain:

- design decisions
- token strategy (existing variables reused vs added)
- component architecture
