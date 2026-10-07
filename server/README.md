# Serveur Rituel (VPS)

Mini-serveur Node (Hono + better-sqlite3) : **sert la PWA buildée et l'API de
sync** (JSON + SSE) sur la même origine, https://rituel.marco-studio.fr. Base
`rituel.db` en fichier unique (WAL). Spécification de la sync :
`docs/superpowers/specs/2026-09-26-sync-vps-sqlite-design.md` ; guide opérateur
(foyer, rotation du code) : `docs/backend.md`.

## Local

```bash
cd server
npm ci
npm run check                       # typecheck + lint + tests (SQLite en mémoire)
npm run build && JWT_SECRET=dev DB_PATH=/tmp/rituel.db npm start   # API seule, :8787
# avec la PWA : (cd .. && npm run build) puis STATIC_DIR=../dist en plus
```

## Production : un conteneur Docker

À la racine du dépôt : `Dockerfile` (PWA + serveur, `node:22-alpine`, utilisateur
`node`), `docker-compose.yml` (`127.0.0.1:8787`, volume `./data`, secrets dans
`.env`), `deploy/` (scripts VPS).

- **Dossier** : `/opt/rituel` (clone du dépôt, propriétaire `rituel`) ; base
  `/opt/rituel/data/rituel.db` ; `.env` (non commité) : `JWT_SECRET`,
  `CORS_ORIGINS`.
- **Caddy** : `rituel.marco-studio.fr { reverse_proxy 127.0.0.1:8787 }` (SSE géré
  par défaut).
- **Déploiement automatique** : `rituel-deploy.timer` lance `deploy/deploy.sh`
  toutes les 2 min ; si `main` a avancé : `git pull`, `docker compose build`,
  `up -d`, vérification de `/sante`. Forcer : `sudo /opt/rituel/deploy/deploy.sh --force`.
  Journal : `journalctl -u rituel-deploy -n 50`.
- **Backup** : cron root `15 4 * * * /opt/rituel/deploy/backup.sh` (online-backup
  SQLite depuis le conteneur, `data/backups/`, rétention 14 jours).
- **Santé** : `curl -s http://127.0.0.1:8787/sante` → `{"ok":true}`.

### Mise en place (une fois)

Depuis l'ancien service systemd `rituel` (API seule) :

```bash
sudo bash -c 'cd /opt/rituel && runuser -u rituel -- git pull --ff-only origin main && bash deploy/installer.sh'
```

`deploy/installer.sh` : secrets `/etc/rituel.env` → `.env`, arrêt de l'ancien
service, copie de sécurité de la base (`backups/`), build + démarrage du conteneur
(retour automatique à l'ancien service s'il ne répond pas), timer de déploiement,
cron de backup. Même base, même port : Caddy ne change pas.

Retour arrière manuel : `cd /opt/rituel && docker compose down && sudo systemctl enable --now rituel`.
