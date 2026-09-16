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
| `--surface` | `#fcfdf9` | cartes (`.week-banner`, `.course-group`, `.profile-section`, `.batch-section`) et blocs Menu v3 (`.onglet-prepa`, `.file-dejeuners`) |
| `--surface-2` | `#e7eae0` | surfaces secondaires (`.banner-nav`, inputs, `.weight-chip`, `.meta-pill`, `.recette-bchip`) |
| `--border` | `#e1e6da` | bordures de cartes, rail timeline, dots inactifs |
| `--text` | `#26312b` | texte principal — encre (≈ 13,2:1 sur surface) |
| `--muted` | `#6e7a6c` | texte secondaire (≈ 4,4:1 sur surface, ≈ 3,99:1 sur bg — les compteurs/notes principales utilisent `color-mix(in srgb, var(--muted) 70%, var(--text))`) |
| `--accent` | `#3e7a46` | **accent principal** (basilic) : actions, onglets, checkboxes, focus, tags Marc/Batch, barres séances — texte blanc dessus |
| `--accent-2` | `#f2dc7b` | **accent secondaire** (citron) : surbrillance — carte pesée, encadré keto, tags Mél, barre courses, nom du jour micro-batch. **Jamais en couleur de texte** |
| `--danger` | `#b4452f` | erreurs (`.error`), `.profil-switch`, delta d'alerte (`.stat-delta-alerte`) |

⚠️ Ne jamais coder une couleur en dur dans un composant — utiliser `var(--token)`. **Règle Herbes : texte blanc `#ffffff` sur basilic** (boutons, tags Marc, pill menu, Mode magasin actif) — ≈ 5,2:1 ; **texte encre `#26312b` sur citron** (tags Mél, nom du jour micro-batch, carte Mélanie onboarding) — ≈ 9,8:1.

---

## Tokens — Formes & Ombres

| Token | Valeur | Usage |
|---|---|---|
| `--radius` | `18px` | cartes |
| `--shadow` | `0 4px 16px rgb(38 49 43 / 0.08)` | élévation |

Rayons dérivés : boutons et cartes compactes `12px`, pills `999px` (`.menu-pill`, `.rtab`, `.mtag`, `.mm`, `.lancer`, `.btn-ghost`).

---

## Typographie

**Poppins** auto-hébergée (subset latin, 4 graisses 400/500/600/700, `font-display: swap`, précachée par le service worker) — 16 px base, `line-height: 1.5`.

