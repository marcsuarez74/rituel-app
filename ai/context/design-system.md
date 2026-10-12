# Design System — Rituel

Source de vérité : `src/index.css` (section `:root`). Toute valeur ici doit y correspondre — si le CSS change, mettre à jour ce fichier.

## Principes

- **Thème clair unique « Marché coloré »** — pas de dark mode, pas de `prefers-color-scheme`
- **Ultra visible** : contraste texte ≥ 4,5:1 partout (règle repo — texte principal ≈ 13,9:1 sur papier, texte secondaire ≈ 7:1 sur papier et ≈ 7,6:1 sur cartes, blanc sur basilic ≈ 6,5:1 ; garde-fous : `tests/contraste.test.ts` et `tests/css-tokens.test.ts`), hiérarchie typographique forte, cibles tactiles ≥ 48 px
- **Le jaune fruit n'est jamais une couleur de texte** : `--accent-2` (= `--fru`) ne sert qu'aux fonds/bordures — texte sur jaune fruit = encre
- **Style marché** : papier crème, encre brune, bordures franches 2 px d'encre, ombres décalées sans flou, rayons organiques « faits main », étiquettes kraft ; une couleur par famille du marché (rayons) et une par plat (palette des plats, annexe A.2 de la spec)
- **Fluide** : transitions douces sur les éléments interactifs uniquement + kill-switch `prefers-reduced-motion` ; animations en `transform`/`opacity` (`--entree` 0,24 s, `--sortie` 0,16 s)
- Contexte d'usage réel : cuisine (mains mouillées) et salle de sport → gros, lisible, sans ambiguïté

---

## Tokens — Couleurs

Valeurs réelles sur `:root` (`src/index.css` — source de vérité) ; valeurs d'origine : annexe A de la
spec 2026-10-12. Les noms historiques (`--bg`, `--surface`, `--text`…) restent définis en alias.

