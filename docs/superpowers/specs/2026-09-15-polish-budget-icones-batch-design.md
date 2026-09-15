# Spec — Polish : Budget courses, icônes & Batch fidèle à la maquette

**Date :** 2026-09-15 · **Statut :** validé en brainstorming (variantes montrées via companion visuel, session `.superpowers/brainstorm/88710-1789448552/`) · **Maquette de référence batch :** `docs/superpowers/mockups/herbes-maquette-interactive.html` (fait foi)

## Contexte

Trois retours après la livraison des chantiers 1-3 :

1. La carte « Budget courses » (chantier 3) est jugée « tableau de bord » : hiérarchie plate, trop de petites capitales, bouton « Voir mes dépenses réelles » hors guideline (pas de cible tactile 48 px)
2. Des icônes trop petites/pâles par endroits — à 11 px, le trait 2 d'un viewBox 24 tombe à ~0,9 px réel
3. L'onglet Batch ne matche pas la spec Herbes (§ 5, § 7.4-7.5) ni la maquette validée : réserve des boîtes absente, badge de durée et ligne production absents, détails micro-batch absents, état final du mode guidé divergent, émojis dans les titres

Décisions validées :

| Sujet | Décision |
|---|---|
| Batch — périmètre | **Contrat .md étendu** (champs optionnels rétrocompatibles) : la maquette est réellement atteignable |
| Batch — production/fin | Lignes-clés `- production:` / `- termine:` dans `### Rituel dimanche` |
| Batch — micro | Suffixe `| <détail>` (même motif que les notes des items courses) |
| Batch — réserve | Sous-section `### Réserve` : `- <jour\|mel>: <plat> \| <conservation>` ; icône déduite par mots-clés (décoratif) |
| Batch — lancer | Bouton basilic **pleine largeur** sous la timeline (la pilule du head disparaît, compteur head supprimé) |
| Budget courses | **Variante B « surbrillance citron »** : Payé en héros, estimé/max en phrase secondaire, plus de caps |
| Actions budget | **Deux pills basilic** (`.bsoft`) ≥ 48 px — « ＋ Total payé » + « Voir mes dépenses réelles » ; `.blink` disparaît de la carte |
| Icônes | **Plancher 14 px + trait 2,5 sous 16 px** (calculé dans `Icon`) ; nouvelle icône `pasta` |
| Bannières | `.batch-banner` : médaillon + texte **centrés verticalement** |

## 1. Contrat .md — extensions optionnelles (rétrocompatibles)

Le format v1/v2 reste parsé tel quel. Nouveautés **toutes optionnelles**, garde de forme : mal formé → warning, jamais crash. **Aucun id de coche nouveau ni modifié** (production/termine/réserve/détails ne sont pas cochables).

### 1.1 `### Rituel dimanche` — lignes-clés

Deux lignes spéciales, détectées **avant** le pattern étape `- <créneau> · <label> — <détail>` :

```
- production: <texte libre>
- termine: <texte libre>
```

- `production` → ligne muted sous le titre de la carte Rituel (ce que le batch produit + conservation) — `WeeklyData.rituelProduction?: string`
- `termine` → message de l'état final du mode guidé — `WeeklyData.rituelTermine?: string`
- Contenu vide (après `:`) → warning + ligne ignorée. Une occurrence multiple → la première gagne, warning pour les suivantes.

### 1.2 `### Micro-batch` — suffixe détail

`- lundi: quoi | détail` → `MicroBatchJour` gagne `detail?: string` (split au premier `|`, contenu trimé ; vide → traité comme absent). Le format sans `|` reste valide.

### 1.3 `### Réserve` — nouvelle sous-section de `## Batch`

```
### Réserve
- lundi: Poulet-riz | frigo, 2 j max · réchauffage 2 min bien chaud
- mel: Boîte keto saumon-asperges | à part, sans féculent · poisson frais
```

- `BATCH_SUBS` gagne `reserve` ; lignes parsées en `ReserveLigne { cle, plat, conservation }` :
  - `cle` ∈ jours (`lundi`…`dimanche`, sans accents) ou `mel` — affiché « Lundi »… ou « Mél » ; clé inconnue → warning + ligne ignorée
  - split au premier `|` ; plat ou conservation vide → warning + ligne ignorée
  - `WeeklyData.reserve?: ReserveLigne[]` (ordre du fichier conservé)
- **Icône déduite par mots-clés** (décoratif, jamais une information) : recherche dans « plat + conservation » (sans casse ni accents) — `congel` → `snow`, `poisson`/`saumon`/`sardine` → `fish`, `pates` → `pasta`, `salade` → `bowl` ; plus clé `mel` (texte contenant `keto` ou `mel`) → `leaf` ; défaut `box`

## 2. Batch — UI (`BatchView.tsx` + CSS)

Ordre : bannière « Ce soir » → carte Rituel (aperçu / mode guidé / fini) → Micro-batch → **Réserve**.

