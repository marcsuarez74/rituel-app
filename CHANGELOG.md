# Changelog

Toutes les évolutions notables de l'app sont documentées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr-FR/1.1.0/) et le versionnement sémantique ([semver](https://semver.org/lang/fr/)) : **majeur** = changement cassant (contrat .md, migration storage), **mineur** = nouvelle fonctionnalité, **correctif** = bugfix. La source de vérité est le champ `version` de `package.json`.

Ce fichier est **généré par [release-please](https://github.com/googleapis/release-please)** à partir des conventional commits (`feat` → mineur, `fix`/`perf` → correctif, `!` ou `BREAKING CHANGE:` → majeur) : ne pas l'éditer à la main. L'historique ci-dessous (jusqu'à 2.1.0) est conservé tel quel.

## [2.13.0](https://github.com/marcsuarez74/rituel-app/compare/v2.12.0...v2.13.0) (2026-10-16)


### Ajouté

* **server:** génération des menus /v2 ([149b9bb](https://github.com/marcsuarez74/rituel-app/commit/149b9bbd7efdcde728be549babb395d48ffd261a))

## [2.12.0](https://github.com/marcsuarez74/rituel-app/compare/v2.11.0...v2.12.0) (2026-10-16)


### Ajouté

* **server:** contrat des menus /v2 et validateur ([35d66d5](https://github.com/marcsuarez74/rituel-app/commit/35d66d55f8efb1eaeee5805c4da539cdb7123ab0))
* **server:** contrat des menus /v2 et validateur ([c053d7b](https://github.com/marcsuarez74/rituel-app/commit/c053d7b2144776503a10866a1e0c2f5adcddb9e8))

## [2.11.0](https://github.com/marcsuarez74/rituel-app/compare/v2.10.0...v2.11.0) (2026-10-16)


### Ajouté

* **server:** acceptation des CGU /v2 ([5ea4b4f](https://github.com/marcsuarez74/rituel-app/commit/5ea4b4fa7a41af467659267e86f8c7e64192e025))
* **server:** table d'ingrédients /v2 et table de conservation ([3272bde](https://github.com/marcsuarez74/rituel-app/commit/3272bde66b13dc95f77e59037c366994be98e017))

## [2.10.0](https://github.com/marcsuarez74/rituel-app/compare/v2.9.0...v2.10.0) (2026-10-16)


### Ajouté

* **server:** API /v2 de l'app native — squelette et foyer à code de 6 caractères ([8f9dc84](https://github.com/marcsuarez74/rituel-app/commit/8f9dc84bb9abe4d2ba0ed6e1e892a664432602b3))
* **server:** état partagé du foyer /v2 (sync) ([c18797a](https://github.com/marcsuarez74/rituel-app/commit/c18797a438406ecc40a6be2058c8229b93bd8978))
* **server:** état partagé du foyer /v2 (sync) ([3a79785](https://github.com/marcsuarez74/rituel-app/commit/3a797850876a53ba3cb626d2222a0c2607ce850a))
* **server:** foyer /v2 à code de 6 caractères ([4cba8fa](https://github.com/marcsuarez74/rituel-app/commit/4cba8fafff266fcab34b54f339cda20d0263a601))
* **server:** squelette de l'API /v2 de l'app native ([2d007b5](https://github.com/marcsuarez74/rituel-app/commit/2d007b5a294a83d4dcb10fa055b13742b6aaac86))

## [2.9.0](https://github.com/marcsuarez74/rituel-app/compare/v2.8.0...v2.9.0) (2026-10-13)


### Ajouté

* journées de la semaine type — classique, sportive, sortie, repos ([de3d94b](https://github.com/marcsuarez74/rituel-app/commit/de3d94bf5f60e8a8aae8863d5c4a4691982d1b35))

## [2.8.0](https://github.com/marcsuarez74/rituel-app/compare/v2.7.0...v2.8.0) (2026-10-13)


### Ajouté

* assistant « Prépare tes prochains menus » (3 étapes) ([1595d7f](https://github.com/marcsuarez74/rituel-app/commit/1595d7fefb67ce7e6ec392e81f63c4288cc29103))
* badges « dès les prochains menus » et bandeau des changements ([ae5b107](https://github.com/marcsuarez74/rituel-app/commit/ae5b1073048ba8453eea73b90c7b20fd4b06238a))
* courses par famille de couleur, « J'ai payé » quand tout est coché ([8b457f3](https://github.com/marcsuarez74/rituel-app/commit/8b457f3650594abb1e62e2581ed26c7f392d8da6))
* diff de la semaine type depuis l'instantané de lancement ([bb08f98](https://github.com/marcsuarez74/rituel-app/commit/bb08f98388562fd334d32b516c9c78c12f211fee))
* instantané de la semaine type au lancement des menus ([f18482e](https://github.com/marcsuarez74/rituel-app/commit/f18482e5d964ff86fd4feca6b7b03535b465640d))


### Corrigé

* « Voir ma semaine » rouvre bien le shell ; vitest ignore .claude/ ([b97ca2c](https://github.com/marcsuarez74/rituel-app/commit/b97ca2cefc50f66a049c9b6e4b23b2fb149cac0e))
* le jour des courses recalcé recale le début des menus en cours ([2e2dcb1](https://github.com/marcsuarez74/rituel-app/commit/2e2dcb1b5c66b89fefd56c61b164b4208342aadb))

## [2.7.0](https://github.com/marcsuarez74/rituel-app/compare/v2.6.0...v2.7.0) (2026-10-13)


### Ajouté

* couleur par plat et provenance sur les cartes repas ([da1f55a](https://github.com/marcsuarez74/rituel-app/commit/da1f55ab883b61be2dd2737991d24737f6638954))
* écran Aujourd'hui, l'ardoise dit quoi faire ([135066b](https://github.com/marcsuarez74/rituel-app/commit/135066be32218b47af4a120eec8426bcd869a02a))
* navigation à 4 onglets, écrans Semaine et Moi ([60a55fd](https://github.com/marcsuarez74/rituel-app/commit/60a55fdbaf9876cb9de42526b92fde5aa61a8da7))
* vocabulaire « menus » sur les écrans + test e2e aucun cycle visible ([90d39b4](https://github.com/marcsuarez74/rituel-app/commit/90d39b4577cabe48340d0c3ade673852d93dfc32))

## [2.6.0](https://github.com/marcsuarez74/rituel-app/compare/v2.5.0...v2.6.0) (2026-10-12)


### Ajouté

* police Bricolage Grotesque auto-hébergée (titres du thème Marché) ([39fb895](https://github.com/marcsuarez74/rituel-app/commit/39fb8955537fac66dc73ae3adf6302d3962bf9af))
* thème Marché coloré (tokens, composants de base, méta PWA) ([0010f0a](https://github.com/marcsuarez74/rituel-app/commit/0010f0adf8543d4af6819e0936ec4d62200d65fc))


### Corrigé

* e2e mobile 320px — ligne de boutons d'onboarding et champ capture ([7d6fba5](https://github.com/marcsuarez74/rituel-app/commit/7d6fba5d4f9ccd62e17ef94bdc8fbee63599cf8f))
* lisibilité des taglines d'onboarding, champs unifiés, docs design alignées ([ed44914](https://github.com/marcsuarez74/rituel-app/commit/ed44914a9a799354632b5f1f1a7befb4bf1fc5a2))

## [2.5.0](https://github.com/marcsuarez74/rituel-app/compare/v2.4.0...v2.5.0) (2026-10-12)


### Ajouté

* **profil:** case « dernier appareil » — supprimer tout le foyer ([7bd2224](https://github.com/marcsuarez74/rituel-app/commit/7bd222482816e8160afd5dcd8d09c2d116221063))
* **profil:** case « dernier appareil » pour supprimer le foyer entier ([5ee3d66](https://github.com/marcsuarez74/rituel-app/commit/5ee3d66c6f15e08af7fce057d91c014bfedeeb59))

## [2.4.0](https://github.com/marcsuarez74/rituel-app/compare/v2.3.0...v2.4.0) (2026-10-12)


### Ajouté

* **onboarding:** fin d'onboarding directement sur Mon cycle avec le prompt à copier ([3c4e7ca](https://github.com/marcsuarez74/rituel-app/commit/3c4e7ca10789341fa456b076c97546c2c9c73171))
* **onboarding:** plusieurs magasins (liste rétrocompatible) du foyer au prompt IA ([4000d75](https://github.com/marcsuarez74/rituel-app/commit/4000d75add86b8004c42eb247811dcb5b8ec8f25))
* **onboarding:** stepper corrigé, plusieurs magasins, arrivée sur Mon cycle ([843f386](https://github.com/marcsuarez74/rituel-app/commit/843f3865c87156704e2b93d74c5d1635aa18507e))
* **profil:** supprimer son profil (local + DELETE /foyers/moi) ([3f4e647](https://github.com/marcsuarez74/rituel-app/commit/3f4e64734f4ca351c80bd35876b818eaae53a37d))
* **profil:** supprimer son profil (local + serveur) ([4154505](https://github.com/marcsuarez74/rituel-app/commit/41545057ac9ddc056692e1981dbdccb875d8a711))


### Corrigé

* **cycle:** valeurs autorisées dans le prompt + alias de rayons/unités à l'import ([c1132a1](https://github.com/marcsuarez74/rituel-app/commit/c1132a1c3e92305aebbba5a4ded11b0d9459ec0b))
* **cycle:** valeurs autorisées dans le prompt + alias de rayons/unités tolérés à l'import ([a24103d](https://github.com/marcsuarez74/rituel-app/commit/a24103d43ad92ee33b408fb658031c0c3e50ddb4))
* **onboarding:** indicateur d'étapes aligné sur les écrans réellement traversés ([3dfe7f6](https://github.com/marcsuarez74/rituel-app/commit/3dfe7f66b5b03479037c5ee6b57ec192d10d58ef))

## [2.3.0](https://github.com/marcsuarez74/rituel-app/compare/v2.2.0...v2.3.0) (2026-10-08)


### Ajouté

* **bugs:** API POST /bugs (issue GitHub) et GET /bugs/capture/:name ([fb23114](https://github.com/marcsuarez74/rituel-app/commit/fb23114433f1b7c35dd51e1b7854fe0955a45a93))
* **bugs:** écran Signaler un bug dans le profil ([5aecd6d](https://github.com/marcsuarez74/rituel-app/commit/5aecd6d613b98c0d953ae4967d4bebc95916f115))
* signaler un bug depuis le profil (issue GitHub) ([2815c06](https://github.com/marcsuarez74/rituel-app/commit/2815c06460976968150889a7fd23d0fa06e8b3f9))

## [2.2.0](https://github.com/marcsuarez74/rituel-app/compare/v2.1.0...v2.2.0) (2026-10-08)


### Ajouté

* **deploiement:** /sante expose le commit déployé (GIT_SHA → APP_COMMIT) ([c212221](https://github.com/marcsuarez74/rituel-app/commit/c2122213b1fd523b0f6b488b2371ecd874f09902))

## [2.1.0] - 2026-10-08

### Changé

- **Prompt du cycle : tout le foyer**. Chaque membre suivi est détaillé avec son propre profil (objectif, âge, dernière pesée, taille, compléments), reçu par la sync — avant, seul le téléphone qui copiait le prompt l'était et Claude devinait les cibles de l'autre.
- **Questions en double retirées** : « Personnes à table » et « Repas par jour » (inscription et Profil › Courses & budget) — le foyer dit déjà qui est à table, la semaine type quels repas.

### Ajouté

- **Inscription ouverte à tous** : plus de cartes Marc / Mélanie — étape 1 « Bienvenue sur Rituel » : prénom, « Tu cuisines pour… » (juste moi, à deux avec le prénom du/de la partenaire, en famille avec les enfants), « Juste la routine » ou « Suivre mon poids et un objectif » (sans suivi, les étapes mesures et objectif sont sautées). Le foyer naît de ces réponses.
- **Partager avec ton foyer** (fin d'inscription et Profil › Foyer) : « Créer mon foyer » affiche le code à donner (Copier / Partager) ; « Rejoindre un foyer » prend le foyer du serveur sans l'écraser et rattache le téléphone au bon membre — automatiquement si le prénom correspond, sinon « Es-tu Thérèse ? ».
- **Profil › Foyer** : la liste des membres (toi, téléphone connecté, pas encore de téléphone) et le code du foyer, masqué, à afficher ou copier — fini le code perdu.
- **Ma semaine type** : un adulte sans téléphone (doublon) peut être retiré.

### Ajouté

- **Suivi optionnel** : Profil › Objectif › « Suivre mon poids et un objectif ». Coupé = « juste la routine » : plus d'onglet Suivi (barre à 4 onglets), plus de macros exigées ni d'objectif dans le prompt pour ce membre (portions adulte standard) ; le régime et les compléments servent toujours aux menus.

### Changé

- **Identité ouverte** (préparation de l'inscription pour tous) : un profil a un identifiant interne libre, les pesées et la sync suivent n'importe quel profil ; le foyer par défaut ne contient plus que soi, et chaque téléphone y garde son membre à jour (prénom, suivi, régime). Le cycle d'exemple prend les prénoms du foyer.

### Changé

- **Profil › Objectif** repensé : résumé « 82,4 kg → 75 kg · −7,4 kg d'ici le 31 déc. · ≈ 0,6 kg / semaine » (alerte douce « Rythme ambitieux » au-delà de 1 kg/semaine), cap en cartes avec description, régime et compléments en pastilles à cocher (suggestions + « Autre… »), **un seul bouton Enregistrer** collé en bas au lieu de trois. Pastilles à 48 px de haut partout.

### Ajouté

- **Mon cycle** : « Changer la date de début » à tout moment, date passée comprise (« courses faites samedi dernier ») ; le jour des courses du foyer suit la date choisie, les coches restent.
- **Fiche recette** : interrupteur « Garder l'écran allumé » (remplace le bouton « Mode cuisine »).

### Corrigé

- Profil › Foyer : un téléphone dont le foyer n'existe plus sur le serveur repasse « Local » (créer / rejoindre) au lieu de rester en erreur avec « Déconnecter le foyer ».
- Ta semaine : « Pour que Rituel cale les menus… ».
- Installation VPS : la copie de sécurité prend la base et son journal WAL ensemble.
- CI : installation des navigateurs e2e bornée (3 essais de 5 min) — un miroir apt figé bloquait la PR 30 min.

## [2.0.0] - 2026-10-07

> **Refonte 2.0 — version majeure** (contrat et stockage cassants) et **nouvelle adresse** : https://rituel.marco-studio.fr (l'app et la sync sur le VPS). Sur chaque téléphone : installer la PWA depuis la nouvelle adresse puis Profil › Foyer › « Se connecter au foyer » avec le code — profil, pesées, dépenses, foyer et cycle reviennent du serveur.

### Ajouté

- **Cycle v2** : 4 menus A-D + **un seul rituel batch** pour les 4 semaines, générés par Claude au format JSON (un fichier par menu) depuis Profil › **Mon cycle** — copier le prompt, ouvrir Claude, importer ; aperçu avec erreurs bloquantes, alertes (budget, variété, keto, recettes déjà vues) et « Copier pour Claude ». Dates calculées depuis le jour des courses ; nouveau cycle verrouillé tant que les 4 semaines ne sont pas passées ; relance du même cycle ; pause d'une semaine.
- **Navigation** : barre du bas à 5 onglets (Aujourd'hui · Menu · Courses · Rituel · Suivi), en-tête avec avatar et point de sync, ligne semaine ; écrans chargés à la demande.
- **Aujourd'hui** : la semaine en un coup d'œil, l'action du jour, les repas du jour cochables d'un tap.
- **Menu** : bande des 7 jours, versions de chacun, exceptions, boîtes du rituel, « Ce soir, j'anticipe » ; **report** d'un repas (demain, semaine prochaine, abandon) avec toast Annuler et avertissement fraîcheur.
- **Fiche recette** : macros et portion par membre suivi, ingrédients du foyer, étapes cochables, minuteurs, conservation, mode cuisine (écran allumé).
- **Courses calculées** depuis les recettes de la semaine + articles fixes, carte Estimé / Payé / Max (budget souple avec alerte), mode magasin, « J'ai payé… », placard à vérifier, « déjà au frigo ? ».
- **Rituel** : rituel du jour, micro-batch, réserve ; **mode guidé** plein écran.
- **Foyer et semaine type** (Profil › Ma semaine type, étape « Ta semaine » après l'onboarding) : membres (enfants sans âge), jour des courses, jour du rituel, jour par jour, exceptions récurrentes.
- Sync : table `etat` (foyer, cycle, reports) côté app et serveur.

- Mon Rituel (ex-onglet Batch) : références recette sur les tâches et les étapes du rituel (`- [ ] Egg muffins ×10 → R7`, extension rétrocompatible du contrat .md), fiche recette dépliable à chaque étape du mode guidé, micro-batch enrichi (durée, quantité, recette liée), réserve avec état disponible/consommé et joker interactif dans le Menu (un soir sans dîner prévu → « Sors la réserve : … », coche = consommée).
- Profil hub v5 : `ProfilScreen` devient une vue générale courte sur canvas crème — en-tête compte (initiale + prénom + chip « ● Duo connecté / Local · Cycle N »), 3 tuiles cards (Objectif, Mes infos, Maison & courses) avec résumé d'état sous le titre, actions directes (changer de profil, copier le prompt IA, déconnexion du foyer, import du cycle). Chaque tuile ouvre une page détail dédiée (retour ‹ Profil) — la page Objectif regroupe le cap complet (type, poids objectif, échéance, régime, compléments), les formulaires respirent, plus de scroll interminable.
- Sync sur VPS personnel (Node + SQLite) : mini-serveur `server/` (Hono, better-sqlite3 WAL, API JSON + SSE temps réel ~1 s, JWT 365 j, code foyer PBKDF2, rate-limit, backup cron) remplaçant Supabase ; **création du foyer depuis l'app** (code d'invitation permanent affiché une fois, « mots d'herbes + 8 hex »), bouton « Créer un foyer » au Profil.

### Changé

- **Hébergement** : l'app quitte GitHub Pages pour le VPS, à https://rituel.marco-studio.fr — un seul conteneur Docker sert la PWA et l'API de sync (même origine, mêmes routes). Déploiement automatique : le VPS suit `main` (contrôle toutes les 2 min), puis tag et Release GitHub posés automatiquement à chaque fusion d'une nouvelle version. La PWA est servie à la racine (`/`, plus `/rituel-app/`).
- Onboarding tout sautable : chaque étape porte un CTA discret « Passer » (seul le choix du profil reste obligatoire) et le doublon d'objectif disparaît de l'étape 4. Le prénom s'édite à l'étape 1 (« C'est ton prénom ? ») puis dans Mes infos — salutations, titre du suivi et prompt IA l'utilisent. Profil v2.2 : date de naissance et taille deviennent optionnelles (sections silencieuses quand absentes) ; aucune donnée n'est réinitialisée.
- La semaine consultée (chevrons/commutateur) est mémorisée : à la relance, l'app rouvre sur la semaine en cours de consultation au lieu de retomber sur la semaine du jour (nouvelle clé `sportapp:selection`) ; si la semaine a disparu du stockage, repli propre sur la semaine du jour.
- Sync : une seule variable de build `VITE_SYNC_URL` (remplace `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`) ; client sync en fetch natif + lecteur SSE (supabase-js retiré) ; engine/outbox/storage inchangés (port SyncClient identique, migration par re-jumelage des téléphones).

### Corrigé

- Menu : la recette consultée ne saute plus vers la sélection par défaut (jour du jour / premier non fait) quand l'autre téléphone pousse une modification — le pull remote recharge les coches sans perdre l'onglet ouvert ; un changement de semaine replie toujours sur le défaut.
- Menu : glisser la barre d'onglets de recettes pour la faire défiler ne bascule plus vers l'onglet Suivi (conflit avec le swipe Cuisine ↔ Mon suivi).

### Retiré

- **Format `.md` des semaines** (parser, semaine d'exemple, templates, import `.md`) et l'ancien onglet Cuisine : au premier lancement de la 2.0, les semaines `.md`, leurs coches et la semaine consultée sont effacées (une fois) ; profil, pesées, dépenses et sync sont conservés. La table de sync `weeks` n'est plus utilisée par l'app.
- Suivi : séances, cibles et rappels (reportés) ; la carte objectif et le poids restent.
- Dépendance `js-yaml`.

- Notifications push (VAPID) : tuile et page Notifications du hub Profil, handlers push/notificationclick du service worker, modules `src/lib/push/`, edge functions `push-register`/`push-notifier`/`push-rappels` + `_shared/`, migration `0002_push_subscriptions`, secret `VITE_VAPID_PUBLIC_KEY`. Les appareils ayant une souscription active ne reçoivent plus rien (silencieux, sans erreur). La synchronisation du foyer (≠ push) est inchangée.
- Backend Supabase : projet, edge function `connexion-foyer`, script CLI `creer-foyer.mjs`, migrations SQL (dossier `supabase/` supprimé) — remplacés par le serveur VPS.

## [1.3.0] - 2026-09-18

### Ajouté

- Notifications push (2 Android, opt-in au Profil) : « Dîner coché », « Pesée ajoutée », « Courses faites » (contenu personnalisé par membre : « C'est prêt ! Mélanie a fait la recette "…" ») + rappels planifiés (séance / pesée / rituel dimanche, jours et heure au choix, envoi horaire toutes les 5 min en fuseau local, 1 notification/jour/rappel). Infrastructure : souscriptions par appareil (RLS foyer), edge functions `push-register` / `push-notifier` / `push-rappels` + pg_cron, Web Push VAPID en WebCrypto pur (aucune dépendance), service worker custom (`injectManifest`) — handlers push + clic. Sans env `VITE_VAPID_PUBLIC_KEY`, tout est no-op.
- Synchronisation optionnelle entre les 2 téléphones (Supabase) : semaines, coches, pesées, dépenses et profils ; file d'attente hors ligne, realtime, code de foyer, effacement du foyer.
- « Copier le prompt IA » au Profil : un geste copie le prompt complet de génération de cycle — contexte personnel (prénom, âge, dernière pesée, taille, objectif, régime, compléments, courses/budget, personnes à table, préférences) + squelette du format .md et règles dures inline. Remplace le bloc « Paramètres » à recoller à la main.

### Changé

- Échelles de design tokenisées dans `src/index.css` : typographie (10 tokens `--fs-*`), espacement 2 px (10 tokens `--sp-*`), interlignage (4 tokens `--lh-*`) — balayage complet du CSS, y compris le shorthand `font:` (rendu inchangé aux ±1 px près) et garde-fou anti-régression `tests/css-tokens.test.ts`.
- Latence de sync réduite : une coche apparaît sur l'autre téléphone en < 1 s (flush différée 2 s → 300 ms, lectures des 5 tables en parallèle, debounce realtime 500 → 150 ms).

### Corrigé

- Le point de synchronisation de la bannière n'apparaît que si un foyer est appairé (plus de point « non connecté » en permanence) ; après une déconnexion volontaire, le bloc Profil propose de nouveau la connexion sans recharger la page
- Statut de sync vivant : échec de connexion au démarrage réparé par un appui sur le point ou au retour du réseau (plus besoin de recharger), coupure du canal websocket détectée et reconnexion automatique (~5 s), rattrapage des données manquées à la réouverture

## [1.2.0] - 2026-09-16

### Modifié

- Menu v3 : navigation par onglets de **recettes** (7 dîners + 🍱 Déjeuners, aucun jour affiché), fiche recette complète dans l'onglet, coche unique « C'est fait » par dîner (onglet grisé), file de déjeuners dynamique (les boxes se débloquent quand leur recette est faite), progression « Dîners X/N · Boxes X/N »
- Portions en mesures maison (pièces, poignées, c. à soupe, louches) — les grammes entre parenthèses ne servent qu'à caler l'œil (semaine d'exemple, template, prompt IA)

### Corrigé

- Champs de l'onboarding (5ᵉ étape) et du profil rendus dans le style de l'app (hauteur, fond, arrondis) au lieu du rendu natif

## [1.1.0] - 2026-09-15

### Ajouté

- Icônes SVG maison (`Icon.tsx`), bannière « Pensées pour le rituel » + budget, note de fraîcheur et marqueur batch sur les items, Mode magasin, bannière « Ce soir », mode guidé « Lancer le batch », swipe Cuisine ↔ Mon suivi, portions par profil + indice de fraîcheur des recettes
- Profil v2 : date de naissance (l'âge devient calculé), objectif explicite (perte / affiner / masse / maintien) avec échéance, compléments (presets + libre), régime descriptif
- Onboarding en 5 étapes avec migration préremplie (le profil ancien est mis à niveau au premier lancement)
- Bloc « Objectif » en tête de Mon suivi : type, échéance (J-restants / dépassée), progression pesée → cible, compléments
- Maison & courses : magasin habituel, budget courses (estimé du menu vs payé réel vs max hebdo), dépenses réelles avec historique et comparatif par magasin, préférences de plats, taille du foyer (personnes, repas/jour) — collectés à l'onboarding (5e étape), modifiables au Profil
- Carte « Budget courses » dans l'onglet Courses (estimé ≈ / payé cette semaine / budget max, barre et alerte de dépassement)
- « Copier les paramètres IA » : le bloc Paramètres du prompt de génération se copie d'un geste
- Batch : badge « ≈ durée » du rituel (calculé des créneaux), ligne production/conservation, section « La réserve — au frigo cette semaine », détails sur les cartes micro-batch, message de fin du mode guidé personnalisable (`- termine:`) — nouveaux champs optionnels du contrat .md (rétrocompatibles)
- Icône `pasta` du jeu SVG

### Modifié

- Thème clair « Herbes » (sauge/basilic/citron) — le dark mode est retiré
- Navigation segmented sous la bannière (le dock flottant disparaît)
- Format .md v2 (rétrocompatible) : `- budget:`, suffixes ` · rituel` / ` | note`, `fraicheur:`, `- portions marc/melanie:`
- Stat-cards réduites à la carte Poids (variation en kg vs 7 jours)
- Séances en liste libre : le jour n'est plus qu'une recommandation (« conseillé lun. »)
- Écran Profil réorganisé : Mes infos, Objectif, Compléments, Régime
- Carte « Budget courses » : habillage citron, « Payé cette semaine » en chiffre héros, estimé/max en phrase secondaire, actions en deux pills 48 px
- Icônes : taille plancher 14 px et trait renforcé (2,5 sous 16 px) — lisibilité en cuisine
- Batch : « Lancer le batch » devient un bouton pleine largeur sous la timeline ; titres « Rituel dimanche » / « Micro-batch en semaine » sans émoji ; bannières rituel/Ce soir centrées verticalement

### Retiré

- Dock flottant, thème sombre, badge « Aujourd'hui » du menu
- Objectif kcal/jour (saisie et affichage), âge saisi à la main, cartes Courses / Kcal / Séances du suivi

## [1.0.0] - 2026-09-09

Première version étiquetée — état de l'app après le redesign Nutrigo et le renommage en Rituel.

### Ajouté

- **Version visible** en bas de l'écran Profil (« Rituel vX.Y.Z ») pour diagnostiquer le cache du service worker
- **Releases GitHub** : le push d'un tag `v*` crée la release avec les notes du CHANGELOG (workflow `release.yml`)
- Rotation de 4 menus hebdomadaires + import d'un cycle complet (.md) avec navigation entre semaines par chevrons
- Stock multi-semaines, coches et pesées persistées en localStorage par semaine et par profil
- Onboarding en 2 étapes (profil Marc / Mélanie, poids, âge, taille, objectifs) et écran Profil éditable
- Suivi du profil actif : cibles, séances, rappels, pesées avec courbe de poids
- Onglet Cuisine partagé : Courses (compteurs par rayon, encadré keto), Menu (jour courant en tête, cartes recettes), Batch (timeline du rituel dimanche, carrousel micro-batch)
- PWA offline-first installable (service worker autoUpdate, icônes maskable)
- Semaine d'exemple auto-chargée au premier lancement, hors-ligne dès l'installation

[Unreleased]: https://github.com/marcsuarez74/rituel-app/compare/v1.1.0...HEAD
[1.2.0]: https://github.com/marcsuarez74/rituel-app/releases/tag/v1.2.0
[1.1.0]: https://github.com/marcsuarez74/rituel-app/releases/tag/v1.1.0
[1.0.0]: https://github.com/marcsuarez74/rituel-app/releases/tag/v1.0.0
