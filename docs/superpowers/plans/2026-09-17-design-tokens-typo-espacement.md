# Design tokens — typo, espacement, interlignage · Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tokeniser l'échelle typographique (10 tokens), l'échelle d'espacement 2 px (10 tokens) et l'interlignage (4 tokens) dans `src/index.css`, balayer toutes les valeurs brutes, et verrouiller le tout par un garde-fou testé.

**Architecture:** Pur CSS — zéro changement dans les composants. Les tokens s'ajoutent sur `:root`, un balayage mécanique piloté par des tables de correspondance remplace chaque valeur brute par son token, et un nouveau test lit `src/index.css` pour empêcher toute régression. Spéc : `docs/superpowers/specs/2026-09-17-design-tokens-typo-espacement-design.md`.

**Tech Stack:** CSS (variables sur `:root`), vitest (lecture de fichier, sans rendu), Node one-off scripts en `/tmp` (jamais commités).

**Contexte repo (à lire avant de commencer) :** `AGENTS.md` (conventions, gates avant commit, règle PR), spéc ci-dessus. Branche de travail : `feat/design-tokens` dans un worktree dédié (créé par la skill d'exécution). Les tests tournent avec `npm test` depuis la racine du repo.

**Faits issus de l'audit (confirmés, ne pas ré-auditer) :**

- Toutes les valeurs `font-size` / `line-height` / `padding|margin|gap` sont en px entiers ou demi-pixels — aucune unité `rem`/`em`/`%`, aucun `line-height` avec unité
- 2 marges négatives : `margin: -1px` (l.112, `.sr-only`) et `margin-right: -6px` (l.2516, `.dep .rm`)
- 4 `calc()` dans des propriétés d'espacement (safe-areas) — exemptés du balayage et du test
- Tailles ≤ 10 px : 4 usages sont des labels SVG du `WeightChart` (8, 8, 8.5, 9 px) → `--fs-chart` ; 5 usages sont du texte (9.5 ×1, 10 ×3, 10.5 → voir table) → `--fs-micro`

---

### Task 1: Tokens sur :root + garde-fou typo (rouge) + balayage typo/interlignage

**Files:**
- Modify: `src/index.css` (bloc `:root` + balayage global)
- Create: `tests/css-tokens.test.ts`

- [ ] **Step 1: Ajouter le bloc de tokens dans `:root`**

Dans `src/index.css`, dans le bloc `:root` existant (juste avant son accolade fermante, après `color-scheme: light;`), insérer :

```css
  /* Échelle typographique — 8 niveaux texte + graphique + émoji (spec 2026-09-17) */
  --fs-hero: 26px;
  --fs-h1: 22px;
  --fs-h2: 20px;
  --fs-h3: 17px;
  --fs-body: 16px;
  --fs-sec: 14px;
  --fs-meta: 12px;
  --fs-micro: 11px;
  --fs-chart: 10px;
  --fs-emoji: 38px;
  /* Échelle d'espacement 2 px — le nom du token est sa valeur (utilisée en Task 2) */
  --sp-2: 2px;
  --sp-4: 4px;
  --sp-6: 6px;
  --sp-8: 8px;
  --sp-10: 10px;
  --sp-12: 12px;
  --sp-14: 14px;
  --sp-16: 16px;
  --sp-20: 20px;
  --sp-24: 24px;
  /* Interlignage */
  --lh-none: 1;
  --lh-tight: 1.2;
  --lh-title: 1.25;
  --lh-body: 1.5;
```

- [ ] **Step 2: Écrire le garde-fou typo (test rouge)**

Créer `tests/css-tokens.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Contrat CSS (spec 2026-09-17-design-tokens-typo-espacement-design.md) :
// toute taille/espacement/interlignage passe par les tokens de :root.
// Exceptions d'espacement documentées (voir describe dédié, ajouté en Task 2).
const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');

describe('contrat CSS — tokens de typographie', () => {
  it('chaque font-size utilise un token --fs-*', () => {
    const brutes = [...css.matchAll(/font-size:\s*([^;]+);/g)]
      .filter(([, v]) => !v.includes('var(--fs-'))
      .map(([, v]) => v.trim());
    expect(brutes, `font-size brutes : ${brutes.join(' | ')}`).toEqual([]);
  });

  it('chaque line-height numérique utilise un token --lh-*', () => {
    const brutes = [...css.matchAll(/line-height:\s*([^;]+);/g)]
      .filter(([, v]) => /^\d/.test(v.trim()) && !v.includes('var(--lh-'))
      .map(([, v]) => v.trim());
    expect(brutes, `line-height brutes : ${brutes.join(' | ')}`).toEqual([]);
  });
});
```

- [ ] **Step 3: Vérifier que le test échoue (rouge)**

Run: `npx vitest run tests/css-tokens.test.ts`
Expected: FAIL — les 2 tests listent les déclarations brutes (~107 font-size, ~25 line-height).

- [ ] **Step 4: Balayer typo + interlignage (script one-off, jamais commité)**

Créer `/tmp/sweep-typo.mjs` (depuis la racine du repo) :

```js
import { readFileSync, writeFileSync } from 'node:fs';

// Correspondances validées (spec + écrans de design du 2026-09-17).
// 8–9 px = labels SVG du WeightChart → --fs-chart ; 9.5–11 px texte → --fs-micro.
const FS = {
  '8': '--fs-chart', '8.5': '--fs-chart', '9': '--fs-chart',
  '9.5': '--fs-micro', '10': '--fs-micro', '10.5': '--fs-micro', '11': '--fs-micro',
  '11.5': '--fs-meta', '12': '--fs-meta', '12.5': '--fs-meta', '13': '--fs-meta',
  '13.5': '--fs-sec', '14': '--fs-sec', '14.5': '--fs-sec', '15': '--fs-sec',
  '16': '--fs-body', '17': '--fs-h3', '19': '--fs-h2', '20': '--fs-h2',
  '22': '--fs-h1', '24': '--fs-h1', '26': '--fs-hero', '27': '--fs-hero',
  '38': '--fs-emoji',
};
const LH = {
  '1': '--lh-none', '1.2': '--lh-tight', '1.25': '--lh-title',
  '1.4': '--lh-body', '1.45': '--lh-body', '1.5': '--lh-body', '1.55': '--lh-body',
};

let css = readFileSync('src/index.css', 'utf8');
let ok = true;

css = css.replace(/font-size:\s*(\d+(?:\.\d+)?)px/g, (m, n) => {
  const t = FS[n];
  if (!t) { ok = false; console.error('font-size sans mapping :', m); return m; }
  return `font-size: var(${t})`;
});

css = css.replace(/line-height:\s*(\d+(?:\.\d+)?)(\s*;)/g, (m, n, semi) => {
  const t = LH[n];
  if (!t) { ok = false; console.error('line-height sans mapping :', m); return m; }
  return `line-height: var(${t})${semi}`;
});

writeFileSync('src/index.css', css);
if (!ok) process.exit(1);
console.log('typo + interlignage balayés');
```

Run: `node /tmp/sweep-typo.mjs`
Expected: `typo + interlignage balayés` (exit 0). Si une valeur sans mapping apparaît, NE PAS improviser : signaler et demander.

- [ ] **Step 5: Vérifier qu'aucune valeur brute ne subsiste**

Run: `rg -Pn 'font-size:(?! var\(--fs-)' src/index.css ; rg -Pn 'line-height:(?! var\(--lh-)' src/index.css | rg -v '/\*'`
Expected: aucune sortie (exit 1 de rg = zéro match).

- [ ] **Step 6: Vérifier que le garde-fou passe (vert)**

Run: `npx vitest run tests/css-tokens.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Suite complète + commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: 486 tests passés (484 + 2 nouveaux), typecheck et lint verts.

```bash
git add src/index.css tests/css-tokens.test.ts
git commit -m "feat: échelle typographique et d'interlignage tokenisées (+ garde-fou)"
```

---

### Task 2: Garde-fou espacement (rouge) + balayage espacement + exceptions

**Files:**
- Modify: `tests/css-tokens.test.ts` (describe espacement)
- Modify: `src/index.css` (balayage global padding/margin/gap + 1 exception restaurée)

- [ ] **Step 1: Étendre le garde-fou avec le contrat espacement (rouge)**

Remplacer le contenu de `tests/css-tokens.test.ts` par (le 3ᵉ test d'existence ajouté en Task 1 revue qualité est **conservé** et étendu aux `--sp-*` ; intitulé ajusté — la regex scanne tout le fichier, pas seulement `:root`) :

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Contrat CSS (spec 2026-09-17-design-tokens-typo-espacement-design.md) :
// toute taille/espacement/interlignage passe par les tokens de :root.
// Échelle d'espacement : 2 px (le nom du token --sp-N est sa valeur en px).
const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');

// Exceptions documentées, avec raison :
// - "margin:-1px" (.sr-only) : pattern d'accessibilité standard (clip), pas du rythme.
// - calc(...) : safe-areas iOS et négation d'un token — exemptées par nature.
const EXCEPTIONS_SP = ['margin:-1px'];

describe('contrat CSS — tokens de typographie', () => {
  it('chaque font-size utilise un token --fs-*', () => {
    const brutes = [...css.matchAll(/font-size:\s*([^;]+);/g)]
      .filter(([, v]) => !v.includes('var(--fs-'))
      .map(([, v]) => v.trim());
    expect(brutes, `font-size brutes : ${brutes.join(' | ')}`).toEqual([]);
  });

  it('chaque line-height numérique utilise un token --lh-*', () => {
    const brutes = [...css.matchAll(/line-height:\s*([^;]+);/g)]
      .filter(([, v]) => /^\d/.test(v.trim()) && !v.includes('var(--lh-'))
      .map(([, v]) => v.trim());
    expect(brutes, `line-height brutes : ${brutes.join(' | ')}`).toEqual([]);
  });

  it('chaque référence var(--fs-*|--lh-*|--sp-*) est définie', () => {
    const definis = new Set(
      [...css.matchAll(/(--(?:fs|lh|sp)-[\w-]+):/g)].map(([d]) => d.slice(0, -1)),
    );
    const orphelines = [...css.matchAll(/var\((--(?:fs|lh|sp)-[\w-]+)\)/g)]
      .map(([, t]) => t)
      .filter((t) => !definis.has(t));
    expect(
      orphelines,
      `tokens référencés non définis : ${orphelines.join(' | ')}`,
    ).toEqual([]);
  });
});

describe('contrat CSS — tokens d\'espacement', () => {
  // Garde anti-régression silencieuse : si le CSS est réorganisé et que le
  // sélecteur ci-dessous ne matche plus rien, ce test le signale.
  const decls = [
    ...css.matchAll(/^(\s*)((?:padding|margin|gap|scroll-padding)[a-z-]*):([^;]+);/gm),
  ];

  it('le CSS contient des déclarations d\'espacement à auditer', () => {
    expect(decls.length).toBeGreaterThan(200);
  });

  it('chaque valeur px est un token --sp-* (ou exception documentée)', () => {
    const hors = decls
      .filter(([, , prop, v]) => !EXCEPTIONS_SP.includes(`${prop.trim()}:${v.trim()}`))
      .filter(([, , , v]) => !v.includes('var(') && !v.includes('calc('))
      .flatMap(([, , prop, v]) => {
        const px = [...v.matchAll(/(-?)(\d+(?:\.\d+)?)px/g)].map((m) => Math.abs(parseFloat(m[2])));
        return px.map((n) => `${prop.trim()}:${v.trim()} [${n}px]`);
      });
    expect(hors, `hors échelle : ${hors.join(' | ')}`).toEqual([]);
  });
});
```

- [ ] **Step 2: Vérifier que le test échoue (rouge)**

Run: `npx vitest run tests/css-tokens.test.ts`
Expected: FAIL — le test « chaque valeur px » liste TOUTES les valeurs px brutes (~300 occurrences dans ~260 déclarations, paires et impaires confondues, car aucune n'est encore un var()). Le test « déclarations à auditer » passe (~260 déclarations > 200).

- [ ] **Step 3: Balayer l'espacement (script one-off, jamais commité)**

Créer `/tmp/sweep-spacing.mjs` :

```js
import { readFileSync, writeFileSync } from 'node:fs';

// Échelle 2 px validée ; SNAP = impaires → voisine (1→2, 3→4, 5→6, 7→8, 9→10,
// 11→12, 13→12, 18→20, 22→24). Les négatives deviennent calc(var(--X) * -1).
const SP = {
  2: '--sp-2', 4: '--sp-4', 6: '--sp-6', 8: '--sp-8', 10: '--sp-10',
  12: '--sp-12', 14: '--sp-14', 16: '--sp-16', 20: '--sp-20', 24: '--sp-24',
};
const SNAP = { 1: 2, 3: 4, 5: 6, 7: 8, 9: 10, 11: 12, 13: 12, 18: 20, 22: 24 };

let css = readFileSync('src/index.css', 'utf8');
let ok = true;

css = css.replace(/^(\s*)((?:padding|margin|gap|scroll-padding)[a-z-]*):([^;]+);/gm, (m, ind, prop, val) => {
  if (val.includes('var(') || val.includes('calc(')) return m;
  const nv = val.replace(/(-?)(\d+(?:\.\d+)?)px/g, (mm, sign, num) => {
    let n = parseFloat(num);
    if (SP[n] === undefined) n = SNAP[n];
    if (n === undefined) { ok = false; console.error('sans mapping :', mm, 'dans', `${prop}:${val.trim()}`); return mm; }
    const t = `var(${SP[n]})`;
    return sign === '-' ? `calc(${t} * -1)` : t;
  });
  return `${ind}${prop}:${nv};`;
});

writeFileSync('src/index.css', css);
if (!ok) process.exit(1);
console.log('espacement balayé');
```

Run: `node /tmp/sweep-spacing.mjs`
Expected: `espacement balayé` (exit 0). Si une valeur sans mapping apparaît, NE PAS improviser : signaler et demander.

- [ ] **Step 4: Restaurer l'exception `.sr-only` (exact, à la main)**

Le script a converti `margin: -1px` de `.sr-only` en `margin: calc(var(--sp-2) * -1)`. Restaurer (l.~112) — c'est l'exception documentée. Le bloc réel est :

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
```

Ne toucher QUE la ligne `margin:` (revenir à `margin: -1px;`) — `padding: 0` et `border: 0` sont déjà conformes (zéro sans unité).

- [ ] **Step 5: Vérifier qu'aucune valeur brute ne subsiste**

Run: `rg -Pn '^\s*(padding|margin|gap|scroll-padding)[a-z-]*:' src/index.css | rg -v 'var\(--sp-|calc\(|: ?0;|margin: ?-1px'`
Expected: aucune sortie (hormis zéro et l'exception `.sr-only`). Vérifier aussi les multi-valeurs : chaque composant px doit être un var (le test le garantit).

- [ ] **Step 6: Vérifier que le garde-fou passe entièrement (vert)**

Run: `npx vitest run tests/css-tokens.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Suite complète + commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: 489 tests passés (487 + 2 nouveaux), typecheck et lint verts.

```bash
git add src/index.css tests/css-tokens.test.ts
git commit -m "feat: échelle d'espacement 2px tokenisée (+ garde-fou espacement)"
```

---

### Task 3: Docs alignées + gates complètes

**Files:**
- Modify: `ai/context/design-system.md` (sections Typographie et Espacements)
- Modify: `ai/agent/design-agent/rules.prompt.md:33` (ligne Typography)
- Modify: `AGENTS.md` (§Style de code, bullet CSS)
- Modify: `CHANGELOG.md` (§ [Non publié])

- [ ] **Step 1: Réécrire la section Typographie de `ai/context/design-system.md`**

Remplacer l'intégralité de la section `## Typographie` (du titre jusqu'au `---` précédant `## Espacements`) par :

```markdown
## Typographie

**Poppins** auto-hébergée (subset latin, 4 graisses 400/500/600/700, `font-display: swap`, précachée par le service worker) — 16 px base (`--fs-body`), interlignage `--lh-body` (1,5).

Échelle tokenisée — **aucune taille brute hors tokens** (garde-fou : `tests/css-tokens.test.ts`) :

| Token | Taille | Graisse usuelle | Usage |
|---|---|---|---|
| `--fs-hero` | 26 px | 700 | chiffres héros (budget, poids) |
| `--fs-h1` | 22 px | 600 | l'unique `h1` (titre de semaine) |
| `--fs-h2` | 20 px | 600/700 | titres majeurs (bannière, écrans poussés) |
| `--fs-h3` | 17 px | 600 | titres de cartes |
| `--fs-body` | 16 px | 400 | corps de texte |
| `--fs-sec` | 14 px | 600/700 | onglets, libellés secondaires |
| `--fs-meta` | 12 px | 600/700 | compteurs, hints |
| `--fs-micro` | 11 px | 500/700 | pastilles, notes |
| `--fs-chart` | 10 px | 500 | labels SVG du graphique de poids |
| `--fs-emoji` | 38 px | — | émojis géants de l'onboarding |

Interlignage tokenisé : `--lh-none: 1` (pills une ligne) · `--lh-tight: 1.2` (chiffres) · `--lh-title: 1.25` (titres) · `--lh-body: 1.5` (corps).
```

- [ ] **Step 2: Réécrire la section Espacements de `ai/context/design-system.md`**

Remplacer l'intégralité de la section `## Espacements` (du titre jusqu'au `---` précédant `## Composants`) par :

