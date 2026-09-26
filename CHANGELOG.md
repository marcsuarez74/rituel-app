# Changelog

Toutes les évolutions notables de l'app sont documentées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr-FR/1.1.0/) et le versionnement sémantique ([semver](https://semver.org/lang/fr/)) : **majeur** = changement cassant (contrat .md, migration storage), **mineur** = nouvelle fonctionnalité, **correctif** = bugfix. La source de vérité est le champ `version` de `package.json`.

## [Non publié]

### Ajouté

- Mon Rituel (ex-onglet Batch) : références recette sur les tâches et les étapes du rituel (`- [ ] Egg muffins ×10 → R7`, extension rétrocompatible du contrat .md), fiche recette dépliable à chaque étape du mode guidé, micro-batch enrichi (durée, quantité, recette liée), réserve avec état disponible/consommé et joker interactif dans le Menu (un soir sans dîner prévu → « Sors la réserve : … », coche = consommée).
- Profil hub v5 : `ProfilScreen` devient une vue générale courte sur canvas crème — en-tête compte (initiale + prénom + chip « ● Duo connecté / Local · Cycle N »), 4 tuiles cards (Objectif, Mes infos, Maison & courses, Notifications) avec résumé d'état sous le titre, actions directes (changer de profil, copier le prompt IA, déconnexion du foyer, import du cycle). Chaque tuile ouvre une page détail dédiée (retour ‹ Profil) — la page Objectif regroupe le cap complet (type, poids objectif, échéance, régime, compléments), les formulaires respirent, plus de scroll interminable. Tuile Notifications silencieuse sans support SW.

### Modifié

- Onboarding tout sautable : chaque étape porte un CTA discret « Passer » (seul le choix du profil reste obligatoire) et le doublon d'objectif disparaît de l'étape 4. Le prénom s'édite à l'étape 1 (« C'est ton prénom ? ») puis dans Mes infos — salutations, titre du suivi et prompt IA l'utilisent. Profil v2.2 : date de naissance et taille deviennent optionnelles (sections silencieuses quand absentes) ; aucune donnée n'est réinitialisée.
- La semaine consultée (chevrons/commutateur) est mémorisée : à la relance, l'app rouvre sur la semaine en cours de consultation au lieu de retomber sur la semaine du jour (nouvelle clé `sportapp:selection`) ; si la semaine a disparu du stockage, repli propre sur la semaine du jour.

### Corrigé

- Menu : la recette consultée ne saute plus vers la sélection par défaut (jour du jour / premier non fait) quand l'autre téléphone pousse une modification — le pull remote recharge les coches sans perdre l'onglet ouvert ; un changement de semaine replie toujours sur le défaut.
- Menu : glisser la barre d'onglets de recettes pour la faire défiler ne bascule plus vers l'onglet Suivi (conflit avec le swipe Cuisine ↔ Mon suivi).

### Retiré

- Notifications push (VAPID) : tuile et page Notifications du hub Profil, handlers push/notificationclick du service worker, modules `src/lib/push/`, edge functions `push-register`/`push-notifier`/`push-rappels` + `_shared/`, migration `0002_push_subscriptions`, secret `VITE_VAPID_PUBLIC_KEY`. Les appareils ayant une souscription active ne reçoivent plus rien (silencieux, sans erreur). La synchronisation du foyer (≠ push) est inchangée.

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
