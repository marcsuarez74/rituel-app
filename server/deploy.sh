#!/usr/bin/env bash
# Déploiement sur le VPS (dans /opt/rituel), en miroir de Le Cahier :
# `sudo -u rituel -H /opt/rituel/server/deploy.sh`
# Règle sudoers ciblée (visudo) : `rituel ALL=(root) NOPASSWD: /usr/bin/systemctl restart rituel`
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
cd server
npm ci
npm run build
sudo systemctl restart rituel
systemctl --no-pager status rituel | head -5