```markdown
## Espacements

Échelle **2 px tokenisée** — 10 valeurs, le nom du token est sa valeur en px (garde-fou : `tests/css-tokens.test.ts`) :

`--sp-2` · `--sp-4` · `--sp-6` · `--sp-8` · `--sp-10` · `--sp-12` · `--sp-14` · `--sp-16` · `--sp-20` · `--sp-24`

Padding standard des cartes : `var(--sp-16)`. Gouttières page : `var(--sp-16)`. Padding bas de page : `calc(28px + safe-area-inset-bottom)` sur `.main-content` (exempt calc). Exceptions documentées : `margin: -1px` de `.sr-only` (pattern d'accessibilité standard).
```

- [ ] **Step 3: Mettre à jour `ai/agent/design-agent/rules.prompt.md`**

Remplacer la ligne 33 :

```markdown
- define hierarchy (h1 22px/600, h2 20px/600, h3 17px/600, body 16px, font Poppins 400/500/600/700)
```

par :

```markdown
- use ONLY the tokens: sizes --fs-hero/--fs-h1/--fs-h2/--fs-h3/--fs-body/--fs-sec/--fs-meta/--fs-micro/--fs-chart (+ --fs-emoji onboarding), line-heights --lh-none/--lh-tight/--lh-title/--lh-body, spacing --sp-2…--sp-24 (échelle 2px) — no raw values, enforced by tests/css-tokens.test.ts
```

