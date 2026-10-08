# Déploiements visibles sur GitHub — spec (2026-10-08)

**Problème** : le VPS déploie en pull (`deploy/deploy.sh`), GitHub n'en sait rien : pas d'historique de déploiements ni de statut réel.

**Décision** : rendre le commit déployé lisible publiquement, puis laisser GitHub l'observer.

- `/sante` renvoie `{ ok: true, commit }` ; `commit` = `APP_COMMIT` (build arg `GIT_SHA`, passé par `deploy.sh` à `docker compose build`), `inconnu` si absent. La version n'est pas exposée (le `package.json` racine n'est pas dans l'image finale).
- `.github/workflows/deploiement.yml` (push sur `main` + manuel) crée un Deployment `production`, statut `in_progress`, puis sonde `/sante` toutes les 15 s pendant 12 min : succès si le commit servi = `github.sha` ou en est un descendant (compare API, `ahead`), sinon échec avec résumé de job.
- Aucun secret sur le VPS ; pas de `concurrency` annulante (un run annulé laisserait un Deployment `in_progress`).

**Contrainte** : `deploy.sh` est relu par bash pendant que `git merge` le réécrit — seules les lignes après le merge changent.
