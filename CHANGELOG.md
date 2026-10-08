# Changelog

Toutes les évolutions notables de l'app sont documentées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr-FR/1.1.0/) et le versionnement sémantique ([semver](https://semver.org/lang/fr/)) : **majeur** = changement cassant (contrat .md, migration storage), **mineur** = nouvelle fonctionnalité, **correctif** = bugfix. La source de vérité est le champ `version` de `package.json`.

Ce fichier est **généré par [release-please](https://github.com/googleapis/release-please)** à partir des conventional commits (`feat` → mineur, `fix`/`perf` → correctif, `!` ou `BREAKING CHANGE:` → majeur) : ne pas l'éditer à la main. L'historique ci-dessous (jusqu'à 2.1.0) est conservé tel quel.

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
