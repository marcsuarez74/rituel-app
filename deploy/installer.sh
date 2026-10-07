#!/usr/bin/env bash
# Bascule UNIQUE du VPS : service systemd « rituel » (API seule) → conteneur Docker
# (PWA + API) avec déploiement automatique. À lancer une fois, en root :
#   sudo bash /opt/rituel/deploy/installer.sh
# Garde la même base (/opt/rituel/data/rituel.db), le même port (8787) : Caddy ne change pas.
# Retour arrière : docker compose down && systemctl enable --now rituel
set -euo pipefail
DIR=/opt/rituel
cd "$DIR"
PROPRIO=$(stat -c %U .)

echo "1/6 Mise à jour du dépôt"
runuser -u "$PROPRIO" -- git pull -q --ff-only origin main

echo "2/6 Secrets (.env, jamais commité)"
if [ ! -f .env ]; then
  grep -E '^(JWT_SECRET|CORS_ORIGINS)=' /etc/rituel.env > .env
  chmod 600 .env
fi
grep -q '^JWT_SECRET=' .env || { echo "JWT_SECRET absent de /etc/rituel.env" >&2; exit 1; }

echo "3/6 Arrêt de l'ancien service + copie de sécurité de la base"
if systemctl is-enabled --quiet rituel 2>/dev/null || systemctl is-active --quiet rituel 2>/dev/null; then
  systemctl disable --now rituel
fi
mkdir -p backups
cp -a data/rituel.db "backups/rituel-avant-docker-$(date +%F-%H%M).db"
for f in data/rituel.db-wal data/rituel.db-shm; do [ -f "$f" ] && cp -a "$f" backups/; done
chown -R 1000:1000 data

echo "4/6 Build et démarrage du conteneur"
docker compose up -d --build
for _ in $(seq 1 60); do
  curl -fsS http://127.0.0.1:8787/sante >/dev/null 2>&1 && break
  sleep 2
done
curl -fsS http://127.0.0.1:8787/sante >/dev/null || {
  echo "Le conteneur ne répond pas : retour à l'ancien service" >&2
  docker compose logs --tail 50 app >&2
  docker compose down
  systemctl enable --now rituel
  exit 1
}

echo "5/6 Déploiement automatique (timer systemd, toutes les 2 min)"
cp deploy/rituel-deploy.service deploy/rituel-deploy.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now rituel-deploy.timer

echo "6/6 Backup quotidien (cron root, 4h15)"
( crontab -l 2>/dev/null | grep -v 'rituel.*backup.sh'; echo "15 4 * * * $DIR/deploy/backup.sh" ) | crontab -
crontab -u "$PROPRIO" -l 2>/dev/null | grep -v 'backup.sh' | crontab -u "$PROPRIO" - || true

echo "Terminé : https://rituel.marco-studio.fr sert maintenant l'app et l'API."