- [ ] **Step 4: Mettre à jour `AGENTS.md`**

Dans §Style de code, à la fin du bullet CSS (celui qui commence par « - CSS : un seul fichier `src/index.css` »), après « typo **Poppins** auto-hébergée) », ajouter :

```markdown
 Typo, espacement (échelle 2 px) et interlignage sont tokenisés (`--fs-*`, `--sp-*`, `--lh-*`) — garde-fou : `tests/css-tokens.test.ts`.
```

- [ ] **Step 5: Mettre à jour `CHANGELOG.md`**

Dans `## [Non publié]`, insérer avant la sous-section `### Corrigé` (si absente, créer la sous-section en tête de `[Non publié]`) :

```markdown
### Changé

- Échelles de design tokenisées dans `src/index.css` : typographie (10 tokens `--fs-*`), espacement 2 px (10 tokens `--sp-*`), interlignage (4 tokens `--lh-*`) — balayage complet du CSS (rendu inchangé aux ±1 px près) et garde-fou anti-régression `tests/css-tokens.test.ts`.
```

- [ ] **Step 6: Gates complètes**

Run: `npm test && npm run typecheck && npm run lint && npm run build && ls dist/sw.js dist/manifest.webmanifest`
Expected: 489 tests, tout vert, `dist/sw.js` et `dist/manifest.webmanifest` listés.