| Niveau | Taille | Graisse | Usage |
|---|---|---|---|
| `h1` | 22 px | 600 | titres de section (24 px/700 dans l'onboarding) |
| `.week-title` | 20 px | 700 | titre de semaine (bannière) |
| `h2` | 20 px | 600 | titre de profil |
| `h3` | 17 px | 600 | titres de cartes (rayons, sections batch, cartes guide) |
| corps | 16 px | 400 | contenu |
| `.seg-tab` | 15 px | 600 | libellés des segments (actif = encre, inactif muted) |

---

## Espacements

Échelle 4 px : 2 · 4 · 8 · 12 · 16 · 24. Padding standard des cartes : 16 px. Gouttières page : 16 px. Padding bas de page : `calc(28px + safe-area-inset-bottom)` (sur `.main-content`).

---

## Composants (classes sémantiques)

| Classe | Rôle | Points clés |
|---|---|---|
| `.onboarding` | premier lancement (5 étapes) + migration préremplie | fond halos radiaux basilic/citron, full-dvh, safe-areas ; note migration `.onb-note` (fond citron 32 %) + `.mig-prof` (profil ancien détecté) |
| `.onboarding-dots` / `.onboarding-dot-active` | progression 5 étapes | pill 12→22px, active = `--accent` |
| `.onboarding-card-marc` / `-melanie` | choix du profil | dégradés 135deg (basilic `#3e7a46`→`#2e5d35` texte blanc ; citron `#f2dc7b`→`#d9bc4f` texte encre) + glow coloré, émoji 38px, prénom 19px/700, active `scale(0.97)` |
| `.onboarding-cta` (+ `.onb-full`) | CTA final « C'est parti ! 🚀 » (étape 5) | fond `--accent`, texte blanc, 48px, glow, pleine largeur |
| `.onb-btnrow` / `.onb-next` / `.onb-back` | navigation entre les étapes 2-5 (retour seul à l'étape 5) | row flex ; next = pill basilic (flex: 1) texte blanc 48px ; back = ghost bordure `--border` 48px — ≥ 48px partout |
| `.onb-label` / `.onb-hint` / `.onb-row2` | étiquette de bloc, hint muted et row 2 champs (personnes / repas par jour — onboarding étape 5 et Profil) | label 12px/700 uppercase muted ; row2 = flex, chaque champ `flex: 1` + `min-width: 0` |
| `.profil-back` | navigation retour écran Profil | ghost, ≥ 48px (encre 14px/600) |
| `.btn` | action principale | fond `--accent`, texte blanc, 700, min-height 48 px, active `scale(0.97)` |
| `.rcards` / `.rcard` (+ `.rcard-t` `.rcard-d` `.sel`) | cartes radio 2 colonnes (objectif 4 types) | grid 1fr 1fr gap 9px, ≥ 48px, radius 14px ; sélection = bordure basilic + fond accent 8 % + inset ring, titre basilic |
| `.rline` / `.rl` (+ `.rl-dot` `.sel`) | radios en ligne (régime, poids objectif au Profil) | lignes pleine largeur ≥ 48px bordure `--border` ; dot 18px, sélection = point basilic 9px |
| `.chips` / `.chip` (+ `.rm`) / `.addrow` | compléments (presets + ajout libre) | pills ≥ 42px, `.on` = plein basilic texte blanc ; `.addrow` = input (min-width: 0) + bouton pill |
| `.stat-cards` / `.stat-card` / `.stat-card-hero` | carte Poids seule, pleine largeur (Mon suivi) | grid 1 colonne ; hero = valeur 26px + variation `▼/▲ x,x kg vs 7 jours` colorée selon le sens de l'objectif (`stat-delta-bon` basilic / `stat-delta-alerte` danger / `stat-delta-neutre` muted) |
| `.weight-chart` + `.weight-*` | courbe de poids SVG (WeightChart) dans la carte citron `.pesee-card` | chips Départ/Actuel/Objectif, aire dégradée `--accent` 22 %→0, ligne lissée Catmull-Rom, ligne objectif, points départ/actuel ; labels SVG 8-9px mix muted ≥ 4,5:1 sur fond citron mixé |
| `.tabbar-segmented` / `.seg-tab` / `.seg-tab-active` | **nav segmented sous la bannière** (2 onglets : Cuisine / Mon suivi) | grid 2 colonnes égales, gap 4px, padding 4px ; fond `--surface-2` + bordure, pill `999px` ; **pilule glissante** = `::before` (fond `--surface` + ombre), `transform: translateX(calc(100% + 4px))` quand `data-active='suivi'`, transition `0.32s cubic-bezier(0.34, 1.56, 0.64, 1)` (rebond élastique) ; **actif** = texte encre + `aria-current="page"` ; **inactif** = muted ; ≥ 48 px |
| `.cuisine-tabs .tab` | sous-onglets Cuisine (Courses / Menu / Batch) | filets (`border-bottom`), actif = encre + barre basilic 2,5px |
| `.week-title-row` + `.menu-pill` | bannière semaine : titre + pill du menu courant | row flex wrap (gap 10px) ; pill = fond `--accent`, texte blanc 12px/700, radius 999px, glow `color-mix(--accent 35%)` — visible au-dessus des 3 sous-onglets |
| `.batch-banner` | rappel rituel (Courses) / « Ce soir » (Batch) | fond `--accent` 9% (`color-mix`), icône ronde `.bb-ic`, texte 13px ; version Courses : budget « X estimés. » en fin de phrase |
| `.course-group-header` + `img` | en-tête de groupe de courses | miniature 72×54 (`object-fit: cover`, radius 10px) via `imagePourRayon` (`src/lib/rayons.ts`), `loading="lazy"`, alt = libellé du rayon |
| `.rayon-cnt` | compteur d'items d'un rayon | muted 13px/700, collé à droite (`margin-left: auto`) |
| `.item-rituel` / `.item-note` | marqueurs d'item course | `· rituel` basilic (icône pot 12px, items destinés au batch) ; note fraîcheur 12px mix muted |
| `.mm` | Mode magasin (Courses) | pill 48px bordure `--border`, `aria-pressed` ; actif = plein `--accent` texte blanc ; masque les items cochés, bouton « Tout revoir » |
| `.bud` (+ `.bud-head` `.mag` `.bud-grid` `.bud-cell` `.bud-foot` `.bud-bar` `.bud-pct` `.bud-actions`) | carte « Budget courses » au-dessus de la liste (onglet Courses) | surface + radius tokens ; pill magasin citron 60 % (texte encre) ; grid 3 cellules (estimé menu / payé cette semaine / budget max, `.cols2` si pas de max) ; barre + pourcentage — dépassement = `.alerte` (`--danger`) ; actions = `.bsoft` « Total payé » + `.blink` « Voir mes dépenses réelles » ; carte absente si aucune donnée budget |
| `.bsoft` / `.blink` | boutons sobres des écrans maison & courses (le gros basilic reste réservé au CTA onboarding et aux « Enregistrer » du Profil) | `.bsoft` = pill bordure accent 35 %, texte basilic, 40px ; `.blink` = lien basilic sans bordure |
| `.dep-panel` (+ `.dep-head` `.dep-back` `.dep-form` `.dep-sec-label` `.dep-sum` `.dep-list` `.dep-hint`) | panneau « Mes dépenses réelles » (écran poussé de l'onglet Courses) | retour muted en tête, h1 20px ; form `.dep-form` (frow 3 colonnes date/magasin/total, total tabulaire aligné droite — frow passe en 1 colonne empilée < 360px), actions « Annuler » + `.bgo` basilic 38px ; résumé « Par magasin » = grid 2 cartes (total + moyenne tabulaires) ; historique = lignes date/magasin/total + suppression ✕ 32px |
| `.keto-box` / `.keto-title` | encadré keto de Mélanie (rayon `### Keto`) | fond `--accent-2` 12% + bordure 45% (`color-mix`), titre encre 15px/700 (icône leaf basilic) — affiché en dernier |
| `.profile-icon-btn` | accès écran Profil | 48px, surface-2, icône SVG person `currentColor` |
| `.profil-screen` / `.profil-switch` | écran Profil | sections `.profile-section` ; switch = bordure `--danger` (action sensible) |
| `.profil-ghost` | bouton secondaire du Profil (« Copier les paramètres IA ») | ghost bordure `--border`, pill pleine largeur 48px, texte encre |
| `.greeting` | accueil personnalisé Mon suivi | muted, 14px/700 |
| `.obj-bloc` (+ `.obj-pills` `.obj-pill-type` `.obj-pill-reg` `.obj-echeance` `.obj-prog` `.obj-kg` `.obj-bar` `.obj-comps` `.cchip`) | bloc objectif en tête de Mon suivi | surface + radius ; pill type basilic texte blanc, pill régime citron 60 % (texte encre), échéance `.late` = `--danger`, barre progression `--accent` sur `--surface-2`, compléments `.cchip` surface-2 sous filet pointillé |
| `.checklist` + `.done` | listes cochables | label min-height 48 px, checkbox 22 px `accent-color: --accent` ; done = barré + muted |
| `.seance-rec` (+ `.seance-txt`) | pastille « conseillé lun. » des séances | pill surface-2 10px/700 uppercase, texte mix muted 70 % (≥ 4,5:1 — la pastille porte la seule copie du jour), jamais barrée quand la séance est cochée |
| `.menu-head` / `.menu-progress` + `.bar` | progression de l'onglet Menu v3 (« Dîners X/N · Boxes X/N ») | compteurs 12,5px/700 mix muted 70 % (≥ 4,5:1 sur `--bg`) ; barres 72×6px `--surface-2` + remplissage `--accent`, transition width décorative (couverte par le kill-switch reduced-motion) |
| `.rtabs` / `.rtab` (+ `.active` `.fait` `.tick` `.rn`) | barre d'onglets par recette (7 dîners + 🍱 Déjeuners, aucun jour affiché) | pills scrollables (scrollbar masquée), plancher 42 px (même plancher que `.chip` — tension documentée vs CTA 48 px) ; actif = plein `--accent` texte blanc + glow ; fait = texte mix muted 70 % + line-through sur pill opaque (jamais d'opacité : le contraste casse), tick SVG |
| `.onglet-recette` (+ `.onglet-meta` `.onglet-prepa` `.onglet-batch`) | fiche recette complète de l'onglet actif | blocs surface + bordure + radius ; meta pills `.meta-pill` (surface-2, icônes muted), note `.fraicheur` mix muted ; fait = contenu voilé opacité 0,75, CTA exempt |
| `.qui` / `.portions` (+ `.qui-titre` `.portions-titre`) | encarts « Qui mange quoi » et « Portions — par personne » | fond `--accent` 7 % + bordure 15 % (`color-mix`), titres uppercase mix muted, tags `.mtag` — portions en mesures maison (les grammes ne servent qu'à caler l'œil) |
| `.bat` | pastille « Batch associé » de l'onglet | `--surface-2`, tag `.tag-bat` |
| `.mtag` (`.tag-marc` `.tag-mel` `.tag-fam` `.tag-bat`) | tags de profil des repas (onglets + file déjeuners) | pills 11px/700 : Marc plein `--accent` (texte blanc), Mél citron 55% (texte encre), Famille `--surface-2`, Batch `--accent` 20% (texte basilic) |
| `.cta` (+ `.done`) | coche « C'est fait — dîner fini » de l'onglet | plein `--accent` texte blanc, 48px, glow, active `scale(0.97)` ; done = `--surface-2` texte encre sans glow |
| `.mini-cta` | coche « Boxes faites » de la file déjeuners | plein `--accent` texte blanc, 48px, radius 12px |
| `.file-dejeuners` (+ `.fhead` `.box-pair` `.lock-note`) | file dynamique des déjeuners (Prêtes à emporter / À venir / Mangées) | carte surface, séparateurs pointillés ; sections `.fhead` uppercase mix muted ; `.locked` / `.mangees` = texte `--muted` (pas d'opacité), mangées barrées ; `.lock-note` « débloquée quand … est fait » mix muted + icône lock |
| `.score-bar` / `.score-seg` | health score dans la pill meta de l'onglet | barre 97px (10 segments, `.on` = `--accent`) |
| `.recette-pour` / `.recette-bases` (+ `.recette-bchip` `.recette-bdesc`) / `.recette-etapes` | préparation dans `.onglet-prepa` | `.recette-bchip` cliquable 48px (état `.on` = bordure accent, texte basilic mixé 90 % ≥ 4,5:1 sur surface-2), description `.recette-bdesc` surface-2, étapes `ol` 13px |
| `.progress` + `progress` | compteurs de progression (règles partagées Courses / Batch, dont le mode guidé) | texte bold mix muted, barre native `accent-color: --accent` |
| `.batch-section` / `.batch-section-head` | cartes du Batch (rituel, micro-batch, guidé) | surface + bordure + radius tokens, titre 17px |
| `.lancer` / `.batch-guide` | mode guidé « Lancer le batch » | pill basilic 48px texte blanc ; guide = étape num basilic, titre 19px, progress, CTA `.btn` + retour `.btn-ghost`, état final `.guide-done-ic` |
| `.rituel-timeline` + `.rituel-etape` | timeline cochable du rituel dimanche | rail vertical 2px `--border` + dots 10px `--accent` (done = `--border`), lignes ≥ 48px, créneau muted à droite, done = barré + muted |
| `.micro-batch` + `.micro-jour` | carrousel micro-batch | flex `overflow-x: auto` (scrollbar masquée), cartes fixes 150px surface radius 14px, nom du jour en pill citron |
| `.error` | message d'erreur | `--danger`, 600, `role="alert"` |
| `.warn-line` | avis lignes ignorées | ambre `#fbbf24` |
| `.muted` | texte secondaire / états vides | `--muted` |
| `.sr-only` | accessible visuellement | pattern standard clip |

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
