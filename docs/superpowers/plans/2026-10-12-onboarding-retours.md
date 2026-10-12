# Onboarding — retours test utilisateur — plan (2026-10-12)

Spec : `docs/superpowers/specs/2026-10-12-onboarding-retours-design.md`. TDD à chaque tâche.

1. Stepper : test rouge (points allumés / total / « Étape n sur N » en routine seule et avec suivi) → calcul sur les écrans visibles.
2. Modèle magasins : `magasinsDe` / `champsMagasins` / `avecMagasin` (model), lecture tolérante (`loadProfile`), schéma foyer, `foyerParDefaut`.
3. Prompt IA : bloc COURSES multi-magasins.
4. UI : `ChampMagasins` (onboarding, Profil), résumé Maison, propagation Profil → foyer (App).
5. Fin d'onboarding : `MonCycle` `vueInitiale`, enchaînement App, libellés des 3 étapes.
6. E2E : parcours routine seule à 320/375 (stepper, multi-magasins, arrivée Mon cycle), specs existantes adaptées.
7. Gate : test, typecheck, lint, build, e2e, e2e:preview.
