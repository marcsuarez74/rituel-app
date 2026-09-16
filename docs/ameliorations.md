# Axes d'amélioration — Rituel

Mémoire des idées et pistes d'évolution, notées le 2026-09-09. Ce fichier n'est
**pas une spec** : quand un axe devient une vraie feature, faire le cycle
habituel (brainstorming → spec → plan → TDD) et créer un dossier dans
`docs/superpowers/`. L'ordre des sections n'est pas une priorité — à arbitrer
au moment de choisir la prochaine itération.

## Contraintes non négociables

- **Zéro backend** : toutes les données vivent dans le téléphone (localStorage),
  PWA offline-first. Toute idée qui suppose un serveur est à re-formuler.
- **Public actuel** : Marc & Mélanie uniquement — mais garder la porte ouverte à
  une évolution multiprofile (ne pas graver « 2 profils » dans le code).
- **La rotation de 4 menus (A/B/C/D) est la clé** pour installer la routine
  (« Rituel ») : toute évolution du process doit préserver ce principe.

## Déjà en place (ne pas reconcevoir)

- Rotation 4 menus, cycle généré par prompt IA (`docs/templates/`), import
  groupé de 4 semaines .md via le profil, stock multi-semaines
  (`sportapp:weeks`), ouverture sur la semaine du jour, chevrons ‹ ›
- Onglets Cuisine (Courses · Menu · Batch) et Mon suivi (cibles, séances,
  rappels, pesées), coches par semaine, semaine d'exemple en fallback

## 1. Design & identité visuelle

→ **Livré** (chantier 1, thème « Herbes ») :
`docs/superpowers/specs/2026-09-09-refonte-herbes-design.md` — thème clair
sauge/basilic/citron, respiration, icônes SVG maison, nav segmented + swipe.
Ressenti initial noté pour mémoire :

- Trop compact ; le thème sombre alourdit l'app
- Manque d'icônes
- Viser un thème **cuisine / élégance / sobriété** (réfléchir au dark mode
  actuel vs une palette plus lumineuse — à challenger sans casser le design
  system existant : tokens sur `:root`, un seul `index.css`)

→ **TODO — Menu v3 × plancher d'icônes** : le chantier polish (v1.1.0) a fixé
un plancher de 14 px aux appels d'icônes ; le Menu v3 (v1.2.0, écrit en
parallèle) en a encore à 11-12 px (tick des pills `.rtab`, note de
déblocage `.lock-note`, meta-pills). À harmoniser lors d'une prochaine passe
design — les maquettes v3 validées utilisaient ces tailles, à arbitrer.

## 2. Onboarding enrichi (process au chargement de l'app)

→ **Livré** (chantier 3, profil v2.1) :
`docs/superpowers/specs/2026-09-09-maison-courses-design.md` — magasin,
budget (estimé menu / payé réel / max hebdo), dépenses réelles (historique +
comparatif par magasin), préférences (types de plats), personnes/repas par jour,
onboarding 5e étape, « Copier les paramètres IA ». Noté pour mémoire :

- **Magasin** où on fait ses courses (adapter les listes / la disposition →
  axe 4 ; ici seul le nom + le prix sont traités)
- **Matériel** disponible chez soi (four, multi-cuiseur, blender… → filtre les
  recettes et le batch) — **reporté**, à traiter avec l'axe 4
- **Type de plats** souhaité : healthy / végé / vegan / petit budget / etc. —
  traité (champ préférences multi-pick, paramètre du prompt IA)
- **Budget max par semaine** (course + par repas ?) — traité (plafond hebdo,
  comparé au payé réel ; le par repas reste à penser)
- **Nombre de repas** par jour et **nombre de personnes** à table — traité
  (paramètres IA seuls)
- **Polish à arbitrer** (retour d'usage) : le budget estimé est affiché en
  double (cellule « Estimé menu » de la carte Budget courses + suffixe
  « ≈ X € estimés. » de la bannière rituel du chantier 1) — à arbitrer si
  retour utilisateur
- **Partie « Objectif »** → **traitée par la spec Profil & objectifs**
  (chantier 2)

## 3. Profil & objectifs

→ **Livré** (chantier 2, profil v2) :
`docs/superpowers/specs/2026-09-09-profil-objectifs-design.md` — profil v2
(date de naissance, objectif 4 types + échéance, compléments, régime),
onboarding (4 étapes à la livraison, 5e étape ajoutée par le chantier 3)
avec migration préremplie, bloc Objectif dans le suivi,
stat-cards réduites à Poids. Noté pour mémoire :

- **Âge → date de naissance** : stocker la date de naissance plutôt que l'âge
  (champ collecté à l'onboarding, éditable à l'écran Profil) — l'âge s'affiche
  calculé, plus de mise à jour manuelle chaque année
- **Objectif explicite** : perte de poids / affiner musculature / prise de
  masse (aujourd'hui implicite via les cibles kcal)
- **Compléments** : whey, créatine, oméga-3, collagène… (affichés dans le suivi
  ? intégrés aux cibles ?)
- **Régime** : keto par exemple — paramètre du profil plutôt qu'un fait acquis
  (Mélanie = keto aujourd'hui)

## 4. Onglet Cuisine

→ **Livré** (chantier 1, cf. axe 1) :
bannière rituel + mode magasin (courses), **menu v2 « réserve de recettes »**
(fin du jour imposé, coche « c'est fait », portions réelles par profil, recette
sur chaque carte), mode guidé batch + textes de conservation. Reste à penser
pour des chantiers ultérieurs :

- **Liste de courses** : disposition adaptée au magasin habituel (cf. axe 2)
- **Flexibilité totale** : marquer « c'est fait » sur un repas **sans recette
  rattachée** (cook libre) — le menu v2 part de cartes recette ; le cas
  « repas hors liste » n'est pas couvert
- **Batch** : scoring/budget par recette, vue matériel (cf. axe 2)

## 5. Onglet Suivi

→ **L'essentiel est traité** : design par la spec « Herbes » (axe 1), séances
en liste libre et retrait de la carte « Kcal du jour » par la spec « Profil &
objectifs » (chantier 2), le graphique de poids a été abandonné. Reste,
éventuellement :

- **Rappel de pesée** (lun/mer/ven) — à rendre plus visible/actionnable

## 6. Rotation & génération (simplification)

- Simplifier le process de rotation : aujourd'hui prompt IA hors app → 4
  fichiers .md → import manuel. Piste : appeler directement une **API IA
  depuis l'app** (à réconcilier avec « zéro backend » : appel client direct,
  clé à l'utilisateur, ou génération hors app gardée)
- Garder la rotation sur 4 menus quoi qu'il arrive (cf. contraintes)
