#!/usr/bin/env bash
# Backup quotidien de la base de sync (cron de l'utilisateur rituel) :
#   15 4 * * * /opt/rituel/server/backup.sh
set -euo pipefail
# Copie transactionnellement cohérente : API online-backup de SQLite via
# better-sqlite3 (déjà installé côté serveur). Un simple cp de la base en WAL
# peut capturer un fichier principal non checkpointé (pages encore dans -wal).
DEST=/opt/rituel/backups
mkdir -p "$DEST"
node -e "require('/opt/rituel/server/node_modules/better-sqlite3')(process.argv[1]).backup(process.argv[2])" \
  /opt/rituel/data/rituel.db "$DEST/rituel-$(date +%F).db"
find "$DEST" -name 'rituel-*.db' -mtime +14 -delete
