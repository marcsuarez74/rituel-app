# Pipeline unique — plan (2026-10-08)

Spec : `docs/superpowers/specs/2026-10-08-pipeline-unique-design.md`.

1. Créer `pipeline.yml` (jobs build, image, unitaires, serveur, e2e, release, deploy) ; supprimer `ci.yml`, `publier.yml`, `deploiement.yml`. Validation : `actionlint`.
2. `deploy/deploy.sh` : contrôle du Deployment avant le merge, `--force` inchangé. Validation : `bash -n`, `shellcheck`, test de la requête sur un sha avec Deployment (contient `"sha"`) et sans (`[]`).
3. Docs : CLAUDE.md, AGENTS.md, README.md, server/README.md, commentaire de `playwright.config.ts`.
4. Gate : `npm test && npm run typecheck && npm run lint && npm run build`.
5. Après fusion : le premier déploiement tourne encore avec l'ancien `deploy.sh`.
