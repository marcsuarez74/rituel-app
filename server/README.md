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
  toutes les 2 min ; si `main` a avancé **et** qu'un Deployment GitHub `production` existe
  pour ce commit (créé par le job `deploy` du Pipeline après CI verte ; API publique sans
  auth, 30 req/h max sur les 60 permises, erreur réseau = pas de déploiement) : `git pull`,
  `docker compose build`, `up -d`, vérification de `/sante`. Forcer, sans contrôle :
  `sudo /opt/rituel/deploy/deploy.sh --force`. `git merge` remplace `deploy.sh` (nouvel
  inode) : bash finit l'ancienne version, une modif du script n'agit qu'au déploiement suivant.
  Journal : `journalctl -u rituel-deploy -n 50`.
- **Backup** : cron root `15 4 * * * /opt/rituel/deploy/backup.sh` (online-backup
  SQLite depuis le conteneur, `data/backups/`, rétention 14 jours).
- **Santé** : `curl -s http://127.0.0.1:8787/sante` → `{"ok":true}`.

### Signaler un bug (issues GitHub)

`POST /bugs` (foyer connecté, 3 signalements réussis par jour et par foyer) crée une
issue sur le dépôt public `marcsuarez74/rituel-app`. Le jeton GitHub ne quitte jamais
le serveur et n'est jamais loggé. Sans jeton, la route répond 503.

1. Créer un **fine-grained personal access token** limité au seul dépôt
   `rituel-app`, permission **Issues : Read and write** (rien d'autre).
2. Le placer dans le `.env` à côté du `docker-compose.yml` sur le VPS (jamais dans le
   dépôt) : `GITHUB_BUG_TOKEN=<jeton>` ; `GITHUB_REPO` est facultatif (défaut
   `marcsuarez74/rituel-app`). Puis `docker compose up -d`.
3. Les labels `bug` / `amélioration` sont passés à la création de l'issue ; s'ils
   n'existent pas, les créer une fois dans le dépôt (GitHub > Issues > Labels).

Les captures facultatives (PNG/JPEG/WebP, 5 Mo max) sont écrites dans `data/bugs/` (volume
`./data`) et servies par `GET /bugs/capture/<uuid>.<ext>` pour être liées dans l'issue.
Elles ne sont écrites qu'une fois la validation, le quota et le jeton vérifiés, et
supprimées si GitHub refuse.

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