Run: `npm run e2e`
Expected: 48/48 passés, zéro débordement horizontal sur 320/375.

- [ ] **Step 7: Commit**

```bash
git add ai/context/design-system.md ai/agent/design-agent/rules.prompt.md AGENTS.md CHANGELOG.md
git commit -m "docs: guideline typo/espacement tokenisée (design-system, agents, changelog)"
```

---

### Task 4: Pull Request

**Files:** aucun (git + gh uniquement)

- [ ] **Step 1: Pousser la branche et ouvrir la PR**

```bash
git push -u origin feat/design-tokens
gh pr create --title "Design tokens : typo, espacement, interlignage" --body "## Résumé

- 24 tokens ajoutés sur \`:root\` : échelle typo (10 \`--fs-*\`), espacement 2 px (10 \`--sp-*\`), interlignage (4 \`--lh-*\`)
- Balayage mécanique complet de \`src/index.css\` (~190 déclarations, correspondances validées en design) — rendu inchangé aux ±1 px près
- Garde-fou \`tests/css-tokens.test.ts\` (4 tests) : plus aucune valeur brute hors exceptions documentées
- Docs alignées : design-system.md, design-agent rules, AGENTS.md, CHANGELOG

## Gates

- 489/489 tests · typecheck · lint · build (sw.js + manifest) · e2e 48/48

Spec : \`docs/superpowers/specs/2026-09-17-design-tokens-typo-espacement-design.md\`"
```

- [ ] **Step 2: Attendre la CI PR verte**

Run: `gh pr checks --watch`
Expected: tous les checks (Prepare, Lint, Typecheck, Test, Build) verts.

- [ ] **Step 3: Signaler l'URL de la PR et attendre le merge utilisateur**

Ne JAMAIS merger soi-même : signaler l'URL et s'arrêter. Après merge (fait par l'utilisateur) : `git pull`, vérifier le workflow `Deploy` vert, supprimer le worktree et la branche (local + origin).
