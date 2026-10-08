# Rituel

Suivi cuisine / diet / sport pour Marc & Mélanie — PWA installable : un **cycle de 4 semaines** de menus généré par Claude, un **rituel batch** unique à maîtriser, les courses calculées et le suivi du poids. Livrée avec un cycle d'exemple prêt à cocher.

## Utilisation sur téléphone

1. Ouvrir l'URL de l'app dans le navigateur.
2. L'installer comme application :
   - **iOS** : Safari → bouton **Partager** → **Sur l'écran d'accueil**
   - **Android** : Chrome → **Installer**
3. L'app fonctionne **hors ligne** après la première visite (le service worker est installé à ce moment-là).

Au premier lancement, un **onboarding en 5 étapes** (+ l'étape optionnelle « Ta semaine ») personnalise l'app : seule la première (choix du profil + prénom) est obligatoire, les suivantes se passent d'un appui sur « Passer ». Le prénom se modifie ensuite dans **Mes infos** (Profil) — salutations, titre du suivi et prompt IA l'utilisent — et la date de naissance comme la taille restent optionnelles.

## Les écrans

Barre du bas, 5 onglets sous le pouce ; le Profil s'ouvre par l'avatar (point = état de la sync).

- **Aujourd'hui** : la semaine en un coup d'œil (repas et courses faits), l'action du jour (rituel le jour du rituel, courses le jour des courses), les repas du jour cochables d'un tap.
- **Menu** : bande des 7 jours à partir du jour des courses ; pour chaque repas, ta version, celle des autres, l'exception récurrente, la boîte du rituel ; « Ce soir, j'anticipe » (micro-batch). « Pas ce soir : reporter » → demain · semaine prochaine · on ne le fera pas (toast Annuler).
- **Fiche recette** : macros et portion par membre suivi, ingrédients du foyer et étapes à cocher, minuteurs, conservation, lien au rituel, mode cuisine (écran allumé).
- **Courses** : liste calculée depuis les recettes de la semaine + articles fixes, par rayon (extras keto en dernier), carte Estimé / Payé / Max avec alerte au-dessus du plafond, mode magasin, « J'ai payé… », placard à vérifier, « déjà au frigo ? » pour les plats reportés.
- **Rituel** : le rituel du jour (production, avant de commencer, déroulé), le micro-batch de la semaine, la réserve ; **mode guidé** plein écran, une étape par écran, minuteur.
- **Suivi** : objectif et poids (courbe, pesées).
- **Profil** : Mon cycle, Ma semaine type, Courses & budget, Objectif & régime, Mes infos, synchronisation du foyer.

## Le cycle (contrat JSON v2)

Un cycle = **4 menus A, B, C, D** (une semaine chacun, sans dates) et **un seul rituel batch** commun aux 4 semaines : ce sont les dîners qui varient. L'app calcule les dates à partir du début du cycle et du jour des courses ; un nouveau cycle se débloque quand les 4 semaines (+ pauses) sont passées — sinon on relance le même.

1. Profil › **Mon cycle** › « Copier le prompt » : le prompt embarque le foyer, la semaine type, le budget, les recettes du cycle précédent, les règles dures et le schéma JSON (recopié de `src/lib/cycle/types.ts`).
2. Le coller dans une nouvelle conversation Claude (abonnement) : Claude produit `menu-A.json` … `menu-D.json`.
3. « Importer les fichiers » : l'app fusionne, vérifie (erreurs bloquantes, alertes budget / variété / keto), propose « Copier pour Claude » pour corriger, puis la date de début.

Contrat : `src/lib/cycle/types.ts` (types), `src/lib/cycle/schema.ts` (forme), `src/lib/cycle/valider.ts` (règles et alertes). Exemple : `src/assets/cycle-exemple.json` (anonymisé).

## Développement

```bash
npm install
npm run dev        # serveur de dev
npm test           # tests unitaires (vitest)
npm run e2e        # tests navigateur (Playwright, mobile 375/320)
npm run build      # build de production
npm run preview    # prévisualiser le build
npm run icons      # régénérer les icônes après modification de public/icon-src.svg
```

### Faire une release

La version affichée dans l'app (`Profil` → « Rituel vX.Y.Z ») vient de `package.json` — le bump est **volontaire**, tout le reste est automatique :

1. Dans la PR : renommer la section `[Non publié]` du `CHANGELOG.md` en `[x.y.z] - AAAA-MM-JJ`, puis `npm version minor --no-git-tag-version` (ou `patch` / `major`).
2. Fusionner : le VPS se met à jour (≤ 2 min) et le job `release` du Pipeline pose le tag `vx.y.z` puis crée la GitHub Release avec les notes du CHANGELOG. Sans bump de version : déploiement, pas de release.

## Déploiement

L'app et la sync tournent sur le **VPS**, à **https://rituel.marco-studio.fr** : un conteneur Docker (`Dockerfile`, `docker-compose.yml`) sert la PWA et l'API derrière Caddy.

- **Automatique** : le VPS vérifie `main` toutes les 2 min (`deploy/deploy.sh`, timer systemd) et reconstruit l'image quand une PR est fusionnée. Aucun secret sur GitHub.
- **CI des PR** (`.github/workflows/pipeline.yml`) : lint, types, tests, build, serveur, e2e 320/375 sur le build de prod, build de l'image Docker — verte avant toute fusion.
- Installation, backup, retour arrière : [`server/README.md`](server/README.md).

> Octobre 2026 — l'app quitte GitHub Pages (`marcsuarez74.github.io/rituel-app`) pour https://rituel.marco-studio.fr. Le localStorage ne suit pas un changement d'adresse : sur chaque téléphone, installer la PWA depuis la nouvelle adresse puis Profil › Foyer › « Se connecter au foyer » avec le code — les données reviennent du serveur.

## Données

- **Tout est stocké en local sur le téléphone** (localStorage) — aucun serveur, aucune donnée envoyée.
- Les **pesées sont stockées par profil**, indépendamment des cycles.
- Les **coches** vivent par semaine du cycle : relancer un cycle repart de coches vides.
- 2.0 : au premier lancement, les anciennes semaines `.md` et leurs coches sont effacées (une fois) ; profil, pesées, dépenses et sync sont gardés.

## Synchronisation entre téléphones (optionnelle)

Par défaut, tout reste sur le téléphone. Si un foyer est configuré (voir
[`docs/backend.md`](docs/backend.md)), les données (foyer, cycle, reports, coches,
pesées, dépenses, profils) se synchronisent entre Marc et Mélanie en quasi temps-réel,
avec file d'attente hors ligne.

> Vie privée : données synchronisées sur le serveur du foyer (VPS), accès
> limité au foyer. Sans configuration, l'app reste 100 % locale.
> « Supprimer les données du foyer » (Profil) purge serveur + local à tout
> moment.