| Token | Valeur | Usage |
|---|---|---|
| `--papier` (alias `--bg`) | `#fbf1dc` | fond de page (papier d'emballage crème) |
| `--papier-2` (alias `--surface-2`) | `#f4e3bf` | barre d'onglets, pieds, zones creuses |
| `--papier-3` | `#efe0bd` | fond hors app (html, overscroll) |
| `--blanc` (alias `--surface`) | `#fffaf0` | cartes, champs |
| `--kraft` / `--kraft-fonce` | `#e2c08d` / `#c99f62` | étiquettes kraft (`.kraft`) ; `--kraft-fonce` = filets internes pointillés (alias `--border`) |
| `--encre` (alias `--text`) | `#2a2219` | texte principal, traits, bordures, ombres — ≈ 13,9:1 sur papier |
| `--encre-2` (alias `--muted`) | `#5e4f3c` | texte secondaire — ≈ 7:1 sur papier, ≈ 7,6:1 sur cartes |
| `--ardoise` / `--craie` / `--craie-jaune` | `#26332f` / `#f7f0de` / `#f2d36b` | ardoise du marchand : toast, carte « maintenant » |
| `--basilic` (alias `--accent`) | `#2d6a37` | **accent principal** : actions, liens, coches, focus, sélection — texte blanc dessus (≈ 6,5:1) |
| `--basilic-clair` | `#d4ead2` | fonds basilic très clairs |
| `--fru` (alias `--accent-2`) | `#f2c230` | **surbrillance jaune fruit** : onglet actif, avatar, minuteur terminé. **Jamais en couleur de texte** |
| `--leg`/`--leg-t` · `--fru`/`--fru-t` · `--fra`/`--fra-t` · `--via`/`--via-t` · `--epi`/`--epi-t` | vive / claire | familles du marché : vive = formes (liserés, couvercles, cases), claire = fond derrière le texte |
| `--givre` | `#e3e9f6` | aplat congélateur (illustrations) |
| `--tomate-txt` (alias `--danger`) | `#b3321f` | erreurs, alertes — ≈ 5,5:1 sur papier, 5,9:1 sur cartes |
| `--citron-surface` / `--citron-line` | alias `--fru-t` / `--kraft-fonce` | usages transitoires (rituel « pot », rayon keto) jusqu'aux PR 3-4 |

⚠️ Ne jamais coder une couleur en dur dans un composant — utiliser `var(--token)`. **Règle Marché :
texte blanc `#ffffff` sur basilic** (boutons pleins, coches, pill actives) — ≈ 6,5:1 ; **texte encre
sur jaune fruit** (étiquette de l'onglet actif, minuteur terminé, carte Mélanie onboarding) — ≈ 9,3:1 ;
texte posé sur une couleur claire `-t` = toujours `--encre` ; jamais de texte sur une couleur vive
(famille ou plat).

---

## Tokens — Formes & Ombres

| Token | Valeur | Usage |
|---|---|---|
| `--r-orga` / `--r-orga-2` | `26px 20px 28px 18px` / `18px 26px 20px 28px` | rayons organiques « faits main », alternés sur les cartes voisines |
| `--r-bouton` | `18px 22px 18px 24px` | boutons |
| `--radius` | alias `--r-orga` | compatibilité des cartes existantes |
| `--shadow` | `4px 5px 0 var(--encre)` | cartes « posées » |
| `--shadow-forte` | `5px 6px 0 var(--encre)` | panneaux |
| `--shadow-bouton` | `3px 4px 0 var(--encre)` | boutons pleins (pression : `1px 1px 0` + translate) |

Bordures : `2px solid var(--encre)` pour les cartes et boutons, `1.5px` pour les éléments
secondaires (chips, radios), filets internes en `1.5px dashed var(--kraft-fonce)`. Désactivé :
fond `--papier`, texte `--encre-2`, bordure pointillée, pas d'ombre.

---

## Typographie

**Poppins** auto-hébergée (subset latin, 4 graisses 400/500/600/700, `font-display: swap`) pour le
corps ; **Bricolage Grotesque** auto-hébergée (700 et 800 seulement — la 500 de la maquette ne sert
pas au texte courant —, `font-display: swap`, licence OFL à côté des woff2) pour les titres et les
boutons pleins. Les deux sont précachées par le service worker (glob woff2) — corps 17 px
(`--fs-body`), interlignage `--lh-body` (1,55).

Échelle tokenisée — **aucune taille brute hors tokens** (garde-fou : `tests/css-tokens.test.ts`) :

| Token | Taille | Graisse usuelle | Usage |
|---|---|---|---|
| `--fs-hero` | 30 px | 800 | chiffres héros (budget, poids), titre d'accueil |
| `--fs-h1` | 26 px | 800 | l'unique `h1` (titre de l'écran, en-tête) |
| `--fs-h2` | 22 px | 800 | titres majeurs (bannière, écrans poussés), initiale d'avatar |
| `--fs-h3` | 19 px | 800 | titres de cartes, boutons pleins |
| `--fs-body` | 17 px | 400 | corps de texte (spec produit : texte courant ≥ 17 px) |
| `--fs-sec` | 16 px | 600/700 | liens, libellés secondaires |
| `--fs-meta` | 14 px | 600/700 | compteurs, hints, méta de repas |
| `--fs-micro` | 13 px | 500/700 | onglets, étiquettes kraft, notes |
| `--fs-chart` | 10 px | 500 | labels SVG du graphique de poids |
| `--fs-emoji` | 38 px | — | émojis géants de l'onboarding |

Interlignage tokenisé : `--lh-none: 1` (pills une ligne) · `--lh-tight: 1.2` (chiffres) ·
`--lh-title: 1.12` (titres Bricolage) · `--lh-body: 1.55` (corps). Titres : `letter-spacing: -0.01em`.

---

## Espacements

Échelle **2 px tokenisée** — 10 valeurs, le nom du token est sa valeur en px (garde-fou : `tests/css-tokens.test.ts`) :

`--sp-2` · `--sp-4` · `--sp-6` · `--sp-8` · `--sp-10` · `--sp-12` · `--sp-14` · `--sp-16` · `--sp-20` · `--sp-24`

Padding standard des cartes : `var(--sp-16)`. Gouttières page : `var(--sp-16)`. Padding bas de page : `calc(28px + safe-area-inset-bottom)` sur `.main-content` (exempt calc). Exceptions documentées : `margin: -1px` de `.sr-only` (pattern d'accessibilité standard).

---

## Composants (classes sémantiques)

| Classe | Rôle | Points clés |
|---|---|---|
| `.onboarding` | premier lancement (5 étapes) + migration préremplie | fond halos radiaux basilic/jaune fruit, full-dvh, safe-areas ; note migration `.onb-note` (fond jaune fruit 32 %) + `.mig-prof` (profil ancien détecté) |
| `.onboarding-dots` / `.onboarding-dot-active` | progression 5 étapes | pill 12→22px, active = `--accent` |
| `.onboarding-card-marc` / `-melanie` (+ `.sel`) | choix du profil (étape 1 : sélection + prénom « C'est ton prénom ? ») | dégradés 135deg en tokens (basilic→mix encre, texte blanc ; jaune fruit→mix encre, texte encre) + glow coloré, émoji 38px, tagline par carte (blanc sur Marc, encre sur Mélanie — revue PR 1 C1), prénom 22px/700, active `scale(0.97)` ; sélection = ring `box-shadow 0 0 0 2px` accent 25 % + `aria-pressed` |
| `.onboarding-cta` (+ `.onb-full`) | CTA final « C'est parti ! 🚀 » (étape 5) | fond `--accent`, texte blanc, 48px, glow, pleine largeur |
| `.onb-btnrow` / `.onb-next` / `.onb-back` / `.onb-skip` | navigation entre les étapes 2-5 (Passer aux étapes 2-4, retour seul à l'étape 5) | row flex ; next = pill basilic (flex: 1) texte blanc 48px ; back = ghost bordure `--border` 48px ; skip = tertiaire discret « Passer », texte muted (`var(--muted)`), 48px — ≥ 48px partout |
| `.onb-label` / `.onb-hint` / `.onb-row2` | étiquette de bloc, hint muted et row 2 champs (personnes / repas par jour — onboarding étape 5 et Profil) | label 12px/700 uppercase muted ; row2 = flex, chaque champ `flex: 1` + `min-width: 0` |
| `.profil-back` | navigation retour écran Profil | ghost, ≥ 48px (encre 14px/600) |
| `.btn` | action principale | fond `--accent`, texte blanc, 700, min-height 48 px, active `scale(0.97)` |
| `.rcards` / `.rcard` (+ `.rcard-t` `.rcard-d` `.sel`) | cartes radio 2 colonnes (objectif 4 types) | grid 1fr 1fr gap 9px, ≥ 48px, radius 14px ; sélection = bordure basilic + fond accent 8 % + inset ring, titre basilic |
| `.rline` / `.rl` (+ `.rl-dot` `.sel`) | radios en ligne (régime, poids objectif au Profil) | lignes pleine largeur ≥ 48px bordure `--border` ; dot 18px, sélection = point basilic 9px |
| `.chips` / `.chip` (+ `.rm`, `.chip-autre`) / `.addrow` | compléments, régime, préférences (presets + ajout libre) | pills ≥ 48px, `.on` / `[aria-pressed='true']` / `[aria-checked='true']` = plein basilic texte blanc ; `.chip-autre` = bordure pointillée basilic ; `.addrow` = input (min-width: 0) + bouton pill 48px |
| `.obj-resume` (+ `.obj-poids` `.obj-fleche` `.obj-vise` `.obj-ecart` `.obj-rythme`) | résumé de la page Profil › Objectif : dernière pesée → poids visé, écart, rythme | carte jaune fruit clair (`--citron-surface` + `--citron-line`, alias fru-t/kraft), poids `--fs-hero`/800, flèche et poids visé basilic, rythme muted |
| `.rcards` / `.rcard` (+ `-i` `-t` `-d`) | choix du cap (radios en cartes) | grille auto-fit ≥ 128px ; carte surface + bordure, icône sur `--surface-2` ; `[aria-checked='true']` = bordure basilic + fond basilic 8 %, icône pleine basilic |
| `.alerte-douce` | alerte non bloquante (« Rythme ambitieux ») | fond jaune fruit clair + filet kraft, icône info basilic, texte `--fs-meta` |
| `.rcards-ligne` | cartes radio en une colonne (onboarding étape 1 : « Juste la routine » / « Suivre mon poids ») | modificateur de `.rcards` : `grid-template-columns: 1fr` |
| `.partage-foyer` | créer / rejoindre un foyer (fin d'onboarding, Profil › Foyer) : code en `.sync-code`, boutons Copier / Partager en `.onb-row2` qui passe à la ligne, « Es-tu X ? » en `.rline` | réutilise `.onboarding-cta`, `.bouton-contour`, `.lien`, `.alerte-douce` |
| `.suivi-off` | encart « Suivi coupé » de la page Objectif (juste la routine) | surface + bordure pointillée, texte muted (`var(--muted)`) |
| `.pied-collant` | bouton « Enregistrer » unique collé en bas d'une page détail | sticky bottom, fond `--creme`, filet haut, bouton plein pleine largeur, safe-area iOS |
| `.weight-chart` + `.weight-*` | courbe de poids SVG (WeightChart) dans la carte jaune fruit `.pesee-card` | chips Départ/Actuel/Objectif, aire dégradée `--accent` 22 %→0, ligne lissée Catmull-Rom, ligne objectif, points départ/actuel ; labels SVG `--fs-chart` encre-2 (≥ 4,5:1 sur fond jaune fruit mixé) |
| `.profil-screen` | écran Profil | sections `.profile-section` |
| `.profil-ghost` | bouton secondaire du Profil (« Copier le prompt IA ») | ghost bordure `--border`, pill pleine largeur 48px, texte encre |
| `.greeting` | accueil personnalisé Mon suivi | muted, 14px/700 |
| `.obj-bloc` (+ `.obj-pills` `.obj-pill-type` `.obj-pill-reg` `.obj-echeance` `.obj-prog` `.obj-kg` `.obj-bar` `.obj-comps` `.cchip`) | bloc objectif en tête de Mon suivi | surface + radius ; pill type basilic texte blanc, pill régime jaune fruit mixé (texte encre), échéance `.late` = `--danger`, barre progression `--accent` sur `--surface-2`, compléments `.cchip` surface-2 sous filet pointillé |
| `.qui` / `.portions` (+ `.qui-titre` `.portions-titre`) | encarts « Qui mange quoi » et « Portions — par personne » | fond `--accent` 7 % + bordure 15 % (`color-mix`), titres uppercase mix muted, tags `.mtag` — portions en mesures maison (les grammes ne servent qu'à caler l'œil) |
| `.progress` + `progress` | compteurs de progression (règles partagées Courses / Batch, dont le mode guidé) | texte bold encre-2, barre native `accent-color: --accent` |
| `.en-tete` + `.avatar` (+ `.avatar-pt` `.gris` `.danger`) | en-tête du shell v2 : `h1` (titre de l'écran) + sous-titre `p` + avatar 50 px jaune fruit bordé d'encre (aria-label « Moi : {prénom} »), initiale Bricolage 800 centrée (`inline-grid` + `place-items: center`) | point 14 px bordure `--papier` = état sync (basilic / gris / danger), absent sans sync |
| `.ligne-semaine` | ‹ Sem. N · dates · Menu X › (Semaine, Courses, Rituel) | chevrons 48 px basilic (désactivés = kraft), texte 16px/600 centré, menu en basilic |
| `.barre-onglets` / `.onglet` (+ `.onglet-icone`) | barre du bas 4 onglets | fixe, grid 4 colonnes, fond `--papier-2`, filet haut 2 px encre, safe-area ; onglet ≥ 56 px, icône 22 px + libellé 13px/600 ; actif = `aria-current="page"`, étiquette jaune fruit encadrée d'encre (`inset 0 0 0 2px`) |
| `.carte-repas` (+ `-tete` `-corps` `-moment` `-titre` `-meta` `-ligne` `.fait`) | repas (Aujourd'hui, Semaine) et étapes du rituel / micro-batch | carte blanche bordure encre 2 px, rayon organique `--r-orga-2` ; moment uppercase basilic 14px ; fait = titre muted barré ; lignes secondaires pointillées kraft |
| `.coche` | coche d'un repas / d'une étape | 48 × 48, bordure encre 2 px, radius organique ; `aria-pressed="true"` = plein basilic, check blanc |
| `.bande-jours` / `.jour` (+ `.point` `.plein` `.aujourdhui`) | 7 jours du menu | grid 7 colonnes ≥ 64 px ; sélection = plein basilic texte blanc ; aujourd'hui = bordure basilic ; point = journée faite |
| `.action-du-jour` / `.anticipe` / `.lie-rituel` / `.anticipe-titre` | encarts d'action (rituel, courses, reporté) et d'anticipation | action = bordure encre 2 px + ombre franche, rayon organique ; anticipe / lié = pointillé basilic ; titre uppercase basilic 14px |
| `.bouton-plein` / `.bouton-contour` | boutons des écrans v2 | ≥ 56 px, Bricolage 800 19px, rayon `--r-bouton` ; plein = basilic bordure encre + ombre tampon `3px 4px 0` (pression : translate) ; contour = bordure encre texte encre ; `:disabled` fond papier pointillés sans ombre |
| `.segment` | choix exclusifs (radio / onglets internes) | fond `--papier-2`, boutons ≥ 48 px, sélection = surface + ring encre `inset 0 0 0 2px` |
| `.ligne-cochable` + `.case` | listes cochables (ingrédients, courses, sous-étapes) | ≥ 48 px, filet pointillé kraft ; case 26 px bordure encre ; coché = case basilic, texte muted barré |
| `.budget-chiffres` (+ `.alerte`) / `.budget-alerte` | carte Estimé / Payé / Max (Courses) | 3 colonnes surface-2 ; dépassement = `--danger` (fond 12 %) + phrase « ≈ X € au-dessus de ton plafond » |
| `.macros` / `.macro` (+ `.kcal`) / `.pastille` | fiche recette | 4 colonnes ; kcal plein basilic texte blanc |
| `.minuteur` (+ `.termine`) | minuteur d'étape | pill ≥ 48 px papier-2, chiffres tabulaires ; terminé = fond jaune fruit (texte encre) |
| `.voile` / `.feuille` / `.option-report` / `.toast` | feuille de report + toast Annuler | voile encre 50 % ; feuille papier bordée d'encre en bas ; toast ardoise texte craie au-dessus de la barre, « Annuler » souligné |
| `.kraft` (+ `.pointille` `.dehors`) | étiquette kraft (provenance, statuts) | fond kraft, point papier à gauche, 13px/700 ; variante pointillée = « à faire le jour même », papier-2 = « dehors » |
| `.guide` (+ `-tete` `-progres` `-fin`) | mode guidé du rituel | progression segmentée (fait basilic, courant jaune fruit) ; pied fixe Précédente / Étape suivante |
| `.hub-ligne` / `.hub-section` | lignes du hub Profil (Le foyer, Moi) | ≥ 56 px, icône basilic, titre + résumé muted, chevron |
| `.error` | message d'erreur | `--danger`, 600, `role="alert"` |
| `.muted` | texte secondaire / états vides | `--muted` |
| `.sr-only` | accessible visuellement | pattern standard clip |

---

## Icônes

Jeu SVG maison via `src/components/Icon.tsx` (`<Icon name size strokeWidth?>`) — trait 2 px **sauf sous 16 px : 2,5** (calculé par le composant, les petits tracés tombaient sous ~1 px réel), `currentColor`, viewBox 24, `aria-hidden`. **Plancher 14 px** : aucune icône inline sous 14. Émojis réservés à l'onboarding et aux salutations. Le jeu inclut `pasta` (réserve du batch).

---

## Accessibilité

- `:focus-visible` : outline 3 px `--accent`, offset 2 px — toujours visible, jamais supprimé
- Contrastes texte mesurés (garde-fou `tests/contraste.test.ts`) : encre/papier ≈ 13,9:1 · encre-2/papier ≈ 7,0:1 · encre-2/cartes ≈ 7,6:1 · blanc `#ffffff`/basilic ≈ 6,5:1 · encre/jaune fruit ≈ 9,3:1 · tomate/papier ≈ 5,5:1
- `prefers-reduced-motion: reduce` → toutes transitions désactivées (`!important`, seule utilisation autorisée)

---

## Responsive

- Mobile-first, largeur de contenu plafonnée à **560 px** centrée (`.main-content`)
- Safe-areas iOS : top et bottom sur `.main-content`, left/right en paysage via `max(16px, env(safe-area-inset-*))`
- `viewport-fit=cover` + barre de statut translucide (standalone PWA)
