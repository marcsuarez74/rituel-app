#!/usr/bin/env bash
# Déploiement sur le VPS (lancé depuis /srv/rituel) : pull, install, build, restart.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
cd server
npm ci
npm run build
sudo systemctl restart rituel-api
