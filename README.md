# Rituel

Suivi cuisine / diet / sport pour Marc & Mélanie — PWA installable, livrée avec une semaine d'exemple prête à cocher.

## Utilisation sur téléphone

1. Ouvrir l'URL de l'app dans le navigateur.
2. L'installer comme application :
   - **iOS** : Safari → bouton **Partager** → **Sur l'écran d'accueil**
   - **Android** : Chrome → **Installer**
3. L'app fonctionne **hors ligne** après la première visite (le service worker est installé à ce moment-là).

> **Note** : l'import de fichier `.md` est momentanément retiré de l'app (il reviendra avec une future convention « template »). La semaine d'exemple se charge automatiquement au premier lancement. Le format décrit ci-dessous reste le contrat de référence.

## Le fichier .md de la semaine (contrat de référence)

Chaque semaine est décrite par un fichier Markdown avec frontmatter YAML **obligatoire**. Extrait du fichier d'exemple (les blocs `## Recettes`, `## Bases`, `### Keto`, `### Rituel dimanche`, `### Micro-batch` et `### Réserve` sont optionnels) :

```markdown
---
semaine: 2026-S37
menu: A
titre: Menu A — Base poulet & bolo
du: 2026-09-07
au: 2026-09-13
---

# Semaine 37

## Courses
### Protéines
- Cuisses de poulet (famille)
- Œufs ×20
### Keto
- Avocats ×3-4
- Chocolat noir ≥ 85 %

## Menu
### Lundi
- dejeuner-marc: Boîte dinde-quinoa (batch dim) + légumes → R7
- dejeuner-melanie: Restes dinde + gratin courgettes + ½ avocat → R7
- diner-famille: Cuisses poulet rôties + carottes/patates douces + riz → R1
- diner-melanie: Poulet + légumes rôtis + filet huile d'olive (sans riz/patate douce)
- batch: Double riz + légumes rôtis → boîte mardi Marc

## Recettes
### R1 · Cuisses de poulet rôties + légumes + riz
temps: 45 min · four 200°
kcal: 680
proteines: 48
glucides: 45
lipides: 28
score: 7
image: https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80&auto=format&fit=crop
- pour 4: 6-8 cuisses · 600 g carottes · 600 g patates douces · 250 g riz · huile, paprika, thym
1. Four 200°. Cuisses : huile + sel + paprika + thym, dans un plat avec les légumes en gros dés.
2. Filet d'huile sur les légumes, four 40-45 min (retourner à mi-parcours).
3. Riz en parallèle — cuire en double (boîte).
- mel: pas de riz ni patate douce : poulet + légumes rôtis + filet d'huile d'olive
- batch: double riz + légumes → boîte de mardi

## Bases
### B4 · Vinaigrette minute
3 c.à.s huile d'olive + 1 moutarde + jus d'½ citron + sel. Le pot de 3 jours se garde au frigo.

## Batch
### Rituel dimanche
- production: 2 boîtes frigo · 1 boîte congélateur · 1 sauce · 6 œufs durs — le riz : 2 jours au frigo max
- 0-5 min · Four à 180° — egg muffins ×10 lancés, on fait le reste → R7
- 5-30 min · Cuissons en double — dîner du soir ×2 + féculent ×2 → boîte lundi → R1
- termine: 4 boîtes prêtes — la semaine est servie.

### Micro-batch
- lundi: doubler le plat (boîtes mar/mer) | 10 min | 2 boîtes → R1 | la boîte de mardi passe au frigo
- mardi: doubler la sauce + courgettes en julienne (5 min le soir)

### Réserve
- lundi: Boîte dinde-quinoa | frigo, 2 j max
- mel: Box keto (œufs durs + crudités) | à monter au rituel

- [ ] Egg muffins ×10 → R7
- [ ] Doubler dinde + quinoa → boîte lundi Marc → R7

## Marc
### Cibles
- 2 450 kcal std · 2 750 sortie · 2 300 repos
### Séances
- [ ] Lundi — Muscu libre 10h30
### Rappels
- Pesée lun/mer/ven à jeun → moyenne hebdo

## Melanie
### Cibles
- 1 450-1 500 kcal · protéines 110 g
### Séances
- [ ] Lundi — Danse 21h
### Rappels
- Jeûne matin : eau · café noir · thé uniquement
```

Règles du format :

