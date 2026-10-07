# Design System — Rituel

Source de vérité : `src/index.css` (section `:root`). Toute valeur ici doit y correspondre — si le CSS change, mettre à jour ce fichier.

## Principes

- **Thème clair unique « Herbes »** — pas de dark mode, pas de `prefers-color-scheme`
- **Ultra visible** : contraste texte ≥ 4,5:1 partout (règle repo — texte principal ≈ 13,2:1 sur surface, blanc sur basilic ≈ 5,2:1, encre sur citron ≈ 9,8:1 ; exception assumée : métadonnées muted secondaires, cf. revue qualité T10), hiérarchie typographique forte, cibles tactiles ≥ 48 px
- **Le citron n'est jamais une couleur de texte** : `--accent-2` ne sert qu'aux fonds/bordures — texte sur citron = encre
- **Fluide** : transitions douces 0,2 s sur les éléments interactifs uniquement + kill-switch `prefers-reduced-motion`
- Contexte d'usage réel : cuisine (mains mouillées) et salle de sport → gros, lisible, sans ambiguïté

---

## Tokens — Couleurs

| Token | Valeur | Usage |
|---|---|---|
| `--bg` | `#f0f2eb` | fond de page (sauge clair) |
| `--surface` | `#fcfdf9` | cartes (`.course-group`, `.profile-section`, `.batch-section`) et blocs Menu v3 (`.onglet-prepa`, `.file-dejeuners`) |
| `--surface-2` | `#e7eae0` | surfaces secondaires (inputs, `.weight-chip`, `.meta-pill`, `.recette-bchip`, chip foyer locale `.sync-chip-local`) |
| `--border` | `#e1e6da` | bordures de cartes, rail timeline, dots inactifs |
| `--text` | `#26312b` | texte principal — encre (≈ 13,2:1 sur surface) |
| `--muted` | `#6e7a6c` | texte secondaire (≈ 4,4:1 sur surface, ≈ 3,99:1 sur bg — les compteurs/notes principales utilisent `color-mix(in srgb, var(--muted) 70%, var(--text))`) |
| `--accent` | `#3e7a46` | **accent principal** (basilic) : actions, onglets, checkboxes, focus, tags Marc/Batch, barres séances — texte blanc dessus |
| `--accent-2` | `#f2dc7b` | **accent secondaire** (citron) : surbrillance — carte pesée, encadré keto, tags Mél, barre courses, nom du jour micro-batch. **Jamais en couleur de texte** |
| `--citron-surface` | `#fdf6d8` | fond des items « pot citron » du rituel |
| `--citron-line` | `#e3c94f` | bordure des items « pot citron » du rituel |
| `--danger` | `#b4452f` | erreurs (`.error`), delta d'alerte (`.stat-delta-alerte`) |

⚠️ Ne jamais coder une couleur en dur dans un composant — utiliser `var(--token)`. **Règle Herbes : texte blanc `#ffffff` sur basilic** (boutons, tags Marc, pill menu, Mode magasin actif) — ≈ 5,2:1 ; **texte encre `#26312b` sur citron** (tags Mél, nom du jour micro-batch, carte Mélanie onboarding) — ≈ 9,8:1.

---

## Tokens — Formes & Ombres

| Token | Valeur | Usage |
|---|---|---|
| `--radius` | `18px` | cartes |
| `--shadow` | `0 4px 16px rgb(38 49 43 / 0.08)` | élévation |

Rayons dérivés : boutons et cartes compactes `12px`, pills `999px` (`.cycle-pill`, `.rtab`, `.mtag`, `.mm`, `.lancer-btn`, `.btn-ghost`).

---

## Typographie

**Poppins** auto-hébergée (subset latin, 4 graisses 400/500/600/700, `font-display: swap`, précachée par le service worker) — 16 px base (`--fs-body`), interlignage `--lh-body` (1,5).

Échelle tokenisée — **aucune taille brute hors tokens** (garde-fou : `tests/css-tokens.test.ts`) :