- **Carte Rituel** : `dayhead` = h3 **« Rituel dimanche »** (émoji 🕐 supprimé) + **badge « ≈ durée »** — `dureeRituel()` : somme des créneaux `A-B min` (`/(\d+)\s*-\s*(\d+)\s*min/`) → « ≈ 45 min » / « ≈ 1 h » / « ≈ 1 h 15 » ; créneau non parsable → ignoré ; total 0 ou rituel absent → **pas de badge**. Badge = fond `--surface-2`, bordure pointillée basilic, icône `clock` 14 px. **Compteur done/N du head supprimé** (état visible sur les lignes).
- **Ligne production** : sous le head, muted 10,5-11 px — absente si champ absent.
- **Timeline cochable** : inchangée (lignes ≥ 48 px, rail + dots basilic, done barré).
- **« Lancer le batch »** : bouton `.btn` basilic **pleine largeur, 48 px** avec icône `play` 14 px, sous la timeline. `.lancer-wrap`/`.lancer`/compteur retirés du head.
- **Mode guidé** : inchangé (meta « Étape n/N · créneau », titre, détail, barre, « Étape terminée → », ghost « Revenir à l'aperçu »). **État final** : check basilic **38 px** (strokeWidth 2,5), « Batch terminé ! », texte = `rituelTermine` sinon « Tout est prêt pour la semaine. », ghost « **Revoir l'aperçu** ».
- **Micro-batch** : h3 **« Micro-batch en semaine »** (émoji ⚡ supprimé) ; cartes : pill citron jour + quoi + **détail muted** (3e ligne, si présent) ; dots de pagination conservées.
- **Réserve** : carte titre h3 « La réserve — au frigo cette semaine » ; lignes : tuile 34 px `--surface-2` radius 10 + icône 16 px basilic (déd., § 1.3), « {Jour capitalisé|Mél} — {plat} » 12,5 px/600, conservation 11 px muted ; absente si `reserve` absent/vide.
- **`.batch-banner`** : `align-items: center` (médaillon + texte centrés verticalement — « Ce soir » et « Pensées pour le rituel »).

## 3. Carte Budget courses (variante B)

`CoursesBudget.tsx` + CSS `.bud*` :

- **Carte** : fond `color-mix(--accent-2 16%, var(--surface))`, bordure `color-mix(--accent-2 55%, var(--border))`, radius 18, padding 16/18.
- **Head** : « Budget courses » 13,5 px/700 encre (plus de caps) + pill magasin (fond `--surface`, icône `cart` 14 px).
- **Héros** : label « Payé cette semaine » 11,5 px/600 muted + valeur **27 px/700 tabulaire** (`--danger` si dépassé).
- **Phrase secondaire** 12 px muted (valeurs en encre 600, tabulaires) : « sur **≈ 35 €** estimés · max **40,00 €** » — parties masquées si `data.budget` / `budgetMax` absents ; ligne entière absente si ni l'un ni l'autre. La grille 3 colonnes `.bud-grid` disparaît.
- **Barre** 8 px basilic (`--danger` si dépassé) + « 96 % du budget » / « dépassé de X % » 11 px/700.
- **Actions** : filet pointillé citron, puis **deux pills `.bsoft` 48 px** : « ＋ Total payé » (largeur naturelle) + « Voir mes dépenses réelles » (flex: 1, min-width: 0) ; `flex-wrap: wrap` (point de vigilance 320 px). `.blink` retiré de la carte.
- **Général** : `.bsoft` min-height 40 → **48 px** ; `.blink` garde sa cible tactile 48 px (reste utilisé par « Annuler » du panneau dépenses). Visibilité de la carte inchangée (estimé OU max OU ≥ 1 dépense de la semaine).

## 4. Icônes — visibilité

- `Icon.tsx` : `strokeWidth` par défaut = **2,5 si size < 16, sinon 2** (la prop explicite reste prioritaire) — plus besoin de le passer aux appels.
- **Plancher 14 px** : toutes les icônes de 11/12/13 px passent à 14 (pills objectif, méta recette kcal/C/P/F + fraîcheur + mmeta, Mode magasin, marqueur rituel, notes, cart pill magasin, labels stat, boutons plus/check/chevrons compacts). Inchangés : 16 px (chevrons bannière, médaillons, check onboarding), 18 (tab bar), 20 (tuiles menu), 38 (fin guidée).
- **Nouvelle icône `pasta`** (chemins de la maquette : `M4 12h16a8 8 0 0 1-16 0z` + 4 tiges) pour la réserve.
- `ai/context/design-system.md` : section Icônes ajoutée (plancher 14 px, trait 2,5 sous 16, `pasta`).

## 5. Semaine d'exemple, template, prompt IA, README

- `semaine-exemple.md` : `- production:`, `- termine:`, détails `|` sur le micro-batch, `### Réserve` (lignes cohérentes avec son menu) — import **0 warning**.
- `docs/templates/template-semaine.md` : sections Rituel (production/termine) + Réserve avec commentaires d'instruction ; micro-batch avec `| détail`.
- `docs/templates/prompt-semaine-ia.md` : étape 4 (batch) + auto-contrôle enrichis (production/termine/réserve cohérentes d'une semaine à l'autre quand le menu ne change pas).
- `README.md` : grammaire fine du format mise à jour.

## 6. Tests (TDD)

- `tests/parse.test.ts` : production/termine (présents, absents, contenu vide → warning), micro détail (avec/sans/`|` vide), réserve (jours, `mel`, clé inconnue → warning, plat/conservation vides → warning), rétro-compat v1/v2 (aucune régression), exemple enrichi → 0 warning.
- `tests/lib/batch.test.ts` (nouveau) : `dureeRituel` (45 min → « ≈ 45 min », 60 → « ≈ 1 h », 75 → « ≈ 1 h 15 », créneaux non parsables → null, rituel absent/vide → null), `iconeReserve` (chaque mot-clé + défaut `box`).
- `tests/components.test.tsx` : BatchView (badge durée, production, **plus de `.lancer-wrap`**, bouton pleine largeur, micro 3 lignes + titre sans émoji, réserve rendue avec icônes attendues, done = termine sinon défaut + « Revoir l'aperçu »), CoursesBudget (héros 27 px logique de contenu, phrase secondaire conditionnelle, alerte dépassement, deux pills, visibilité 4 états conservée), bannière centrée (classe).
- `tests/app.test.tsx` : sélecteurs adaptés si besoin (titres sans émoji).
- `tests/e2e/` : batch (badge, lancer, réserve, guidé → fini), budget (carte citron, pills, wrap actions), **zéro débordement 320/375**.

## 7. Fichiers touchés

| Fichier | Action |
|---|---|
| `src/lib/model.ts` | `rituelProduction?`, `rituelTermine?`, `reserve?: ReserveLigne[]`, `MicroBatchJour.detail?` |
| `src/lib/parse.ts` | lignes-clés rituel, suffixe micro, `### Réserve` (`BATCH_SUBS` + parse dédié), warnings |
| `src/lib/batch.ts` | **nouveau** — `dureeRituel`, `iconeReserve`, `ReserveIcone` |
| `src/components/Icon.tsx` | stroke adaptatif + icône `pasta` |
| `src/components/cuisine/BatchView.tsx` | carte rituel (badge, production, `.btn` pleine largeur), micro 3 lignes + titres, réserve, done state |
| `src/components/cuisine/CoursesBudget.tsx` | carte B (héros, phrase, 2 pills) |
| `src/index.css` | `.bud*` (citron, héros, actions), `.batch-banner` centrée, `.badge`/`.prod`/`.rsv*`/`.mjd`, retrait `.lancer*` |
| `src/components/{ShoppingList,MenuView,ObjectifBloc,StatCards,ProfilScreen,onboarding/Onboarding}.tsx` | tailles d'icônes → 14 |
| `src/assets/semaine-exemple.md` | enrichie (production, termine, détails, réserve) |
| `docs/templates/*`, `README.md` | contrat documenté |
| `tests/` | miroir (§ 6) |
| `ai/context/design-system.md` | section Icônes |
| `CHANGELOG.md` | `[Non publié]` |
| `AGENTS.md` | contrat .md : production/termine/détail/Réserve |

## Hors périmètre

- Le reste des écrans (aucune retouche au-delà des 3 zones)
- Ids de coches, clés storage, parser des sections existantes
- Toute déduction de conservation par l'app (les textes viennent du .md)
- Le double affichage estimé (bannière rituel + carte) est conservé tel quel — la variante C (fusion) a été écartée

## Vérifications

- `npm test && npm run typecheck && npm run lint && npm run build && npm run e2e` — tout vert, zéro débordement 320/375
- Import de l'exemple enrichi → **0 warning** ; un fichier v1/v2 ancien s'importe sans régression
- Revue preview : carte budget 4 états, batch complet (badge, production, lancer, guidé, fini, micro, réserve), icônes à 320 px

## Risques

- **Deux pills dans `.bud-actions` à 320 px** : « Voir mes dépenses réelles » est long → wrap prévu (pills empilées), vérifié par e2e overflow
- **Badge durée** dépend de créneaux normalisés (`A-B min`) — fichiers générés hors format → pas de badge, dégradation gracieuse
- **Suppression du compteur rituel** : tests unitaires/e2e qui l'assertent doivent être adaptés (TDD)
- **`- production:`/`- termine:` dans une étape** : un libellé d'étape commençant par « production: » est improbable mais couvert — le préfixe `- production:` gagne toujours (documenté)
- Le suffixe `|` sur micro-batch pourrait figurer dans un `quoi` légitime (barre verticale dans un texte) → split au **premier** `|` seulement, documenté
