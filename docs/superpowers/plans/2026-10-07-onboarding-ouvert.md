# Plan — onboarding ouvert, foyer à rejoindre, page Objectif

Spec : `docs/superpowers/specs/2026-10-07-onboarding-ouvert-design.md` ·
maquette : `docs/superpowers/mockups/2026-10-07-onboarding-ouvert.html` (v2 validée).

Chaque PR : tests d'abord, gate `npm test && npm run typecheck && npm run lint && npm run build`,
`npm run e2e:preview` (UI), `origin/main` fusionné avant la PR.

## PR 1 — correctifs (§0) · fusionnée (#43)

## PR 2 — page Objectif (§4, écran F)

1. `resumeObjectif(actuel, vise, echeance, aujourdhui)` dans `lib/stats.ts` : écart signé,
   kg/semaine jusqu'à l'échéance future, `ambitieux` > 1 kg/sem (tests `lib/stats.test.ts`).
2. `ProfilObjectif` réécrit : résumé citron, cap en cartes radio (`OBJECTIF_TYPES` : icône,
   nom, description), poids visé + échéance, alerte douce, régime en chips radio,
   compléments en chips à cocher (presets + libres + « Autre… »), **un seul Enregistrer**
   collé en bas (tests `profil-screen.test.tsx` › Page Objectif).
3. CSS : `.obj-resume`, `.rcards`, `.alerte-douce`, `.pied-collant`, chips 48 px +
   états ARIA ; `ai/context/design-system.md` à jour.
4. e2e : page Objectif sans débordement à 320/375 (spec onboarding-mobile).

L'interrupteur « Suivre mon poids » arrive avec le champ `suivi` (PR 3).

## PR 3 — identité ouverte + suivi optionnel (§1, §1 bis)

`ProfileKey` chaîne (`prenom-xxxx`), garde d'id, `Membre.telephone`, `assurerMoi`,
`UserProfile.suivi` (absent = true), `foyerParDefaut` = moi seul, cycle d'exemple mappé sur
le foyer, sync des pesées par garde d'id, onglet Suivi conditionnel, interrupteur Objectif.

## PR 4 — onboarding étape 1 + créer / rejoindre (§2, §3)

Étape 1 (prénom, pour qui, suivi), fin d'onboarding créer / rejoindre, code gardé sur le
téléphone créateur, rejoindre sans pousser le foyer provisoire, `rattacher()` + « Es-tu X ? »,
retrait d'un adulte sans téléphone.

## PR 5 — prompt IA de tout le foyer (§1 ter)

Profils des autres membres gardés en lecture seule (`sportapp:profils:foyer`), prompt
détaillant chaque membre suivi, `personnes`/`repasJour` retirés de l'onboarding, test
garde-fou « chaque réponse utile apparaît dans le prompt ».
