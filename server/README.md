# Serveur de sync Rituel (VPS)

Mini-serveur Node (Hono + better-sqlite3) — API JSON + SSE, base `rituel.db` en
fichier unique (WAL). Spécification : `docs/superpowers/specs/2026-09-26-sync-vps-sqlite-design.md`.
Guide opérateur complet (création du foyer depuis l'app, migration, rotation) :
`docs/backend.md`.

## Local

```bash
cd server
npm ci
npm run check                       # typecheck + lint + tests (SQLite en mémoire)
npm run build && JWT_SECRET=dev DB_PATH=/tmp/rituel.db npm start   # :8787
```

## VPS (première installation)

1. Node ≥ 22 (`node -v`) ; utilisateur dédié sans shell :
   `sudo useradd -r -s /usr/sbin/nologin rituel`
2. Dépôt dans `/srv/rituel` ; base et backups dans `/var/lib/rituel/` :
   `sudo mkdir -p /var/lib/rituel && sudo chown rituel:rituel /var/lib/rituel`
   `sudo mkdir -p /var/lib/rituel/backups && sudo chown rituel:rituel /var/lib/rituel/backups`
3. Secret JWT : `openssl rand -hex 32` → `/etc/rituel.env` (root-only) :
   ```
   JWT_SECRET=<64 hex>
   PORT=8787
   DB_PATH=/var/lib/rituel/rituel.db
   CORS_ORIGINS=https://marcsuarez74.github.io,http://localhost:5173
   ```
4. Build : `cd /srv/rituel/server && npm ci && npm run build`
5. `/etc/systemd/system/rituel-api.service` :
   ```ini
   [Unit]
   Description=Rituel API (sync SQLite)
   After=network.target

   [Service]
   Type=simple
   User=rituel
   WorkingDirectory=/srv/rituel/server
   EnvironmentFile=/etc/rituel.env
   ExecStart=/usr/bin/node dist/index.js
   Restart=always
   RestartSec=3

   [Install]
   WantedBy=multi-user.target
   ```
   puis `sudo systemctl daemon-reload && sudo systemctl enable --now rituel-api`.
6. Reverse proxy — sous-domaine `rituel.marco-studio.fr` :
   - **nginx** :
     ```nginx
     location / {
         proxy_pass http://127.0.0.1:8787;
         proxy_http_version 1.1;
         proxy_set_header Connection "";
         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
         proxy_buffering off;            # indispensable pour le SSE
         proxy_read_timeout 3600s;
     }
     ```
   - **Caddy** (le streaming SSE est géré par défaut) :
     ```
     rituel.marco-studio.fr {
         reverse_proxy 127.0.0.1:8787
     }
     ```
7. **Backup** — cron quotidien + rétention 14 jours :
   ```cron
   15 4 * * * sqlite3 /var/lib/rituel/rituel.db ".backup /var/lib/rituel/backups/rituel-$(date +\%F).db" && find /var/lib/rituel/backups -name 'rituel-*.db' -mtime +14 -delete
   ```
8. Déploiements suivants : `./deploy.sh` (git pull, npm ci, build, restart).
