# Spec — Menu par recettes (onglets + file de déjeuners dynamique)

**Date :** 2026-09-16 · **Statut :** validé en brainstorming (maquettes v1-v3, http://localhost:50138 — session `.superpowers/brainstorm/`)

## Contexte

Le Menu v2 « réserve de recettes » affiche les occurrences de repas à plat : 7 jours × 5 clés = **33 items dans la semaine d'exemple**, tous mélangés. Difficile de se repérer, et le compteur « X/33 faits » est décourageant. Le besoin : **plus de flexibilité** (pas de jour imposé à l'écran), une **navigation par recette**, et un onglet déjeuners qui suit la réalité (une box de midi est toujours la conséquence d'un plat préparé, en batch ou dans la semaine).

Décisions validées :

- **Onglets = recettes/dîners** (pas de jours affichés), ordre = celui du fichier (batch/frigo d'abord, frais ensuite) — la flexibilité « aucun jour imposé » est conservée
- **Une seule coche par dîner** : l'adaptation keto de Mél et le batch du jour passent en **info** dans l'onglet
- **Onglet 🍱 Déjeuners dynamique** : les boxes se débloquent quand la recette qui les produit est cochée
- **Portions en mesures maison** (conv. B) : pièces, poignées, c. à soupe d'abord — les grammes entre parenthèses ne servent qu'à caler l'œil les premières fois
- Maquettes validées (v3) : pills sans jours, blocs « Qui mange quoi » / « Portions » / « Préparation » espacés, états grisés « fait »

## 1. Structure de l'onglet Menu

`MenuView` (sous-onglet Menu de Cuisine) est réécrit en 3 sous-composants :

```
[Dîners 2/7 · Boxes 2/7]          ← progression, N = onglets / paires réels
[Poulet rôties✓] [Pâtes bolo✓] [Omelette] [Wok poulet] … [🍱 Déjeuners]
                                  ← barre d'onglets scrollable (8 pills)
(onglet actif)                    ← OngletRecette OU FileDejeuners
```

- **1 onglet par jour du menu qui a un dîner** (`dinerFamille` ou `dinerMelanie`) — l'ancre est le jour, la recette n'est que le contenu : un jour sans `→ ref` garde son onglet (format v1 utilisable)
- **Pills sans jours** : nom court de la recette (2-3 mots, tronqué) ; sans ref = texte du dîner tronqué. Ordre = ordre du fichier
- **Onglet fait** (dîner coché) : opacité réduite + nom barré + ✓ — toujours tappable pour revoir
- **Auto-sélection à l'ouverture** : la recette du jour courant (via `trouverJourDuJour`, le jour n'est jamais affiché) ; repli = premier onglet non fait
- **Dernier onglet : 🍱 Déjeuners** (libellé figé), jamais grisé
- Scroll natif horizontal, scrollbar masquée (même pattern que le carrousel micro-batch) — jamais de carrousel JS

## 2. Onglet recette (contenu)

La fiche recette devient le cœur de l'onglet (plus de toggle « Voir la recette ») :

1. **Carte meta** : `temps` · `kcal` · score (barre 10 segments) + `fraicheur` — masqués si absents
2. **Qui mange quoi** : ligne **Marc** = texte du dîner (`dinerFamille`), ligne **Mél · keto** = `dinerMelanie` (menu). Tags existants (Marc basilic / Mél citron). Pas de ligne si la clé est absente — le repli sur `- mel:` (recette) est volontairement écarté : le menu du jour est la seule source (anti-duplication, cf. règle ci-dessous)
3. **Portions — par personne** : `portions marc:` / `portions melanie:` de la recette (masqué si absentes). Nouvelle convention de contenu (§5)
4. **Préparation — pour N** : `- pour 4:` + étapes numérotées + chips de bases (dépliables, comme aujourd'hui)
5. **Batch associé** : ligne `batch:` du jour (menu) — **info non cochable** (les coches batch restent dans l'onglet Batch). Repli sur `- batch:` de la recette écarté pour la même raison
6. **CTA « C'est fait — dîner fini »** : pill basilic 48 px ; coché → carte entière grisée (barré + opacité) et CTA devient « Dîner fait ✓ — annuler »

Règle anti-duplication : le menu (les lignes du jour) est prioritaire sur les lignes de recette (`mel:`, `batch:`) — on n'affiche jamais les deux.

## 3. Onglet 🍱 Déjeuners — file dynamique

Les déjeuners sont regroupés **par paire** (les 2 lignes `dejeunerMarc` + `dejeunerMelanie` d'un même jour, ordre du fichier). Trois états :

| État | Condition | Rendu |
|---|---|---|
| **Prêtes à emporter** | aucune ref, ou toutes les recettes sources sont cochées | lignes Marc/Mél + CTA « Boxes faites » |
| **À venir** | au moins une ref pointe vers un dîner non coché | opacité 55 % + note « débloquée quand *{nom recette}* est fait » |
| **Mangées** | paire cochée | barrées, opacité 50 %, regroupées en bas |

- **Disponibilité par paire** : une paire est prête quand **toutes** ses lignes à ref sont débloquées (une ligne sans ref = toujours disponible). La note de verrouillage cite la recette manquante
- **CTA « Boxes faites »** (une action par paire) coche **toutes** les clés déjeuner présentes ce jour-là (`dejeunerMarc` + `dejeunerMelanie`) — jamais un jour bloquant : une paire à une seule ligne se coche seule
- Pas de jour affiché ; une paire sans aucune ligne du jour n'existe pas
- **Progression** : `Dîners X/N · Boxes X/N` où N = nombre réel d'onglets / de paires (7 dans la semaine d'exemple)

## 4. Coches & ids (contrat préservé)

- **Coche dîner** = id existant `menu:{jour}:dinerFamille` (repli `menu:{jour}:dinerMelanie` si pas de dîner famille) → **les coches déjà posées sur les téléphones survivent, zéro migration**
- **Coche paire boxes** = écrit les ids existants `menu:{jour}:dejeunerMarc` + `menu:{jour}:dejeunerMelanie` (celles qui existent) — idem zéro migration
- Les anciennes coches `menu:{jour}:batch` ne sont plus affichées (batch = info) : l'état reste en storage, sans effet
- `parse.ts` : **aucun changement** — les refs `→ slug` sont déjà extraites pour toutes les clés menu (parse.ts:192-197)
- Persistance inchangée : `sportapp:checks:{semaine}` + pattern render-phase reset (`syncedSemaine`)

## 5. Convention « mesures maison » (contenu, pas code)

Les champs `portions marc:` / `portions melanie:` sont du texte libre : la convention vit dans le contenu.

- **Règle** : unités domestiques d'abord, adaptées à l'aliment — pièces (œufs, galettes, cuisses), poignées/tasses (féculents cuits, légumes), c. à soupe (huile, sauce, crème ≈ 15 ml), louches (soupe) — grammes entre parenthèses pour caler l'œil : `1 poignée de riz (~150 g cuit)`
- **Jamais de balance obligatoire** : une portion ne doit pas exiger de peser
- **Déclinaison** : `src/assets/semaine-exemple.md` (portions réécrites + refs `→ R#` ajoutées sur les lignes déjeuner quand le lien est clair — sans ref la box reste toujours prête), `docs/templates/template-semaine.md` (instruction par placeholder), `docs/templates/prompt-semaine-ia.md` (règle dure : box de midi toujours liée à une recette via `→ slug`)
- Le déjeuner étant « en théorie toujours lié à un plat préparé », la convention rend la ref **attendue** ; l'app reste permissive (sans ref → toujours prête, jamais bloquante)

## 6. Implémentation

- `src/lib/menu.ts` (nouveau, pur, zéro React) : `construireOnglets(menu, recettes)` (onglets + paires + labels), `pairePrete(paire, checks)`, `selectionInitiale(onglets, menu, today)` — toute la logique testable sans React
- `MenuView.tsx` : `TabBar` (pills, `aria-current`-like via `aria-pressed`/état actif), `OngletRecette`, `FileDejeuners` — présentation seule, pattern `syncedSemaine` conservé
- CSS : classes sémantiques nouvelles (`.rtabs`, `.rtab`, `.qui`, `.portions`, `.box-pair`…) sur tokens uniquement, cibles ≥ 48 px, `.fait` = opacité + barré (pattern existant)
- La réserve « menu-reserve » et le compteur 33 items disparaissent (la classe `.menu-card` reste utilisée par rien d'autre — nettoyage CSS des classes orphelines)

## Hors périmètre

- Édition/réordonnancement du menu dans l'app, drag & drop des onglets
- Coche rapide dans les pills (la coche reste le CTA de l'onglet)
- Statistiques, notifications, changement de régime en cours de semaine
- Onglets Courses et Batch (inchangés), import .md (hors UI)

## Tests (TDD)

- `tests/menu.test.ts` (nouveau) : construireOnglets (7 onglets + déjeuners, ordre fichier, label recette vs fallback texte), coche dîner (id dinerFamille, repli dinerMelanie), paire (prête/à venir/mangée selon refs et checks, note de déblocage, coche = 2 ids, paire à 1 ligne), selectionInitiale (jour courant, repli premier non fait)
- `components.test.tsx` : TabBar (pills sans jour, grisée si fait, dernier onglet Déjeuners), OngletRecette (sections, anti-duplication menu>recette, CTA coche → grisé + annulable), FileDejeuners (états, CTA paire, note de déblocage)
- `app.test.tsx` : menu v3 rendu depuis la semaine d'exemple, progression Dîners/Boxes
- `tests/e2e/` : parcours « cocher le dîner → onglet grisé → box correspondante débloquée → boxes faites » ; **zéro débordement horizontal 320/375** (la barre d'onglets scrollable = point de vigilance, pattern micro-batch)

## Vérifications

- `npm test && npm run typecheck && npm run lint && npm run build && npm run e2e` — tout vert
- `npm run build && npm run preview` avant commit
- Dogfooding : la semaine d'exemple affiche 8 onglets, les 2 premières recettes grisées après reprise des coches existantes (aucune perte d'état au premier lancement après déploiement)

## Risques

- **Barre de 8 pills à 320 px** : scroll natif obligatoire, e2e overflow ; pills compactes (nom court tronqué ~14 caractères)
- **Semaines déjà importées sans refs sur les déjeuners** : toutes les paires « prêtes » d'emblée (permissif) — l'UI reste correcte, la dynamique arrive avec les prochains cycles générés
- **Recette introuvable** (ref cassée) : l'onglet garde le fallback texte du dîner, sections recette masquées — jamais de crash (warning à l'import existe déjà pour les refs inconnues)
- **Écart de vocabulaire** : « dîner fait » coche `dinerFamille` même si Mél mange autre chose — assumé (un seul repas du soir par foyer)
