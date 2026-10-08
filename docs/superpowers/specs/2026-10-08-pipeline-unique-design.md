# Pipeline unique et déploiement conditionnel — spec (2026-10-08)

**Problème** : trois workflows (`ci.yml`, `publier.yml`, `deploiement.yml`) sans lien visible entre eux ; le VPS déploie chaque `main` même si la CI est rouge.

**Décision** :
- Un seul `.github/workflows/pipeline.yml` (`Pipeline`) : `build` (lint, typecheck, build, artifact `dist/`) · `image` (docker build) · `unitaires` · `serveur` · `e2e` (`needs: build`, `npm run e2e:preview` sert `dist/` sans rebuild) → `release` (release-please) et `deploy` (Deployment `production` + sondage `/sante`), tous deux sur push `main` uniquement et `needs` de tous les jobs précédents.
- Concurrency par ref ; annulation seulement sur PR (jamais sur main : un Deployment resterait `in_progress`).
- **Déploiement conditionnel sans secret** : le Deployment n'est créé qu'après CI verte ; `deploy/deploy.sh` ne déploie `origin/main` que si `GET /repos/.../deployments?environment=production&sha=<sha>` (API publique) contient `"sha"`. `[]` ou erreur réseau/API → `exit 0`, le timer réessaie. `--force` contourne. Contrôle seulement si HEAD ≠ origin/main (≤ 30 req/h pour 60 permises sans auth).

**Contrainte** : `git merge` remplace `deploy.sh` (nouvel inode) ; bash finit l'ancienne version. Le nouveau comportement ne s'applique qu'au déploiement suivant la fusion.