- **Frontmatter requis** : `semaine`, `menu`, `du`, `au` (le `titre` est optionnel).
- `## Courses` : une `### Rayon` par sous-section, les items sont des listes `-` ; un rayon `### Keto` est rendu en **encadré dédié** (en fin de liste).
- `## Menu` : une `### Jour` par jour, chaque repas est une ligne `- clé: texte` avec exactement **5 clés valides** : `dejeuner-marc`, `dejeuner-melanie`, `diner-famille`, `diner-melanie`, `batch`. Une clé inconnue génère un avertissement (non bloquant). Une référence `→ R1` en fin de ligne lie le repas à une recette de `## Recettes`.
- `## Recettes` (optionnel) : une `### R1 · Nom` par recette, avec `temps:`, `kcal:`, `proteines:`, `bases: B4, B6` (renvois vers `## Bases`), les portions par personne `- portions marc:` / `- portions melanie:` (mesures maison), la liste d'ingrédients `- pour 4: …`, les étapes numérotées `1. …` et les adaptations `- mel: …` / `- batch: …`.
  - `glucides:` / `lipides:` (optionnels, g par personne — chips 🌾 C / 💧 F de la fiche)
  - `score:` (optionnel, entier 0-10 — Score n/10 en barre segmentée)
  - `image:` (optionnel, URL https — photo du plat, mise en cache PWA après 1ʳᵉ vue)
