#!/usr/bin/env bash
# Backup quotidien de la base (cron root) : copie cohérente via l'API online-backup
# de SQLite, depuis le conteneur ; rétention 14 jours.
#   15 4 * * * /opt/rituel/deploy/backup.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/backups && chown 1000:1000 data/backups
docker compose exec -T app node -e \
  "require('better-sqlite3')(process.argv[1]).backup(process.argv[2]).then(() => process.exit(0))" \
  /app/data/rituel.db "/app/data/backups/rituel-$(date +%F).db"
find data/backups -name 'rituel-*.db' -mtime +14 -delete
