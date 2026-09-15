# Changelog

Toutes les évolutions notables de l'app sont documentées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr-FR/1.1.0/) et le versionnement sémantique ([semver](https://semver.org/lang/fr/)) : **majeur** = changement cassant (contrat .md, migration storage), **mineur** = nouvelle fonctionnalité, **correctif** = bugfix. La source de vérité est le champ `version` de `package.json`.

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
- Menu : réserve de recettes en cartes (coche « c'est fait », plus aucun jour imposé)
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
[1.1.0]: https://github.com/marcsuarez74/rituel-app/releases/tag/v1.1.0
[1.0.0]: https://github.com/marcsuarez74/rituel-app/releases/tag/v1.0.0
