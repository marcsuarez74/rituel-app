#!/usr/bin/env bash
# Déploiement automatique (VPS) : lancé toutes les 2 min par rituel-deploy.timer.
# Si main a avancé sur GitHub : pull, rebuild de l'image, redémarrage du conteneur.
# Déploiement conditionnel : on ne déploie origin/main que si un Deployment « production »
# existe pour ce commit (créé par le job deploy du Pipeline, donc CI verte). API publique,
# sans auth ; limite 60 req/h : le contrôle n'a lieu que si HEAD ≠ origin/main (≤ 30/h).
# Forcer (sans contrôle) : sudo /opt/rituel/deploy/deploy.sh --force
# Note : `git merge` remplace ce fichier (nouvel inode) ; bash finit d'exécuter l'ANCIENNE
# version, une modification n'agit donc qu'au déploiement suivant.
set -euo pipefail
cd "$(dirname "$0")/.."
git_() { runuser -u "$(stat -c %U .)" -- git "$@"; } # le dépôt appartient à l'utilisateur rituel

git_ fetch -q origin main
if [ "$(git_ rev-parse HEAD)" = "$(git_ rev-parse origin/main)" ] && [ "${1:-}" != "--force" ]; then
  exit 0
fi
if [ "${1:-}" != "--force" ]; then
  cible=$(git_ rev-parse origin/main)
  if ! reponse=$(curl -fsS --max-time 15 \
    "https://api.github.com/repos/marcsuarez74/rituel-app/deployments?environment=production&sha=$cible"); then
    echo "API GitHub injoignable : pas de déploiement de ${cible:0:7} (nouvel essai au prochain passage)"
    exit 0
  fi
  # [] = pas encore de Deployment (CI en cours ou rouge) : le timer réessaie dans 2 min.
  case "$reponse" in
    *'"sha"'*) ;;
    *) exit 0 ;;
  esac
fi
echo "Déploiement de $(git_ rev-parse --short origin/main)…"
git_ merge -q --ff-only origin/main
GIT_SHA=$(git_ rev-parse HEAD) docker compose build -q
# l'app tourne en utilisateur node (uid 1000) : data/ doit lui appartenir
chown -R 1000:1000 data
docker compose up -d
docker image prune -f >/dev/null
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8787/sante >/dev/null 2>&1; then
    echo "OK : $(git_ log -1 --format='%h %s')"
    exit 0
  fi
  sleep 2
done
echo "ERREUR : /sante ne répond pas après le déploiement" >&2
docker compose logs --tail 50 app >&2
exit 1
