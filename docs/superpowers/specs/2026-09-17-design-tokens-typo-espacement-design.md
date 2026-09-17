# Design tokens — typographie, espacement, interlignage

**Date** : 2026-09-17 · **Statut** : approuvé (design validé en session, échelles choisies visuellement)

## Problème

L'app manque de cohérence typographique et spatiale. L'audit de `src/index.css` (2 600 lignes) révèle :

- **24 tailles de police distinctes**, dont 8 en demi-pixels (12.5, 13.5, 10.5, 11.5, 14.5, 9.5, 8.5) et des quasi-doublons (11/11.5/12/12.5, 13/13.5/14/14.5)
- **19 valeurs d'espacement** (`padding`/`margin`/`gap`), dont 51 usages de valeurs impaires (3, 5, 7, 9, 11, 13 px)
- **7 valeurs d'interlignage** (1, 1.2, 1.25, 1.4, 1.45, 1.5, 1.55)

Les tokens existent pour les **couleurs**, les **formes** et les **ombres**, mais pas pour la typo ni l'espacement : chaque valeur est codée en dur. Résultat : aucune guideline exécutable, la dérive continue.

## Décisions

1. **Pas de Tailwind** — le besoin est une échelle de tokens, pas un framework. Tailwind sans échelle donnerait la même incohérence dans une autre syntaxe ; migrer ~40 composants pour le même résultat est un coût sans bénéfice. Les tokens CSS sur `:root` suffisent et gardent la convention « classes sémantiques » du repo.
2. **Harmonisation seule** — le thème Herbes actuel (couleurs, cartes, Poppins) est conservé tel quel ; on systématise, on ne redessine pas.
3. **Échelle typographique resserrée** — 8 niveaux de texte + 1 niveau graphique (choisie visuellement contre une échelle « fidèle » à 9 niveaux).
4. **Échelle d'espacement 2 px** — 10 valeurs capturant le rythme existant (choisie contre l'échelle 4 px stricte, qui déplacerait ~100 déclarations de 2 px).

## Le système de tokens

Ajoutés sur `:root` dans `src/index.css`, à côté des tokens existants.

### Typographie (8 niveaux texte + 1 graphique + 1 émoji)

| Token | Valeur | Usage | Remplace |
|---|---|---|---|
| `--fs-hero` | 26px | chiffres héros (budget, poids) | 27 |
| `--fs-h1` | 22px | l'unique h1 (titre de semaine) | 22, 24 (onboarding aligné) |
| `--fs-h2` | 20px | titres majeurs (bannière, écrans poussés) | 19, 20 |
| `--fs-h3` | 17px | titres de cartes | 17 |
| `--fs-body` | 16px | corps de texte | 16 |
| `--fs-sec` | 14px | onglets, libellés secondaires | 13.5, 14, 14.5, 15 |
| `--fs-meta` | 12px | compteurs, hints | 11.5, 12, 12.5, 13 |
| `--fs-micro` | 11px | pastilles, notes | 10 (texte), 10.5, 11 |
| `--fs-chart` | 10px | labels SVG du graphique de poids | 8, 8.5, 9, 9.5 (SVG) |
| `--fs-emoji` | 38px | émojis géants de l'onboarding | 38 |

### Espacement (10 valeurs — le nom du token est sa valeur)

```css
--sp-2: 2px;  --sp-4: 4px;  --sp-6: 6px;  --sp-8: 8px;  --sp-10: 10px;
--sp-12: 12px; --sp-14: 14px; --sp-16: 16px; --sp-20: 20px; --sp-24: 24px;
```

### Interlignage (4 tokens)

| Token | Valeur | Usage | Remplace |
|---|---|---|---|
| `--lh-none` | 1 | pills à une ligne | 1 |
| `--lh-tight` | 1.2 | chiffres, héros | 1.2 |
| `--lh-title` | 1.25 | titres | 1.25 |
| `--lh-body` | 1.5 | corps | 1.4, 1.45, 1.5, 1.55 |

Hors périmètre : graisses (400/500/600/700 restent des littéraux — déjà cohérentes), bordures, rayons, ombres (tokens existants), `calc()` de safe-areas, attributs SVG des composants.

## Le balayage

Balayage **mécanique piloté par la table de correspondance** ci-dessus, pas composant par composant. Chaque occurrence est remplacée par son token ; les shorthands multi-valeurs se tokenisent par valeur (`padding: 10px 16px` → `padding: var(--sp-10) var(--sp-16)`).

Correspondances d'espacement (impaires → voisine, selon l'échelle validée) : 1 → 2 (exception littérale : `margin: -1px` de `.sr-only`), 3 → 4, 5 → 6, 7 → 8, 9 → 10, 11 → 12, 13 → 12, 15 → 14 (occurrence tardive `padding: 0 15px` de `.addrow button`, absente du premier audit), 18 → 20, 22 → 24.

Politique 8–9.5 px : ces tailles sont les labels du graphique SVG (`WeightChart`) → `--fs-chart`. Si une occurrence s'avère être du texte hors graphique lors du balayage, elle monte à `--fs-micro` (11 px) et la doc l'indique.

Exemptions documentées (resteront en littéral ou exemptées du balayage) : `margin: -1px` de `.sr-only` (pattern d'accessibilité standard), les expressions `calc()`/`max()` de safe-areas iOS ; la négation d'un token s'écrit `calc(var(--sp-N) * -1)`.

**Zéro changement dans les composants** — pur CSS. Le rendu ne bouge que des ±1 px assumés (~60 déclarations d'espacement, ≈50 de typo, ~12 d'interlignage).

## Le garde-fou

Nouveau test vitest `tests/css-tokens.test.ts` qui lit `src/index.css` et échoue si :

1. une déclaration `font-size` n'utilise pas `var(--fs-*)`
2. une déclaration `line-height` numérique n'utilise pas `var(--lh-*)`
3. une déclaration `padding`/`margin`/`gap` contient un px hors échelle 2 px (ou hors `var(--sp-*)`)

Exceptions documentées en tête de test avec leur raison. Écrit **rouge d'abord** (échoue sur le CSS actuel), chaque tâche de balayage fait passer sa partie. Le test devient la guideline non-régressable : réintroduire une valeur brute casse la CI. C'est le seul test hors « comportement visible » du chantier, assumé car il teste un contrat de fichier, pas l'UI.

## Docs à aligner

Règle repo : `src/index.css` et `ai/context/design-system.md` ne doivent jamais diverger.

- `ai/context/design-system.md` — sections Typographie et Espacements réécrites avec les tables de tokens
- `ai/agent/design-agent/rules.prompt.md` — la ligne « Typography » pointe vers les tokens
- `AGENTS.md` §Style de code — mention des échelles typo/espacement tokenisées
- `CHANGELOG.md` — entrée sous `[Non publié]`

## Exécution

Une branche + **une PR** « Design tokens : typo, espacement, interlignage », 3 tâches :

1. Tokens sur `:root` + test garde-fou (rouge) → balayage typo + interlignage → vert
2. Balayage espacement → garde-fou entièrement vert
3. Docs + gates complètes : `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` (sw.js + manifest), `npm run e2e` (48/48 — les ±1 px ne doivent créer aucun débordement horizontal sur 320/375)

## Critères d'acceptation

- `:root` expose les 24 nouveaux tokens ; plus aucune taille/espacement/interlignage brut hors exceptions
- Le garde-fou passe et protège l'échelle
- Le rendu visuel est inchangé aux ±1 px près (harmonisation seule)
- Gates vertes, e2e 48/48 sans débordement horizontal
- Docs alignées (design-system.md = état de `:root`)