| Token | Taille | Graisse usuelle | Usage |
|---|---|---|---|
| `--fs-hero` | 26 px | 700 | chiffres héros (budget, poids) |
| `--fs-h1` | 22 px | 700 | l'unique `h1` (titre de l'écran, en-tête) |
| `--fs-h2` | 20 px | 600/700 | titres majeurs (bannière, écrans poussés) |
| `--fs-h3` | 17 px | 600 | titres de cartes |
| `--fs-body` | 16 px | 400 | corps de texte |
| `--fs-sec` | 14 px | 600/700 | onglets, libellés secondaires |
| `--fs-meta` | 12 px | 600/700 | compteurs, hints |
| `--fs-micro` | 11 px | 500/700 | pastilles, notes |
| `--fs-chart` | 10 px | 500 | labels SVG du graphique de poids |
| `--fs-emoji` | 38 px | — | émojis géants de l'onboarding |

Interlignage tokenisé : `--lh-none: 1` (pills une ligne) · `--lh-tight: 1.2` (chiffres) · `--lh-title: 1.25` (titres) · `--lh-body: 1.5` (corps).

---

## Espacements

Échelle **2 px tokenisée** — 10 valeurs, le nom du token est sa valeur en px (garde-fou : `tests/css-tokens.test.ts`) :

`--sp-2` · `--sp-4` · `--sp-6` · `--sp-8` · `--sp-10` · `--sp-12` · `--sp-14` · `--sp-16` · `--sp-20` · `--sp-24`