- `## Bases` (optionnel) : une `### B4 · Nom` par base + un texte court (technique réutilisable).
- `## Batch` : la checklist `- [ ]`, plus trois blocs optionnels — `### Rituel dimanche` (étapes `- <créneau> · <label> — <détail>`, cochables en timeline, plus les lignes-clés `- production:` et `- termine:` — badge de durée calculé par l'app), `### Micro-batch` (`- jour: quoi | durée | quantité → slug | détail` — la forme v1 ` | détail` reste acceptée, carrousel horizontal) et `### Réserve` (`- <jour|mel>: <plat> | <conservation>`, plats stockés, état disponible/consommé cochable). Une référence `→ slug` en fin de tâche ou d'étape (ou sur la quantité du micro-batch) lie l'étape à une recette : le mode guidé affiche alors sa fiche.
- Puis `## Marc` et `## Melanie` (accents acceptés — `Mélanie` == `Melanie`), chacune avec les sous-sections `### Cibles`, `### Séances`, `### Rappels`.
- Les items `- [ ]` (batch, rituel, séances) sont cochables dans l'app.
- **Ids de coches stables**, dérivés du contenu : `courses:…`, `batch:…`, `batch:rituel:…`, `reserve:…`, `seances:…` — renommer un item = perdre son état coché. La ref `→ slug` n'entre jamais dans l'id : l'ajouter ou la retirer conserve l'état.
- **Rétrocompatible** : une semaine v1 (sans Recettes/Bases/Rituel/Micro-batch) s'affiche comme avant — les blocs optionnels n'apparaissent que s'ils existent.

Exemple canonique complet : [`src/assets/semaine-exemple.md`](src/assets/semaine-exemple.md).

> **Entretien de la sample** : tant qu'il n'y a pas de convention template, `semaine-exemple.md` reste alignée sur la semaine courante (S37 au 08/09/2026). Pour la rafraîchir, bump en lockstep : frontmatter + `# Semaine` de la sample, `tests/parse.test.ts` (describe « sample réelle »), `tests/app.test.tsx`, `tests/profil-screen.test.tsx` et `tests/e2e/{onboarding-mobile,dock}.spec.ts` — cf. le commentaire en tête de ce describe dans `tests/parse.test.ts`.

## Générer un cycle de semaines (rotation A/B/C/D)

Le contenu vient d'une rotation de 4 menus avec batch commun. Une session de
prompt IA génère le cycle complet (4 fichiers .md, un par semaine) :

1. Dans l'app : Profil → « Copier le prompt IA » — le prompt embarque ton
   contexte (objectif, régime, compléments, courses/budget…) et le format
   complet ; le coller dans un chat IA avec les 4 documents du dossier
   `diet/` en pièces jointes, compléter les 3 champs {{...}} (semaine de
   départ, menus, événements) et envoyer
2. Sauvegarder les 4 fichiers générés dans `diet/rotations/`
3. Dans l'app : Profil → Semaine → « Importer un cycle (.md) » → sélectionner
   les 4 fichiers d'un coup

L'app garde toutes les semaines importées, ouvre sur celle qui contient
aujourd'hui (le roulement est automatique) et permet de naviguer avec les
chevrons ‹ › de la bannière. Les coches et pesées ne sont jamais perdues :
elles vivent par semaine (`sportapp:checks:{semaine}`).

Règle d'or : ne jamais modifier le libellé d'une coche d'une semaine déjà
utilisée — le slug dérive du libellé, le renommer perd l'état cochée.

## L'écran Cuisine

Trois sous-onglets partagés (Courses · Menu · Mon Rituel), en segmented control (onglet actif en lime) :

- **Bannière** : le menu courant (« Menu A ») reste visible en pill à côté du titre de semaine.
- **Menu** : une barre d'onglets par **recette** (les 7 dîners du fichier + 🍱 Déjeuners) — aucun jour affiché, l'ordre du fichier est l'ordre conseillé (batch/frigo d'abord, frais ensuite) ; l'onglet du jour courant est présélectionné. La progression lit « Dîners X/N · Boxes X/N ».
- **Onglet recette** : la fiche complète d'un bloc (temps, kcal, Score n/10, fraîcheur), « Qui mange quoi » (dîner famille + adaptation keto de Mél), « Portions — par personne » en **mesures maison** (pièces, poignées, c. à soupe, louches — les grammes entre parenthèses ne servent qu'à caler l'œil), la préparation (ingrédients « pour 4 », étapes, bases cliquables), le batch du jour en info, et la coche unique « C'est fait — dîner fini » (l'onglet se grise, nom barré + ✓).
- **Déjeuners dynamiques** : une paire de boxes devient « prête » quand la recette qui la produit (`→ R#` sur la ligne déjeuner) est cochée ; verrouillée sinon (« débloquée quand … est fait ») ; une box sans ref est toujours disponible. Une coche par paire (« Boxes faites ») coche les lignes Marc + Mél du jour.
- **Courses** : compteurs d'items par rayon, et le rayon `### Keto` devient un encadré dédié en fin de liste.
- **Mon Rituel** : le rituel du dimanche s'affiche en **timeline cochable** et se lance en **mode guidé** — chaque étape portant une ref recette déplie sa fiche (ingrédients, étapes, temps, four) ; le micro-batch en **carrousel** enrichi (durée, quantité, recette liée) ; la réserve affiche son état (disponible/consommé). Un soir sans dîner prévu déclenche l'encart « Sors la réserve » dans le Menu.

## Développement

```bash
npm install
npm run dev        # serveur de dev
npm test           # tests unitaires (vitest) — 245 verts
npm run e2e        # tests navigateur (Playwright, mobile 375/320) — 13 specs × 2 mobiles, 26 verts
npm run build      # build de production
npm run preview    # prévisualiser le build
npm run icons      # régénérer les icônes après modification de public/icon-src.svg
```

### Faire une release

La version affichée dans l'app (`Profil` → « Rituel vX.Y.Z ») vient de `package.json` — le bump est **volontaire** :

1. Renseigner le `CHANGELOG.md` (renommer la section `[Non publié]` en `[x.y.z] - AAAA-MM-JJ`), puis `npm version minor` (ou `patch` / `major`) — crée le commit de bump **et** le tag `vx.y.z` localement.
2. `git push origin main` — le déploiement Pages embarque la nouvelle version.
3. `git push origin v1.x.y` — le workflow `release.yml` crée la GitHub Release avec les notes du CHANGELOG.

## Déploiement

L'app est déployée sur **GitHub Pages** via GitHub Actions (`.github/workflows/deploy.yml`).

1. Créer un repo nommé `rituel-app` sur GitHub. Il doit être **public** : GitHub Pages gratuit n'est disponible que pour les repos publics (les repos privés nécessitent un plan payant).
2. Pousser le code :

   ```bash
   git remote add origin git@github.com:<user>/rituel-app.git
   git push -u origin main
   ```

3. Sur GitHub : **Settings → Pages → Source: GitHub Actions**.
4. Chaque push sur `main` reconstruit et déploie. URL : `https://<user>.github.io/rituel-app/`.

> Le `base` dans `vite.config.ts` vaut `/rituel-app/` — à mettre à jour si le repo est renommé.

> Septembre 2026 — l'app s'appelle désormais **Rituel** et le repo est `rituel-app` : la nouvelle URL est `https://marcsuarez74.github.io/rituel-app/`. L'ancienne URL (`…/sport-app/`) ne redirige pas — sur les téléphones où la PWA est déjà installée, il faut la **réinstaller** depuis le navigateur à la nouvelle adresse (les données localStorage sont conservées, même origine).

## Données

- **Tout est stocké en local sur le téléphone** (localStorage) — aucun serveur, aucune donnée envoyée.
- Les **pesées sont stockées par profil** : importer un nouveau fichier de semaine différent ne les remet pas à zéro.
- Les **coches** (courses, batch, séances) sont réinitialisées à chaque nouvelle semaine.

## Synchronisation entre téléphones (optionnelle)

Par défaut, tout reste sur le téléphone. Si un foyer est configuré (voir
[`docs/backend.md`](docs/backend.md)), les données (semaines, coches, pesées,
dépenses, profils) se synchronisent entre Marc et Mélanie en quasi temps-réel,
avec file d'attente hors ligne.

> Vie privée : données hébergées chez Supabase (région UE), accès limité au
> foyer par code. « Supprimer les données du foyer » (Profil) purge serveur +
> local à tout moment.

## Notifications push (optionnelles)

Une fois le foyer connecté, le bloc **Notifications** du Profil permet
d'activer, par appareil : « Dîner coché », « Pesée ajoutée », « Courses
faites » (contenu personnalisé — « C'est prêt ! Mélanie a fait la recette
"…" ») et des **rappels planifiés** (séance, pesée, rituel du dimanche —
jours et heure au choix). Configuration complète et secrets : voir
[`docs/backend.md`](docs/backend.md) §7.
