#!/usr/bin/env bash
# Déploiement automatique (VPS) : lancé toutes les 2 min par rituel-deploy.timer.
# Si main a avancé sur GitHub : pull, rebuild de l'image, redémarrage du conteneur.
# Forcer un déploiement : sudo /opt/rituel/deploy/deploy.sh --force
set -euo pipefail
cd "$(dirname "$0")/.."
git_() { runuser -u "$(stat -c %U .)" -- git "$@"; } # le dépôt appartient à l'utilisateur rituel

git_ fetch -q origin main
if [ "$(git_ rev-parse HEAD)" = "$(git_ rev-parse origin/main)" ] && [ "${1:-}" != "--force" ]; then
  exit 0
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
