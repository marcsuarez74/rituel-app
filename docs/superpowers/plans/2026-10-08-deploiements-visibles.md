# Plan — Déploiements visibles (2026-10-08)

Spec : `docs/superpowers/specs/2026-10-08-deploiements-visibles-design.md`

1. TDD server : test `/sante` → `{ ok, commit }` (rouge), option `commit` de `creerApp`, `APP_COMMIT` dans `index.ts` (vert).
2. Dockerfile `ARG GIT_SHA` → `ENV APP_COMMIT` ; compose `build.args` ; `deploy.sh` (après la ligne du merge uniquement).
3. Workflow `deploiement.yml`.
4. Docs CLAUDE.md / AGENTS.md ; gate complet ; PR.
