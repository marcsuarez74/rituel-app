# Onboarding — retours du test utilisateur — spec (2026-10-12)

## Constats
1. Le stepper affichait « étape 4 » au 2e écran : sans suivi, les étapes internes 2 et 3
   (corps, objectif) sont sautées (1 → 4 → 5) mais `n <= step` comptait l'index interne
   et le total restait fixé à 5.
2. Un seul magasin possible (« Maison & courses »).
3. La fin d'onboarding atterrissait sur le cycle d'exemple, sans guider vers la création du vrai cycle.

## Décisions
- **Stepper** : écrans réellement traversés (`[1,2,3,4,5]` avec suivi, `[1,4,5]` sans) ; rang et
  total en découlent ; libellé accessible « Étape n sur N ». Migration : toujours pas d'indicateur.
- **Magasins** : `magasins?: string[]` (le 1er = principal) s'ajoute à `magasin?: string`, qui reste
  **toujours écrit = principal**. Aucune clé localStorage renommée, aucune migration d'écriture.
  - Lecture : `magasinsDe(x)` — `magasin` seul = liste d'un élément ; un `magasin` absent de la
    liste (modifié par un client ancien) passe en tête ; `magasins[]` illégal ignoré en bloc par
    `loadProfile` (le magasin unique survit).
  - Sync : profil (table `profiles`) et foyer (table `etat`) sont des payloads JSON opaques côté
    serveur → `server/` inchangé. Le schéma foyer tolère les champs inconnus : un client ancien
    ignore `magasins` et lit `magasin`. Un client ancien qui réécrit le foyer sans `magasins`
    est relu comme une liste d'un élément (rien ne casse, la liste fine se reconstitue au prochain
    enregistrement du Profil).
  - UI : composant `ChampMagasins` (puces présets + ajouts libres + saisie) dans l'onboarding et
    Profil › Courses & budget. Le texte saisi non ajouté est pris à l'enregistrement.
  - Prompt IA (`promptIa.ts`, partie magasins seulement) : un magasin = formulation inchangée ;
    plusieurs = « Magasins : A (principal), B, C — estime les prix chez A ; … indique la répartition
    par magasin dans `remarques` ». La dépense saisie dans Courses reste rattachée au principal.
- **Fin d'onboarding** : après « Ta semaine », sans cycle à soi, App ouvre Mon cycle directement
  sur l'étape « générer » (`vueInitiale="generer"`) : copier le prompt → coller dans ton IA →
  importer les 4 fichiers. Retour libellé « Plus tard » (vers l'app, cycle d'exemple).

## Hors périmètre
`cycle/types.ts`, `cycle/valider.ts` (autre chantier).
