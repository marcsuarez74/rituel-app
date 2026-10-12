# Refonte ergonomique « Marché coloré » — spec et plan

Date : 2026-10-12 · statut : maquette validée par Marc (« tout est validé »), spec et plan à relire
avant exécution.

Maquette de référence (fait foi pour le visuel et les textes) :
`docs/superpowers/mockups/2026-10-12-refonte-ergo-marche.html` — 13 téléphones.
Maquette de structure antérieure (même navigation, autre visuel) :
`docs/superpowers/mockups/2026-10-12-refonte-ergo.html`.

Ce document réunit la **spec** (partie I : ce qu'on livre et pourquoi) et le **plan**
(partie II : comment, PR par PR, en TDD). La spec fait foi en cas de doute.

---

# Partie I — Spec

## 1. Problèmes de départ

1. **La semaine type n'a aucun effet visible.** Modifier « Ma semaine type » ne change ni les
   menus ni les box en cours : elle ne nourrit que le texte envoyé à l'IA
   (`src/lib/promptIa.ts:66-93` est son seul lecteur). Marc a cru à un bug.
2. **Navigation chargée.** 5 onglets (Aujourd'hui · Menu · Courses · Rituel · Suivi), une ligne
   semaine ‹ Sem. N · Menu X ›, 5 écrans poussés (fiche recette, mode guidé, Mon cycle, Ma semaine
   type, Profil), plusieurs vues dans Rituel (jour / semaine / réserve) : on navigue « dans tous
   les sens ».
3. **Le rituel du dimanche n'est pas clair** (4 points remontés par Marc) :
   - on ne sait pas **quoi cuire et pour quand** ;
   - l'**ordre** des étapes n'est pas réaliste (un plat après l'autre, un seul minuteur) ;
   - le **concept** (cuisiner dimanche pour la semaine) n'est jamais expliqué ;
   - le **rangement** (frigo, congélateur, box) est flou.
4. **Le mot « cycle »** ne convient pas à Marc.
5. **Le visuel** fait « design IA », pas assez chaleureux pour un public grand public.
6. Défaut annexe : changer `jourCourses` ne recale pas le début des menus en cours
   (`monCycle.ts` `changerDebut` n'est pas appelé).

## 2. Décisions validées

| Sujet | Décision |
|---|---|
| Semaine type | **Option B** : elle ne modifie jamais les menus en cours. Elle s'applique aux **prochains menus**, et l'attente est rendue visible (badge sur le créneau modifié + bandeau qui compte les changements en attente). |
| Vocabulaire | « cycle » **banni de tout texte visible**. Le programme de 4 semaines = « **menus** » (« Prépare tes prochains menus », « Menus · semaine 2 sur 4 »). « **Rituel** » = la session de cuisine du dimanche, uniquement. Les identifiants de code et les clés localStorage gardent `cycle`. |
| Navigation | 4 onglets : **Aujourd'hui · Semaine · Courses · Rituel**. L'avatar en haut à droite ouvre **Moi** (ex-Profil). Le suivi poids n'est plus un onglet : une carte dans Aujourd'hui (si `estSuivi`) et une section dans Moi. |
| Rituel | Explication en 3 vignettes à la première visite · grille « Ce dimanche » · mode guidé par **actions en parallèle** avec **plusieurs minuteurs** · recettes intégrées au mode guidé · étape finale « **On range** » (frigo / congélateur / box) · fin festive · vue « Au frigo cette semaine ». |
| Direction artistique | « **Marché coloré** » : remplace le thème Herbes. |
| Principe produit | App pour « monsieur et madame tout le monde » : **une seule action principale par écran**, texte courant ≥ 17 px, cibles ≥ 48 px, contraste ≥ 4,5:1. |
| Maquettes | Toujours une maquette validée avant le code de l'UI (déjà fait ici). Un écran non couvert par la maquette = maquette d'abord. |

## 3. Direction artistique « Marché coloré »

### 3.1 Tokens (remplacent Herbes dans `src/index.css` `:root`)

Valeurs reprises de la maquette (bloc `:root` du fichier `-marche.html`). **Les valeurs exactes
sont dans l'annexe A**, qui fait foi :

- **Fond** : `--papier #fbf1dc` (papier d'emballage crème), `--papier-2 #f4e3bf` (barre
  d'onglets, pieds, zones creuses), fond hors app `#efe0bd`.
- **Encre** : `--encre` (texte et traits, brun-noir), `--encre-2` (texte secondaire —
  **doit tenir 4,5:1 sur `--papier` ET sur les cartes blanches** : l'ancien `--muted` Herbes à
  4,41:1 ne doit pas être reproduit).
- **Action** : `--basilic #2d6a37` pour le bouton plein (texte blanc ≥ 4,5:1), jaune « fruit »
  (`--fru`) pour l'onglet actif et l'avatar (jamais en texte).
- **Familles d'aliments** (Courses, étiquettes) : une teinte + une teinte claire `-t` par
  famille (`--fru`, `--leg`, `--via`, …).
- **Couleur par plat** : palette de 9 couleurs dédiées aux plats (voir §5.4 et annexe A.2).
- **Formes** : bordure `2px solid var(--encre)`, ombre franche décalée (`5px 6px 0 var(--encre)`)
  pour les cartes « posées », rayon organique `--r-orga`, contours en pointillés pour « à faire
  le jour même » / « désactivé ».
- Les échelles `--fs-*`, `--lh-*`, `--sp-*` **restent** (exigées par `tests/css-tokens.test.ts`) ;
  seules les valeurs changent si la maquette l'impose (`--fs-body` = 17 px).

### 3.2 Typographie

- Titres : **Bricolage Grotesque** (700 et 800), auto-hébergée en woff2 dans
  `src/assets/fonts/`, `font-display: swap`, licence OFL (fichier de licence à côté). Précachée
  automatiquement par le glob `woff2` de `vite.config.ts:31-32` — rien à changer dans le SW.
- Corps : **Poppins** (déjà auto-hébergée, inchangée).

### 3.3 Décor et mouvement

- Illustrations SVG inline (boîte « Lundi », frigo, congélateur, marmite, vignettes
  d'explication) dans un module `src/components/illustrations/`, pas d'image raster.
- Étiquettes kraft (créneaux, statuts) et ardoise (carte « Ce midi »).
- **Confettis** à la fin du rituel et quand toutes les courses sont cochées — CSS/SVG maison,
  aucune dépendance, désactivés sous `prefers-reduced-motion: reduce`.
- Transitions 150–240 ms, uniquement `transform`/`opacity`.
- Toujours **pas de dark mode**, pas de framework CSS, icônes via `Icon.tsx` (ajouter
  l'icône calendrier pour l'onglet Semaine).

### 3.4 Méta PWA

`index.html:6` (`theme-color`) et `vite.config.ts:45-46` (`theme_color`, `background_color`) :
passer de `#f0f2eb` à `#fbf1dc`.

### 3.5 Documentation de design à mettre à jour (même PR que le thème)

- `AGENTS.md` l.7, 9, 10, 12, 77 : thème « Marché coloré », 4 onglets, règle des tokens.
- `ai/context/design-system.md` : l.7, 9, 20-26 (tableau des tokens), 31, 48, 84-123
  (composants), 139 (ratios de contraste à remesurer).
- `ai/context/ui-guideline.md` : l.14-15, 30, 42-45, 74, 80.
- `ai/agent/design-agent/rules.prompt.md` : l.3, 9, 11, 33.
- `CLAUDE.md` : mention « tokens Herbes » → « tokens Marché coloré ».

## 4. Navigation et écrans

### 4.1 Coque

- `src/components/shell/onglets.ts` : `type Onglet = 'aujourdhui' | 'semaine' | 'courses' |
  'rituel'` ; libellés « Aujourd'hui », « Semaine », « Courses », « Rituel » ; icônes
  home / calendrier / cart / pot.
- `BarreOnglets` : plus de filtre `suivi` ; onglet actif = étiquette jaune encadrée.
- `EnTete` : titre de l'écran (h1) + sous-titre (date) + avatar rond centré (initiale), qui
  ouvre **Moi**. L'aria-label devient « Moi : {prénom} ».
- **La ligne semaine ‹ Sem. N · Menu X › disparaît de la coque.** La navigation entre semaines
  vit dans l'onglet Semaine uniquement (en-tête « Menus · semaine 2 sur 4 » + flèches).
- Valeur d'onglet inconnue (ancienne valeur `'menu'`/`'suivi'` si un état devait être relu) →
  `'aujourdhui'`. L'onglet n'est pas persisté aujourd'hui : rien à migrer.

### 4.2 Aujourd'hui

Ordre fixe, une seule action pleine :
1. **Carte ardoise « Ce midi » / « Ce soir »** (selon l'heure) : le repas qui vient, où il est
   (« Ta box de lundi, au frigo »), illustration, bouton plein « J'ai pris ma box » /
   « C'est mangé » (même coche qu'aujourd'hui).
2. « Au menu aujourd'hui » : les repas du jour en cartes à liseré couleur du plat, étiquette
   kraft de provenance (« Box, au frigo », « À cuisiner, 20 min »). Toucher une carte ouvre la
   fiche recette.
3. Si le Rituel est aujourd'hui : carte « C'est dimanche : ton Rituel t'attend » → onglet Rituel.
4. Si `estSuivi(profile)` : carte « Suivi » (dernière pesée + « Ajouter ») — reprend
   `SuiviHero`/`Pesees` en version carte.
5. « Pas ce soir : reporter » reste disponible sur les repas du soir (logique `reports.ts`
   inchangée).

### 4.3 Semaine (ex-Menu)

- En-tête « Menus · semaine N sur 4 », flèches semaine précédente / suivante.
- Sélecteur de jours L M M J V S D (tablist « Jours »), puis midi/soir du jour choisi en cartes
  couleur du plat.
- Bouton secondaire « Ma semaine type » (écran poussé, cf. §6) et, en semaine 4 ou sans menus,
  bouton plein « Prépare tes prochains menus » (assistant, cf. §7).

### 4.4 Courses

- Liste groupée par **rayon** (existant), chaque rayon coloré par sa famille de la maquette :
  `legumes` → `--leg`, `fruits` → `--fru`, `laitiers` et `surgeles` → `--fra`,
  `proteines` → `--via`, `feculents`, `epicerie` et `keto` → `--epi` (libellé du rayon toujours
  écrit : la couleur n'est jamais seule). Cases ≥ 48 px. Section « Au placard » inchangée.
- « Mode magasin » conservé.
- Quand tout est coché : confettis + bouton plein « J'ai payé » (saisie du montant, logique
  `budget.ts`/`sportapp:depenses` inchangée). Avant : pas de bouton plein.

### 4.5 Rituel

Voir §5.

### 4.6 Moi (ex-Profil)

Écran poussé depuis l'avatar. Carte d'identité (avatar, prénom, « Foyer de … »), puis liste :
Mes infos · Objectif (si suivi) · Suivi poids (si suivi) · Ma semaine type · Mes menus
(ex-Mon cycle) · Foyer et partage · version de l'app. Les sous-écrans existants (`profil/*`)
sont réutilisés, restylés.

### 4.7 Onboarding

Pas de changement de parcours dans ce chantier : uniquement le restyle (thème) et le
vocabulaire (« menus »). L'étape 5 « Ta semaine » garde son rôle.

## 5. Rituel repensé

### 5.1 Écran Rituel (onglet)

1. **Première visite** : feuille « Le Rituel, c'est quoi ? » en 3 vignettes illustrées
   (1. Le dimanche, tu cuisines 1 h 40 · 2. Tu ranges en boîtes · 3. La semaine, tu réchauffes),
   bouton « Compris ». Vue une fois par appareil (clé §8), relisible via un lien « C'est quoi ? ».
2. **« Ce dimanche, tu prépares »** : « {n} plats en {durée} environ, pour {m} repas de la
   semaine. »
3. **Grille de la semaine** : 7 colonnes (L→D) × 2 lignes (Midi = `dejeuner`, Soir = `diner`). Chaque case :
   - **pleine**, couleur du plat → repas préparé dimanche ;
   - **pointillés**, couleur du plat → repas fait le jour même ;
   - vide → pas de repas prévu (exception, restaurant…).
   Légende en dessous (forme + texte, jamais la couleur seule). Chaque case a un libellé
   accessible (« Lundi midi : salade de lentilles, préparée dimanche »).
4. **« À cuisiner dimanche »** : une carte par plat (pastille couleur, nom, « Pour lundi soir +
   2 portions au congélateur »). Toucher → fiche recette.
5. Pied fixe : bouton plein **« Commencer »** → mode guidé (« Reprendre, étape 4 » si commencé).
6. Les autres jours : l'écran Rituel affiche d'abord **« Au frigo cette semaine »** (ce qui
   reste, où, à manger avant quand), puis l'aperçu du prochain dimanche.

Les vues `jour` / `semaine` / `reserve` actuelles (`Rituel.tsx:12`) sont remplacées par
cette page unique.

### 5.2 Mode guidé

- En-tête : « ‹ Retour » + « Étape i sur n » + barre de progression segmentée.
- **Barre des minuteurs en cours**, collée en haut du contenu défilant (sticky, jamais
  superposée au titre) : une puce par minuteur (pastille couleur du plat, nom, temps restant
  en chiffres tabulaires). Quand un minuteur sonne : puce « prêt ! » + alerte
  `role="alert"` « Poulet : c'est prêt ! » avec bouton « OK ».
- Corps de l'étape :
  - étiquettes des **plats concernés** (couleur du plat) — toucher ouvre une feuille avec les
    ingrédients du plat (recette intégrée au mode guidé, pas de sortie vers la fiche) ;
  - titre de l'action (« Pendant ce temps, sur le feu : lentilles et quinoa ») ;
  - **gestes à cocher** (sous-étapes) ;
  - un bouton par **minuteur** de l'étape (« Lentilles · 18 min ») → le lance ; une fois lancé,
    affiche le temps restant.
- Pied : « ‹ Précédente » (lien) + bouton plein « Étape suivante » (une ligne).
- Les minuteurs **continuent** quand on change d'étape, de l'écran ou que l'app passe en
  arrière-plan (calcul sur l'heure de fin, pas sur un décompte). Wake Lock conservé.
- À l'échéance : `navigator.vibrate?.([300, 150, 300])` (comportement actuel de
  `Minuteur.tsx`), pas de son.

### 5.3 Étape finale « On range »

- Dernière étape, ajoutée automatiquement par l'app (l'IA ne la décrit pas).
- 3 zones illustrées : **Frigo**, **Congélateur**, **Box** (une par jour de travail).
- Une ligne par boîte : case à cocher, pot couleur du plat, « Curry, 2 portions — lundi soir.
  À manger avant mardi. » / congélateur : « Sortir la veille au soir ».
- Bouton plein « Encore {k} à ranger » désactivé (contour pointillé) tant que tout n'est pas
  coché, puis « Tout est rangé » → **écran de fin** : « Ta semaine est prête ! », confettis,
  récapitulatif (« 10 repas prêts », nombre réel calculé), bouton « Voir ce qu'il y a au frigo ».

### 5.4 Données dérivées (logique pure dans `src/lib/cycle/`)

- **`couleurPlat(recetteId, rituel)`** : les plats cuisinés au rituel reçoivent les couleurs de
  la palette (annexe A.2) dans leur ordre d'apparition (garantit des couleurs distinctes ≤ 9 plats) ; les
  autres recettes, une couleur par hachage stable de l'id. Même couleur partout (Aujourd'hui,
  Semaine, Rituel, rangement).
- **`grilleDimanche(cycle, semaine)`** : pour chaque jour × moment, `{ repas, recetteId,
  prepareDimanche: boolean }`. `prepareDimanche` = le repas a une `boite` dont `produitePar`
  désigne une étape du rituel ou une recette cuisinée pendant le rituel (une étape avec
  `recette` ou `plats` qui la contient).
- **`platsDuDimanche(cycle, semaine)`** : recettes cuisinées dimanche + repas qu'elles couvrent
  (« pour lundi soir + 2 portions au congélateur »).
- **`rangement(cycle, semaine, dimanche: Date)`** : liste `{ id, zone: 'frigo' | 'congel' |
  'box', recetteId, portions, pour: Repas[], aMangerAvant: Date }` :
  - repas du **midi** avec `boite` → zone **box** (une ligne par jour) ;
  - repas du **soir** avec `boite` → **frigo** ;
  - si `jour − dimanche > frigoJours` (de la `boite`, sinon `recette.conservation.frigoJours`)
    et `recette.conservation.congelable` → **congel** (« Sortir la veille ») ;
  - `aMangerAvant` = dimanche + `frigoJours` ;
  - les entrées `reserve` du menu sont ajoutées en congélateur.
  Un plat non congelable qui dépasse `frigoJours` → reste en frigo + alerte de validation
  (§5.5), jamais de crash.
- **`etapesGuidees(rituel)`** : normalise chaque `EtapeRituel` en `{ id, titre, plats[],
  gestes[], minuteurs[] }` avec les replis du §5.5, puis ajoute l'étape « On range ».
- **`auFrigo(cycle, semaine, maintenant)`** : ce qui reste (boîtes rangées non mangées), trié
  par date limite — utilisé par Rituel en semaine et par la carte « Ce midi ».

### 5.5 Contrat menus (cycle v2) — évolution **rétrocompatible**

Pas de nouvelle version : on reste en `version: 2`. Ajouts **optionnels** dans `EtapeRituel`
(`src/lib/cycle/types.ts:104-113`, dans le bloc `// <schema>`) :

```ts
/** Ids des recettes que cette étape fait avancer (couleurs et ingrédients du mode guidé). */
plats?: string[]
/** Minuteurs lancés à cette étape ; ils tournent en parallèle des étapes suivantes. */
minuteurs?: { nom: string; minutes: number; recette?: string }[]
```

- `minuteurMin` et `enParallele` restent acceptés (anciens fichiers, menus déjà importés sur
  les téléphones). Replis : `plats` absent → `[recette]` si présent, sinon `[]` ;
  `minuteurs` absent → `minuteurMin ? [{ nom: label, minutes: minuteurMin, recette }] : []` ;
  `enParallele` → ajouté comme dernier geste.
- `schema.ts` `RITUEL` : `plats: option(liste(texte))`, `minuteurs: option(liste(objet({ nom:
  texte, minutes: nombre, recette: option(texte) })))`.
- `valider.ts` `regles` : chaque id de `plats` et chaque `minuteurs[].recette` doit exister
  (erreur bloquante, même message que pour `etape.recette`). `alertes` : plat non congelable
  servi au-delà de sa conservation frigo (alerte, pas d'erreur).
- `prompt-cycle-template.md` règle 8 réécrite : 6 à 9 étapes **dans l'ordre d'une vraie
  cuisine** (four et cuissons longues d'abord, puis feu en parallèle, puis planche pendant que
  ça cuit), chaque étape déclare `plats` et ses `minuteurs` ; ne pas décrire le rangement
  (l'app le calcule). Vocabulaire : le prompt peut garder « cycle » (texte pour l'IA, pas l'UI),
  mais les textes destinés à l'utilisateur dans le JSON (`titre`, `termine`) doivent parler de
  « menus ».
- `cycle-exemple.json` : rituel réécrit avec `plats` + `minuteurs` sur toutes les étapes
  (au moins une étape avec 2 minuteurs).
- Contrôle de cohérence obligatoire (AGENTS.md) : types ↔ schema ↔ valider ↔ template ↔ exemple.

## 6. Semaine type — option B

- Écran « Ma semaine type » (`SemaineType.tsx`) : chaque créneau modifié depuis le lancement
  des menus en cours porte un **badge kraft « dès les prochains menus »**.
- En haut : **bandeau** « {k} changement(s) pour tes prochains menus » + lien
  « Prépare tes prochains menus » (assistant §7).
- Le même bandeau (sans détail) apparaît dans l'onglet Semaine quand k > 0.
- **Référence pour le diff** : instantané de `foyer.semaine` pris au lancement des menus, rangé
  dans un **champ optionnel `semaineAuLancement?: Record<Jour, JourType>` de l'enveloppe
  `CycleActif`** (`etat.ts`, `{id, numero, debut, pauses, cycle, relanceDe?}`), renseigné par
  `demarrer` (`monCycle.ts:12`, nouveau paramètre optionnel). **Aucune nouvelle clé
  localStorage, aucun changement de sync** : `CycleActif` est déjà poussé/tiré via la table
  `etat` (clé `cycle`). Décidé après la tâche 0 (une clé à part aurait exigé des branches dans
  `appliquerEtat` et `pousserTout` d'`engine.ts`). Test obligatoire : `estCycleActifValide`
  accepte une enveloppe avec et sans ce champ, et un champ corrompu est ignoré (pas de crash).
  Absent (menus lancés avant cette version) → pas de badge, pas de bandeau.
- **Correctif `jourCourses`** : changer le jour des courses dans les réglages du foyer alors
  que des menus sont en cours recale le début via `changerDebut(a, f, debut)` (`monCycle.ts:28`,
  qui renvoie `{actif, foyer}` — aujourd'hui il n'est appelé que dans le sens « début → jour ») ; message de confirmation
  « Tes menus démarreront désormais le {jour} ».

## 7. Assistant « Prépare tes prochains menus » (ex-Mon cycle)

3 étapes, une action pleine par étape :
1. **« Ta semaine type »** : résumé + « Modifier » (→ écran §6) + bouton « C'est bon ».
2. **« Demande tes menus à une IA »** : bouton « Copier la demande » (prompt de `promptIa.ts`),
   explication courte (« Colle-la dans ChatGPT, Claude ou Le Chat »).
3. **« Ajoute la réponse de l'IA »** : import des fichiers (logique `importerCycle` inchangée),
   erreurs et alertes en langage simple, bouton « Lancer mes menus » (choix de la date de
   début conservé).
`MonCycle.tsx` est découpé : la logique reste, l'UI devient l'assistant. Textes sans « cycle ».

## 8. Stockage

Clés existantes : **aucune renommée, aucune supprimée** (AGENTS.md §Storage).
Nouvelles clés (ajouts, toutes **locales à l'appareil**, non synchronisées — la sync passe par
une liste blanche de tables, `outbox.ts:18`, et n'empile que ce qu'on lui donne) :

| Clé | Contenu | Écrite par | Sync |
|---|---|---|---|
| `sportapp:rituel:explique` | `true` quand les 3 vignettes ont été vues | `storage.ts` | non (par appareil) |
| `sportapp:rituel:minuteurs` | `{ id, nom, recette?, fin: number }[]` | `storage.ts` | non (par appareil) |

Coches (dans les coches de semaine existantes `sportapp:checks:cycle:{id}:{n}`, donc
synchronisées) : `geste:{L}:{etapeId}:{i}` (gestes du mode guidé, aujourd'hui en `useState`
non persisté) et `range:{L}:{idRangement}` (rangement). `rituel:{L}:{etapeId}` est conservé tel
quel (étape faite). Ids stables, dérivés d'ids du JSON — jamais d'index de tableau d'étapes.
Lectures via `safeParse` ; une valeur corrompue = valeur par défaut.

## 9. Accessibilité et responsive (critères d'acceptation transverses)

- 0 scroll horizontal à 320 et 375 px sur chaque écran (testé en e2e).
- Cibles ≥ 48 px ; contraste ≥ 4,5:1 sur les deux fonds (`--papier`, cartes).
- Couleur jamais seule porteuse d'information (grille : plein/pointillés + légende + libellés).
- Minuteurs annoncés (`role="alert"` à l'échéance, `aria-live="polite"` interdit sur le
  décompte seconde par seconde).
- `prefers-reduced-motion` : pas de confettis, pas de secousse.
- **Aucun « cycle » visible** : test e2e qui parcourt les 4 onglets, Moi, l'assistant et le
  mode guidé et vérifie `!/cycle/i` sur `document.body.innerText`.
- Une seule action pleine (`.bouton-plein`) visible par écran (test e2e).

## 10. Hors périmètre

- Recalcul automatique des menus en cours depuis la semaine type (refusé : option B).
- Dark mode, notifications push, changement du serveur de sync au-delà de la tâche 0.
- Refonte du parcours d'onboarding (restyle seulement).
- Génération des menus par l'app (toujours une IA externe).

---

# Partie II — Plan

## Principes d'exécution

- **4 PR**, livrées l'une après l'autre en prod (une PR fusionnée = prod en ~2 min). Chaque PR
  laisse l'app cohérente et utilisable.
- Pour chaque PR : `git fetch origin` → branche depuis `origin/main` → tâches en **TDD** (test
  rouge → code → vert) → gate `npm test && npm run typecheck && npm run lint && npm run build`
  avant chaque commit → `npm run e2e` puis `npm run e2e:preview` avant la PR →
  `git merge origin/main` (jamais de rebase ni de force-push) → PR.
- **Release** : release-please (`pipeline.yml`). **Jamais** de bump de `package.json`, d'entrée
  CHANGELOG ni de tag à la main : le type du commit conventionnel fait le semver (`feat` →
  mineur, `fix` → correctif ; `docs/test/chore/refactor` seuls ne publient rien).
- Les maquettes et ce document sont déjà dans `main` (PR #68, #69).
- Commits courts en français, préfixes `feat/fix/test/docs/chore`.

## Tâche 0 — Vérifications préalables (FAITE le 2026-10-12)

Résultats, intégrés dans la spec ci-dessus :

1. **Sync** : liste blanche de tables (`outbox.ts:18` : checks, weights, depenses, profiles,
   etat ; serveur `routes.ts:28-34`). Rien n'est synchronisé automatiquement : chaque écriture
   appelle `empilerMutation`. Les coches `sportapp:checks:cycle:{id}:{n}` **sont** synchronisées
   (table `checks`, seules les semaines `cycle:*` sont tirées) → les coches `geste:` et `range:`
   du §8 se synchronisent sans rien ajouter. L'instantané de semaine type va dans `CycleActif`
   (§6), donc aucun changement de sync.
2. **Forme** : `sportapp:cycle` = `CycleActif {id, numero, debut:'AAAA-MM-JJ', pauses, cycle,
   relanceDe?}`. `MenuSemaine = {lettre, titre, jours: JourMenu[], rappelsRituel?, microBatch,
   reserve}`, `JourMenu = {jour, repas: Repas[]}`, `Repas.moment = 'dejeuner' | 'diner' |
   'collation'`. Dans toute la spec, **« midi » = `dejeuner`, « soir » = `diner`** ; les
   collations n'entrent pas dans la grille ni dans le rangement. `foyer.semaine` =
   `Record<Jour, JourType>`. Il n'existe pas de fonction `enregistrerAvecDebut` : le lancement
   passe par `demarrer` (`monCycle.ts:12`) puis `saveCycle` côté UI (`MonCycle.tsx`).
3. **Courses** : déjà groupées par `rayon` (champ du JSON, 8 valeurs, `RAYONS` types.ts:12-21,
   libellés courses.ts:9-18). Pas de nouvelle classification : on **associe chaque rayon à une
   famille de couleur** de la maquette (§4.4).
4. **Minuteur** : `Minuteur.tsx` vibre (`navigator.vibrate([300,150,300])`), **aucun son**. On
   garde la vibration seule (pas de son ajouté).
5. **Police** : à télécharger en PR 1 (Bricolage Grotesque, OFL, woff2, graisses 700 et 800 —
   la 500 de la maquette n'est pas utilisée pour du texte courant, ne pas l'embarquer).

## PR 1 — Thème « Marché coloré » sur les écrans actuels

Branche `feat/theme-marche`. Aucun changement de navigation ni de logique.

1. **Polices** : ajouter `bricolage-grotesque-{700,800}.woff2` + `OFL.txt` dans
   `src/assets/fonts/`, `@font-face` dans `src/index.css` (à côté de Poppins, l.9-39).
   Test : `tests/css-tokens.test.ts` reste vert ; ajouter un test qui vérifie que chaque
   `url(./assets/fonts/…)` du CSS existe sur disque.
2. **Tokens** : remplacer les valeurs `:root` Herbes par celles de la maquette (§3.1) ;
   garder les **noms** de tokens utilisés par les composants quand c'est possible (`--bg`,
   `--surface`, `--text`, `--muted`, `--accent`…) en les faisant pointer vers les nouvelles
   valeurs, et ajouter les nouveaux (`--encre`, `--papier`, `--fru`, palette plats, `--r-orga`).
   Test (nouveau, `tests/contraste.test.ts`) : calcule le ratio WCAG des paires texte/fond
   déclarées (`--text`/`--muted`/texte du bouton plein sur `--papier` et sur `--surface`) en
   lisant `:root` → ≥ 4,5.
3. **Composants de base** dans `index.css` : boutons (plein, secondaire, lien), cartes
   (bordure encre + ombre franche), étiquettes kraft, barre d'onglets, en-tête, avatar
   (initiale centrée : `display: inline-grid; place-items: center; line-height: 1`), champs.
4. **Méta PWA** : `index.html:6`, `vite.config.ts:45-46` → `#fbf1dc`. Vérifier que `dist/`
   contient `sw.js` + `manifest.webmanifest` après build.
5. **Docs de design** (§3.5).
6. Vérification : `npm run e2e` (débordements 320/375), captures avant/après des 5 onglets
   jointes à la PR.

Commit type : `feat: thème Marché coloré (polices, tokens, composants de base)`.

## PR 2 — Navigation 4 onglets, Aujourd'hui, Semaine, Moi, vocabulaire « menus »

Branche `feat/navigation-4-onglets`.

1. **Tests d'abord** (rouges) :
   - `tests/app.test.tsx` : la navigation principale contient exactement « Aujourd'hui »,
     « Semaine », « Courses », « Rituel » ; aria-current ; avatar « Moi : Marc » ouvre Moi ;
     plus de ligne semaine dans la coque ; carte Suivi présente dans Aujourd'hui si
     `estSuivi`, absente sinon.
   - `tests/e2e/shell.spec.ts` : constante `ONGLETS` à 4 entrées (l.6), l.240, 320/375 sans
     débordement, test « aucun cycle visible » (§9) sur les écrans livrés par cette PR.
   - Mettre à jour les sélecteurs cassés par les renommages (≈ 50 assertions : « Menu » →
     « Semaine », « Mon profil » → « Moi », « Suivi » onglet → carte, « Mon cycle » → « Mes
     menus ») dans `app.test.tsx`, `profil-screen.test.tsx`, `sync/ui.test.tsx`,
     `onboarding.test.tsx`, `tests/e2e/onboarding-mobile.spec.ts`, `suivi-objectif.spec.ts`.
2. `shell/onglets.ts`, `BarreOnglets.tsx` (sans filtre suivi), `EnTete.tsx` (avatar Moi),
   suppression de `LigneSemaine` de la coque (`App.tsx:32,277`) ; garde `App.tsx:226` retirée.
3. **Aujourd'hui** (`Aujourdhui.tsx`, `menu/RepasDuJour.tsx`, `menu/CarteRepas.tsx`) : carte
   ardoise « Ce midi / Ce soir », liste du jour, carte Rituel le dimanche, carte Suivi.
   Tests composants dans `tests/ecrans.test.tsx` (heure fixée avec `vi.setSystemTime`).
4. **Semaine** : `Menu.tsx` renommé en `Semaine.tsx` (export nommé `Semaine`), navigation de
   semaine intégrée (reprend `LigneSemaine`), sélecteur de jours, liens « Ma semaine type » et
   « Prépare tes prochains menus ».
5. **Couleur par plat** : `src/lib/cycle/couleurs.ts` `couleurPlat` (§5.4) — test unitaire
   d'abord (`tests/lib/cycle/couleurs.test.ts` : distinctes pour ≤ 9 plats du rituel, stable
   pour un même id, défaut pour id inconnu). Utilisée par les cartes repas.
6. **Moi** : `ProfilScreen.tsx` restylé et renommé à l'affichage « Moi », liste §4.6, sections
   Suivi poids et Objectif si `estSuivi`.
7. **Vocabulaire** : remplacer tous les textes visibles contenant « cycle » (grep
   `-i "cycle"` dans les chaînes JSX de `src/components/`) — sans toucher aux identifiants.
8. Gate + `e2e` + `e2e:preview`, captures à la PR.

Commit type : `feat: navigation à 4 onglets, écran Semaine et Moi, vocabulaire menus`.

## PR 3 — Rituel repensé

Branche `feat/rituel-parallele`. La plus lourde : découper en commits par sous-tâche.

1. **Contrat (tests d'abord)** :
   - `tests/lib/cycle/valider.test.ts` : fichier avec `plats`/`minuteurs` valide ; id inconnu
     dans `plats` ou `minuteurs[].recette` → erreur bloquante ; ancien fichier (seulement
     `minuteurMin`/`enParallele`) toujours valide ; `minuteurs[].minutes` négatif → erreur.
   - `tests/lib/promptIa.test.ts` : le schéma extrait contient `plats?` et `minuteurs?`.
   - Puis `types.ts` (bloc `<schema>`), `schema.ts` `RITUEL`, `valider.ts` `regles`/`alertes`,
     `prompt-cycle-template.md` règle 8, `cycle-exemple.json` (rituel réécrit). Test existant
     qui valide `cycle-exemple.json` doit rester vert.
2. **Logique dérivée** (`src/lib/cycle/rituel.ts`, sans React), un test par fonction avec la
   fabrique `tests/lib/cycle/fabrique.ts` :
   - `etapesGuidees` : replis anciens champs, étape « On range » ajoutée en dernier ;
   - `grilleDimanche` : plein/pointillés/vide, 14 cases ;
   - `platsDuDimanche` : libellés « pour lundi soir + 2 portions au congélateur » ;
   - `rangement` : zones box/frigo/congel, `aMangerAvant`, plat non congelable au-delà de la
     conservation reste en frigo, `reserve` en congélateur, ids stables ;
   - `auFrigo` : tri par date limite, exclut les repas cochés mangés ;
   - `idCocheGeste`, `idCocheRange` : format §8.
3. **Stockage** (`storage.ts`) : `loadExplique/saveExplique`, `loadMinuteurs/saveMinuteurs`
   (via `safeParse`, valeur corrompue → `[]`). Tests dans `tests/storage.test.ts`.
4. **Minuteurs** : `src/lib/minuteurs.ts` (pur : `lancer`, `restant(m, maintenant)`,
   `sonnes(liste, maintenant)`) + hook `src/components/useMinuteurs.ts` (tic 1 s, persiste dans
   `sportapp:rituel:minuteurs`, vibration/son à l'échéance, pattern render-phase si resync par
   prop). Les minuteurs vivent au niveau d'`App.tsx` pour survivre aux changements d'écran.
   Tests avec `vi.useFakeTimers` + `vi.setSystemTime`.
5. **Écran Rituel** (`ecrans/Rituel.tsx` réécrit) : feuille d'explication 3 vignettes (1re
   visite), résumé, grille, liste des plats, pied « Commencer / Reprendre » ; en semaine,
   « Au frigo cette semaine ». Tests `ecrans.test.tsx` : vignettes une seule fois ; libellés
   accessibles de la grille ; « Reprendre, étape 4 » si des étapes sont cochées.
6. **Mode guidé** (`ecrans/Guide.tsx` réécrit) : barre de minuteurs sticky, étiquettes de
   plats + feuille ingrédients, gestes cochés persistés, boutons minuteur, « On range » avec
   bouton désactivé tant que tout n'est pas coché, écran de fin + confettis
   (`src/components/Confettis.tsx`, rien sous reduced-motion). Tests : cocher un geste persiste
   (`sportapp:checks:cycle:…`), lancer 2 minuteurs puis changer d'étape → toujours visibles,
   échéance → `role="alert"`, rangement complet → « Tout est rangé » actif.
7. **Illustrations** : `src/components/illustrations/`, un composant React par illustration de
   l'annexe A.4, tracés copiés depuis la maquette (couleurs via props / tokens, pas de hex en dur
   sauf les aplats décrits en A.4).
8. e2e : `tests/e2e/rituel.spec.ts` (parcours complet dimanche à 320 et 375 : explication →
   Commencer → 2 minuteurs → On range → fin), pas de débordement, aucun « cycle ».
9. Gate + `e2e` + `e2e:preview`.

Commits types : `feat(cycle): étapes de rituel avec plats et minuteurs multiples`,
`feat: rituel guidé en parallèle et rangement`.

## PR 4 — Courses, semaine type (option B), assistant des prochains menus

Branche `feat/menus-assistant`.

1. **Courses** : `couleurRayon(rayon)` dans `src/lib/cycle/courses.ts` (test : les 8 rayons ont
   une famille), couleurs de famille sur les groupes existants, bouton plein
   « J'ai payé » visible seulement quand tout est coché, confettis. Tests `ecrans.test.tsx`.
2. **Instantané au lancement** : paramètre optionnel `semaine` de `demarrer` →
   `CycleActif.semaineAuLancement` ; l'UI de lancement passe `foyer.semaine`. Tests
   `monCycle.test.ts` (l'instantané est posé par `demarrer` ; `relancer` reçoit aussi la
   semaine courante et pose un instantané neuf) et `etat.test.ts` (`estCycleActifValide` avec/sans le
   champ ; champ corrompu → ignoré).
3. **Diff semaine type** : `src/lib/cycle/semaineType.ts` `changementsEnAttente(foyer,
   instantane)` → liste des créneaux modifiés (vide si instantané absent). Test unitaire.
4. **`SemaineType.tsx`** : badges « dès les prochains menus », bandeau « {k} changement(s) »,
   lien vers l'assistant. Bandeau aussi dans Semaine. Tests composants (étendre
   `ecrans.test.tsx:370-376`).
5. **Correctif `jourCourses`** : test rouge d'abord (`monCycle.test.ts` : changer le jour des
   courses avec des menus en cours recale `debut`), puis appel de `changerDebut` depuis
   l'enregistrement du foyer (`App.tsx:134-137` `enregistrerFoyer` ou `etat.ts`), message de
   confirmation. Commit `fix:` séparé.
6. **Assistant** : `MonCycle.tsx` → `ecrans/ProchainsMenus.tsx` (3 étapes §7), logique
   d'import inchangée. Tests : copier la demande (clipboard mocké), import d'un fichier valide
   → « Lancer mes menus », import invalide → erreur lisible, aucun « cycle » dans le texte.
   E2E : parcours assistant avec `cycle-exemple.json`.
7. Test e2e « aucun cycle visible » étendu à tous les écrans ; test « un seul bouton plein par
   écran ».
8. Gate + `e2e` + `e2e:preview`.

Commits types : `feat: courses par famille`, `feat: semaine type appliquée aux prochains
menus`, `fix: le jour des courses recale le début des menus`, `feat: assistant des prochains
menus`.

## Risques et parades

| Risque | Parade |
|---|---|
| Casser les menus déjà importés (téléphones de Marc & Mélanie) | Contrat strictement additif, replis testés sur l'ancien format, `cycle-exemple.json` ancien conservé en fixture de test. |
| ≈ 50 assertions de tests cassées par les renommages | Concentrées dans la PR 2, mises à jour en premier (rouge), une passe dédiée. |
| Minuteurs faux après mise en veille | Heure de fin persistée, jamais un décompte ; test avec horloge simulée. |
| Poids des polices | 2 graisses seulement, woff2, mesure dans la PR 1. |
| Écart maquette ↔ implémentation | Captures 320/375 de chaque écran jointes aux PR, comparées à la maquette. |
| Un écran non maquetté apparaît en cours de route | Maquette d'abord, validation de Marc, puis code. |

## Définition de « terminé »

- Les 4 PR fusionnées, CI verte (lint, typecheck, test, build, serveur, e2e preview, image
  Docker), prod vérifiée (`/sante`, version affichée dans Moi).
- Tous les critères du §9 couverts par des tests.
- AGENTS.md, CLAUDE.md et `ai/` décrivent « Marché coloré », 4 onglets et le vocabulaire
  « menus ».
- Mesure manuelle sur iPhone : un dimanche réel de bout en bout (explication → rangement).

---

# Annexe A — Valeurs exactes de la maquette (font foi)

Source : `docs/superpowers/mockups/2026-10-12-refonte-ergo-marche.html` (bloc `:root` l.13-39,
`PLATS` l.349-359, illustrations l.420-430). La maquette est autonome (couleurs et SVG inline) ;
seules les polices y viennent de Google Fonts — l'app, elle, les **auto-héberge** (§3.2).

## A.1 Tokens `:root`

| Token | Valeur | Usage |
|---|---|---|
| `--papier` | `#fbf1dc` | fond de l'app (papier d'emballage crème) |
| `--papier-2` | `#f4e3bf` | barre d'onglets, pieds fixes, zones creuses |
| `--kraft` / `--kraft-fonce` | `#e2c08d` / `#c99f62` | étiquettes (créneaux, statuts), cadre de l'ardoise |
| `--encre` | `#2a2219` | tout le texte, traits, bordures, ombres |
| `--encre-2` | `#5e4f3c` | texte secondaire (6,9:1 sur le papier) |
| `--ardoise` / `--craie` / `--craie-jaune` | `#26332f` / `#f7f0de` / `#f2d36b` | carte « Ce midi » (tableau du marchand) |
| `--basilic` / `--basilic-clair` | `#2d6a37` / `#d4ead2` | marque, bouton plein, liens, coches faites |
| `--tomate-txt` | `#b3321f` | danger, alerte minuteur (5,5:1 sur le papier) |
| `--blanc` | `#fffaf0` | cartes, champs |
| fond hors app (`html, body`) | `#efe0bd` | autour du cadre sur grand écran |

Familles du marché (vive pour les formes, `-t` claire derrière le texte) :

| Famille | Vive | Claire |
|---|---|---|
| `--leg` Légumes | `#4e9a3a` | `#d9efcf` |
| `--fru` Fruits | `#f2c230` | `#fdf0b8` |
| `--fra` Frais | `#5aaee0` | `#d5ecf9` |
| `--via` Boucherie | `#e2553f` | `#fbd6cf` |
| `--epi` Épicerie | `#e08a1e` | `#fbe2c0` |

Typographie : `--fs-titre 30px`, `--fs-h1 26px`, `--fs-h2 22px`, `--fs-h3 19px`,
`--fs-body 17px`, `--fs-sec 16px`, `--fs-meta 14px`, `--fs-micro 13px` ; corps `line-height 1.55`.
Titres Bricolage Grotesque (500, 700, 800 ; axe `opsz` 12–96), corps Poppins (400–700).

Formes et mouvement :
- `--r-orga: 26px 20px 28px 18px` et `--r-orga-2: 18px 26px 20px 28px` (coins « faits main »).
- Bordures `2px solid var(--encre)` ; ombres franches sans flou : `5px 6px 0` (panneaux),
  `4px 5px 0` (cartes posées), `3px 4px 0` (boutons pleins), `1px 1px 0` (petites étiquettes).
- `--entree: 0.24s cubic-bezier(0.2, 0.8, 0.2, 1)` ; `--sortie: 0.16s cubic-bezier(0.4, 0, 1, 1)`.
- Désactivé : fond `--papier`, texte `--encre-2`, bordure en pointillés, pas d'ombre.

Les noms `--fs-*` de la maquette seront alignés sur l'échelle existante de `src/index.css`
(exigée par `tests/css-tokens.test.ts`) : on reprend les **valeurs**, pas forcément les noms.

## A.2 Palette des plats

Ordre d'attribution pour `couleurPlat` (couleur vive `c` pour pastilles, liserés, couvercles ;
claire `t` derrière le texte) :

| # | Vive | Claire | Exemple maquette |
|---|---|---|---|
| 1 | `#e3b505` | `#fbeeb0` | Curry |
| 2 | `#b8336a` | `#f6d3e1` | Lentilles |
| 3 | `#d63a2a` | `#f9d3cc` | Chili |
| 4 | `#ee7d1a` | `#fde0c2` | Soupe |
| 5 | `#9a6a3a` | `#ecdcc8` | Poulet |
| 6 | `#2fa58a` | `#cdeee4` | Taboulé |
| 7 | `#5a9a2c` | `#dcefc9` | Pesto |
| 8 | `#8a7a62` | `#e8e1d4` | Omelette |
| 9 | `#4f9fd6` | `#d6ebf8` | Tartines |

Le texte posé sur une couleur claire est toujours `--encre` ; jamais de texte sur la couleur vive.

## A.3 Icônes d'interface

Tracés repris de `src/components/Icon.tsx` (home, couverts, cart, pot, chevrons, check, clock,
copy, plus). **À ajouter** dans `Icon.tsx` : `calendrier` (onglet Semaine) — absent de la
maquette, à dessiner dans le même style (24×24, trait 2,2).

## A.4 Illustrations (trait d'encre `#2a2219`, aplats de couleur)

| Fonction maquette | Composant à créer | Aplats | Où |
|---|---|---|---|
| `illuBox(c, t, jour)` | `Boite` (props couleur du plat, jour) | couleur du plat + étiquette kraft | carte « Ce midi », zone Box |
| `illuBocal(c, t)` | `Bocal` | couleur du plat | lignes « On range », Au frigo |
| `illuFrigo` / `illuFrigoGrand` | `Frigo` (taille) | `#d5ecf9` | zone Frigo, vignette 3 |
| `illuCongel` | `Congelateur` | `#e3e9f6` | zone Congélateur |
| `illuSac` | `Sac` | `#e2c08d` | Courses |
| `illuCasserole` | `Casserole` | `#e2553f` | vignette 1, Rituel |
| `illuMicro` | `MicroOndes` | `#d9efcf` | vignette 3 (« tu réchauffes ») |
| `illuLegumes` | `Legumes` | familles légumes | écran de fin, états vides |

Règles : `aria-hidden` quand décoratives, `role="img"` + libellé quand porteuses de sens
(la boîte « Lundi ») ; les 2 aplats `#d5ecf9` et `#e3e9f6` deviennent des tokens
(`--fra-t` existe déjà pour le premier, ajouter `--givre: #e3e9f6`).