Padding standard des cartes : `var(--sp-16)`. Gouttières page : `var(--sp-16)`. Padding bas de page : `calc(28px + safe-area-inset-bottom)` sur `.main-content` (exempt calc). Exceptions documentées : `margin: -1px` de `.sr-only` (pattern d'accessibilité standard).

---

## Composants (classes sémantiques)

| Classe | Rôle | Points clés |
|---|---|---|
| `.onboarding` | premier lancement (5 étapes) + migration préremplie | fond halos radiaux basilic/citron, full-dvh, safe-areas ; note migration `.onb-note` (fond citron 32 %) + `.mig-prof` (profil ancien détecté) |
| `.onboarding-dots` / `.onboarding-dot-active` | progression 5 étapes | pill 12→22px, active = `--accent` |
| `.onboarding-card-marc` / `-melanie` (+ `.sel`) | choix du profil (étape 1 : sélection + prénom « C'est ton prénom ? ») | dégradés 135deg (basilic `#3e7a46`→`#2e5d35` texte blanc ; citron `#f2dc7b`→`#d9bc4f` texte encre) + glow coloré, émoji 38px, prénom 19px/700, active `scale(0.97)` ; sélection = ring `box-shadow 0 0 0 2px` accent 25 % + `aria-pressed` |
| `.onboarding-cta` (+ `.onb-full`) | CTA final « C'est parti ! 🚀 » (étape 5) | fond `--accent`, texte blanc, 48px, glow, pleine largeur |
| `.onb-btnrow` / `.onb-next` / `.onb-back` / `.onb-skip` | navigation entre les étapes 2-5 (Passer aux étapes 2-4, retour seul à l'étape 5) | row flex ; next = pill basilic (flex: 1) texte blanc 48px ; back = ghost bordure `--border` 48px ; skip = tertiaire discret « Passer », texte muted mixé (`color-mix` ≥ 4,5:1), 48px — ≥ 48px partout |
| `.onb-label` / `.onb-hint` / `.onb-row2` | étiquette de bloc, hint muted et row 2 champs (personnes / repas par jour — onboarding étape 5 et Profil) | label 12px/700 uppercase muted ; row2 = flex, chaque champ `flex: 1` + `min-width: 0` |
| `.profil-back` | navigation retour écran Profil | ghost, ≥ 48px (encre 14px/600) |
| `.btn` | action principale | fond `--accent`, texte blanc, 700, min-height 48 px, active `scale(0.97)` |
| `.rcards` / `.rcard` (+ `.rcard-t` `.rcard-d` `.sel`) | cartes radio 2 colonnes (objectif 4 types) | grid 1fr 1fr gap 9px, ≥ 48px, radius 14px ; sélection = bordure basilic + fond accent 8 % + inset ring, titre basilic |
| `.rline` / `.rl` (+ `.rl-dot` `.sel`) | radios en ligne (régime, poids objectif au Profil) | lignes pleine largeur ≥ 48px bordure `--border` ; dot 18px, sélection = point basilic 9px |
| `.chips` / `.chip` (+ `.rm`) / `.addrow` | compléments (presets + ajout libre) | pills ≥ 42px, `.on` = plein basilic texte blanc ; `.addrow` = input (min-width: 0) + bouton pill |
| `.weight-chart` + `.weight-*` | courbe de poids SVG (WeightChart) dans la carte citron `.pesee-card` | chips Départ/Actuel/Objectif, aire dégradée `--accent` 22 %→0, ligne lissée Catmull-Rom, ligne objectif, points départ/actuel ; labels SVG 8-9px mix muted ≥ 4,5:1 sur fond citron mixé |
| `.profil-screen` | écran Profil | sections `.profile-section` |
| `.profil-ghost` | bouton secondaire du Profil (« Copier le prompt IA ») | ghost bordure `--border`, pill pleine largeur 48px, texte encre |
| `.greeting` | accueil personnalisé Mon suivi | muted, 14px/700 |
| `.obj-bloc` (+ `.obj-pills` `.obj-pill-type` `.obj-pill-reg` `.obj-echeance` `.obj-prog` `.obj-kg` `.obj-bar` `.obj-comps` `.cchip`) | bloc objectif en tête de Mon suivi | surface + radius ; pill type basilic texte blanc, pill régime citron 60 % (texte encre), échéance `.late` = `--danger`, barre progression `--accent` sur `--surface-2`, compléments `.cchip` surface-2 sous filet pointillé |
| `.qui` / `.portions` (+ `.qui-titre` `.portions-titre`) | encarts « Qui mange quoi » et « Portions — par personne » | fond `--accent` 7 % + bordure 15 % (`color-mix`), titres uppercase mix muted, tags `.mtag` — portions en mesures maison (les grammes ne servent qu'à caler l'œil) |
| `.progress` + `progress` | compteurs de progression (règles partagées Courses / Batch, dont le mode guidé) | texte bold mix muted, barre native `accent-color: --accent` |
| `.en-tete` + `.avatar` (+ `.avatar-pt` `.gris` `.danger`) | en-tête du shell v2 : seul `h1` (titre de l'écran) + avatar 48 px basilic (initiale blanche) qui ouvre le Profil | point 14 px bordure `--bg` = état sync (basilic / gris / danger), absent sans sync |
| `.ligne-semaine` | ‹ Sem. N · dates · Menu X › (Menu, Courses, Rituel) | chevrons 48 px basilic (désactivés = `--border`), texte 14px/600 centré, menu en basilic |
| `.barre-onglets` / `.onglet` (+ `.onglet-icone`) | barre du bas 5 onglets | fixe, grid 5 colonnes, fond `--surface`, filet haut, safe-area ; onglet ≥ 56 px, icône 22 px + libellé 12px/600 ; actif = `aria-current="page"`, texte encre, pastille basilic 18 % sous l'icône |
| `.carte-repas` (+ `-tete` `-corps` `-moment` `-titre` `-meta` `-ligne` `.fait`) | repas (Aujourd'hui, Menu) et étapes du rituel / micro-batch | carte surface + filet ; moment uppercase basilic 12px ; fait = titre muted barré ; lignes secondaires sous filet |
| `.coche` | coche d'un repas / d'une étape | 48 × 48, bordure `--border`, radius 14 ; `aria-pressed="true"` = plein basilic, check blanc |
| `.bande-jours` / `.jour` (+ `.point` `.plein` `.aujourdhui`) | 7 jours du menu | grid 7 colonnes ≥ 64 px ; sélection = plein basilic texte blanc ; aujourd'hui = bordure basilic ; point = journée faite |
| `.action-du-jour` / `.anticipe` / `.lie-rituel` / `.anticipe-titre` | encarts d'action (rituel, courses, reporté) et d'anticipation | action = bordure basilic 2px ; anticipe / lié = pointillé basilic ; titre uppercase basilic 12px |
| `.bouton-plein` / `.bouton-contour` | boutons des écrans v2 | ≥ 52 px, radius 14, 700 ; plein = basilic texte blanc ; contour = bordure basilic texte basilic ; `:disabled` opacité 0,45 |
| `.segment` | choix exclusifs (radio / onglets internes) | fond `--surface-2`, boutons ≥ 48 px, sélection = surface + ombre |
| `.ligne-cochable` + `.case` | listes cochables (ingrédients, courses, sous-étapes) | ≥ 48 px, filet bas ; case 26 px ; coché = case basilic, texte muted barré |
| `.budget-chiffres` (+ `.alerte`) / `.budget-alerte` | carte Estimé / Payé / Max (Courses) | 3 colonnes surface-2 ; dépassement = `--danger` (fond 12 %) + phrase « ≈ X € au-dessus de ton plafond » |
| `.macros` / `.macro` (+ `.kcal`) / `.pastille` | fiche recette | 4 colonnes ; kcal plein basilic texte blanc |
| `.minuteur` (+ `.termine`) | minuteur d'étape | pill ≥ 48 px surface-2, chiffres tabulaires ; terminé = fond citron (texte encre) |
| `.voile` / `.feuille` / `.option-report` / `.toast` | feuille de report + toast Annuler | voile encre 45 % ; feuille en bas, radius haut ; toast encre texte blanc au-dessus de la barre, « Annuler » souligné |
| `.guide` (+ `-tete` `-progres` `-fin`) | mode guidé du rituel | progression segmentée (fait basilic, courant citron) ; pied fixe Précédent / Suivant |
| `.hub-ligne` / `.hub-section` | lignes du hub Profil (Le foyer, Moi) | ≥ 56 px, icône basilic, titre + résumé muted, chevron |
| `.error` | message d'erreur | `--danger`, 600, `role="alert"` |
| `.muted` | texte secondaire / états vides | `--muted` |
| `.sr-only` | accessible visuellement | pattern standard clip |

---

## Icônes

Jeu SVG maison via `src/components/Icon.tsx` (`<Icon name size strokeWidth?>`) — trait 2 px **sauf sous 16 px : 2,5** (calculé par le composant, les petits tracés tombaient sous ~1 px réel), `currentColor`, viewBox 24, `aria-hidden`. **Plancher 14 px** : aucune icône inline sous 14. Émojis réservés à l'onboarding et aux salutations. Le jeu inclut `pasta` (réserve du batch).

---

## Accessibilité

- `:focus-visible` : outline 2 px `--accent`, offset 2 px — toujours visible, jamais supprimé
- Contrastes texte mesurés : texte/surface ≈ 13,2:1 · texte/bg ≈ 12:1 · muted/surface ≈ 4,4:1 (métadonnées secondaires — assumé) · blanc `#ffffff`/`--accent` ≈ 5,2:1 · encre `#26312b`/`--accent-2` ≈ 9,8:1 · danger/surface ≈ 5,4:1
- `prefers-reduced-motion: reduce` → toutes transitions désactivées (`!important`, seule utilisation autorisée)

---

## Responsive

- Mobile-first, largeur de contenu plafonnée à **560 px** centrée (`.main-content`)
- Safe-areas iOS : top et bottom sur `.main-content`, left/right en paysage via `max(16px, env(safe-area-inset-*))`
- `viewport-fit=cover` + barre de statut translucide (standalone PWA)
