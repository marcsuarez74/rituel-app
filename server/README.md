# Serveur de sync Rituel (VPS)

Mini-serveur Node (Hono + better-sqlite3) — API JSON + SSE, base `rituel.db` en
fichier unique (WAL). Spécification : `docs/superpowers/specs/2026-09-26-sync-vps-sqlite-design.md`.
Guide opérateur complet (création du foyer depuis l'app, migration, rotation) :
`docs/backend.md`.

Convention identique à Le Cahier (budget-app) : `/opt/rituel`, utilisateur
système dédié `rituel`, unit systemd commitée dans ce dossier, Caddy en
reverse proxy, backup cron.

## Local

```bash
cd server
npm ci
npm run check                       # typecheck + lint + tests (SQLite en mémoire)
npm run build && JWT_SECRET=dev DB_PATH=/tmp/rituel.db npm start   # :8787
```

## VPS (première installation — même machine que Le Cahier)

1. Node ≥ 22 (`node -v` — sinon installer Node 22, ex. NodeSource) ;
   utilisateur dédié sans shell :
   `sudo useradd -r -s /usr/sbin/nologin rituel`
2. Dépôt dans `/opt/rituel` (repo privé : même mécanique d'auth git que Le
   Cahier — deploy key ou token) ; base et backups dans l'arbre :
   ```bash
   sudo mkdir -p /opt/rituel/data /opt/rituel/backups
   sudo chown -R rituel:rituel /opt/rituel
   sudo -u rituel -H git clone https://github.com/marcsuarez74/rituel-app.git /opt/rituel
   ```
3. Secret JWT : `openssl rand -hex 32` → `/etc/rituel.env` (root-only) :
   ```bash
   sudo install -m 600 /dev/null /etc/rituel.env
   sudoedit /etc/rituel.env
   ```
   ```
   JWT_SECRET=<64 hex>
   PORT=8787
   DB_PATH=/opt/rituel/data/rituel.db
   CORS_ORIGINS=https://marcsuarez74.github.io,http://localhost:5173
   ```
4. Build :
   `cd /opt/rituel/server && sudo -u rituel -H npm ci && sudo -u rituel -H npm run build`
5. Unit systemd — commitée dans ce dossier (`rituel.service`) :
   ```bash
   sudo cp /opt/rituel/server/rituel.service /etc/systemd/system/
   sudo systemctl daemon-reload && sudo systemctl enable --now rituel
   ```
   Règle sudoers ciblée pour les déploiements suivants (visudo) :
   `rituel ALL=(root) NOPASSWD: /usr/bin/systemctl restart rituel`
6. Caddy — bloc site dans `/etc/caddy/Caddyfile` (le streaming SSE est géré
   par défaut) :
   ```
   rituel.marco-studio.fr {
       reverse_proxy 127.0.0.1:8787
   }
   ```
   puis `sudo systemctl reload caddy` — **indispensable si le certificat du
   sous-domaine a raté une première tentative** (ex. DNS pas encore pointé au
   moment du premier essai) : le reload relance immédiatement la demande ACME
   au lieu d'attendre le backoff.
7. **Backup** — cron quotidien + rétention 14 jours (`server/backup.sh`,
   online-backup better-sqlite3, copie transactionnellement cohérente) :
   `sudo crontab -u rituel -e` :
   ```cron
   15 4 * * * /opt/rituel/server/backup.sh
   ```
8. Déploiements suivants :
   `sudo -u rituel -H /opt/rituel/server/deploy.sh` (git pull, npm ci, build,
   restart).
