# Sync VPS + SQLite — design

**Date :** 2026-09-26 · **Statut :** validé en brainstorming (3 sections approuvées) · **Remplace :** `2026-09-16-sync-supabase-design.md`

## 1. Contexte et objectif

La sync repose aujourd'hui sur Supabase (Postgres + RLS + realtime + edge functions
+ pg_cron). Marc héberge déjà un VPS (Node + SQLite, ex. `budget.marco-studio.fr`)
et veut **rapatrier le backend chez lui** :

- une **base SQLite légère** (un fichier) à la place de Postgres ;
- un **mini-serveur Node** sur son VPS, même esprit que son app budget ;
- la **création du foyer depuis l'app** (code d'invitation permanent) — fini le
  script CLI + service_role_key ;
- la **suppression totale des notifications push** (VAPID, edge functions, pg_cron).

La posture produit ne change pas : les données vivent d'abord dans le téléphone,
le serveur est un miroir, l'app reste 100 % utilisable sans lui. La sync reste
**optionnelle au build** : sans `VITE_SYNC_URL`, aucun code réseau n'est chargé.

## 2. Décisions validées

| Sujet | Décision |
|---|---|
| Stack serveur | Node TypeScript maison, dossier `server/` du même repo — Hono (micro-framework) + better-sqlite3, JWT HS256 via `node:crypto` |
| Notifications push | **Retirées entièrement** de l'app (front, SW, tests, serveur, docs) |
| Temps réel | **SSE** (fetch-based, token en en-tête) — sync ~1 s comme aujourd'hui |
| Foyer | **Code d'invitation permanent** créé depuis l'app (phrase « mots d'herbes + 8 hex », même générateur que l'ancien script) |
| Nombre de foyers | **Multi-foyer** (une row `foyers` par foyer) |
| Ops | Sous-domaine dédié (ex. `rituel.marco-studio.fr`) + reverse proxy existant + **systemd** ; backup cron SQLite |
| Migration données | **Re-jumelage des téléphones** — la fusion union existante repousse le localStorage vers SQLite ; pas de dump Supabase |

## 3. Serveur (`server/`, hors tsconfig app comme `supabase/`)

### 3.1 Schéma SQLite (`rituel.db`, mode WAL)

```sql
create table foyers (
  id text primary key,            -- uuid (crypto.randomUUID)
  code_hash text not null unique, -- PBKDF2-SHA256, 100 000 itérations
  rev integer not null default 0, -- compteur de changements (SSE)
  created_at text not null
);
create table weeks    (foyer_id text not null references foyers on delete cascade,
                       semaine text not null, payload text not null, updated_at text not null,
                       primary key (foyer_id, semaine));
create table checks   (foyer_id text not null references foyers on delete cascade,
                       semaine text not null, check_id text not null, done integer not null,
                       updated_at text not null, primary key (foyer_id, semaine, check_id));
create table weights  (foyer_id text not null references foyers on delete cascade,
                       profil text not null, date_ text not null, kg real not null,
                       updated_at text not null, primary key (foyer_id, profil, date_));
create table depenses (foyer_id text not null references foyers on delete cascade,
                       date_ text not null, magasin_key text not null, magasin text not null,
                       total real not null, updated_at text not null,
                       primary key (foyer_id, date_, magasin_key));
create table profiles (foyer_id text not null references foyers on delete cascade,
                       profil text not null, payload text not null, updated_at text not null,
                       primary key (foyer_id, profil));
```

Différences assumées vs Supabase : JSON en `text` (SQLite), `foyer_id` au lieu de
`household_id` (nouvelle base, pas de legacy), pas de RLS (le serveur filtre par
le JWT), pas de publication realtime. Les noms de colonnes métier (`semaine`,
`check_id`, `date_`, `magasin_key`, `profil`, `payload`, `done`, `kg`, `total`,
`magasin`) sont **identiques** à l'actuel — les rows échangées avec l'app gardent
la même forme, `appliquerRemote` ne voit aucune différence.

### 3.2 API (JSON, `Authorization: Bearer <token>`)

| Route | Auth | Rôle |
|---|---|---|
| `POST /foyers` | — (rate-limit IP) | Créer un foyer : `{ code }` → `201 { foyerId }`. Plancher 12 caractères, hash PBKDF2. Refus 409 si code déjà pris |
| `POST /connexion` | — (rate-limit IP) | `{ code }` → `200 { token, foyerId }` ou `401`. Token = JWT HS256, `exp` 365 j, claim `foyerId` |
| `GET /sync/:table` | Bearer | Rows de la table pour le foyer du token (5 tables : `weeks`, `checks`, `weights`, `depenses`, `profiles`) |
| `POST /sync/:table` | Bearer | Upsert des rows de cette table (shape identique à l'actuel : clés métier + payload + `updated_at`). Le `household_id` éventuellement stampé par l'engine est **ignoré** — le serveur fait foi avec son token. Incrémente `rev` |
| `DELETE /sync/:table` | Bearer | Deletes par clés métier (`{ clefs: [...] }`). Incrémente `rev` |
| `DELETE /sync` | Bearer | Purge des 5 tables du foyer (le foyer et son code survivent — même sémantique qu'aujourd'hui). Incrémente `rev` |
| `GET /evenements` | Bearer | **SSE** : flux ouvert par appareil ; toute mutation/purge du foyer diffuse `event: changement` + `data: {"rev":N}` ; heartbeat `: ping` toutes les 25 s |

- **Erreurs** : 401 token absent/expiré/invalide ; 400 payload illégal (jamais de
  crash — réponse JSON `{ erreur }`) ; 404 table inconnue.
- **CORS** : liste blanche `https://marcsuarez74.github.io` + `http://localhost:5173`
  (surchargeable via `CORS_ORIGINS`, séparé par virgules).
- **Rate-limit** : fenêtre glissante en mémoire (~10 req/min/IP sur `/connexion`
  et `/foyers`) — suffisant, pas de dépendance.

### 3.3 SSE et auth du flux

`EventSource` ne sait pas poser d'en-tête `Authorization` → le client utilise un
**lecteur SSE basé sur `fetch`** (`ReadableStream` + `TextDecoder`, ~40 lignes) :
token en en-tête, rien dans les logs proxy. La reconnexion n'est pas gérée dans
le lecteur : sur coupure il émet `onStatut(false)`, et c'est `engine.ts`
(`planifierReconnexion`, 5 s) qui réappelle `abonner()` — mécanisme existant
inchangé. `rev` n'est pas exploité finement (le pull ramène tout) : il sert
d'info de debug et réserve un delta futur.

### 3.4 Organisation

```
server/
  package.json        # hono, better-sqlite3 ; devDeps : vitest, typescript, @types
  tsconfig.json       # strict, même règles que l'app
  src/
    index.ts          # bootstrap Hono, env (PORT, JWT_SECRET, CORS_ORIGINS, DB_PATH)
    db.ts             # ouverture SQLite (WAL, foreign_keys ON), migrations inline
    auth.ts           # hash/vérif PBKDF2, signature/vérif JWT HS256 (node:crypto)
    routes.ts         # /foyers, /connexion, /sync, /sync/:table, /evenements
    sse.ts            # registre des flux par foyer, diffusion, heartbeat
    rate-limit.ts
  test/               # vitest, SQLite en mémoire
  deploy.sh           # git pull, npm ci, build, systemctl restart
```

## 4. Client front

- **Config** (`sync/config.ts`) : une var `VITE_SYNC_URL` ; `syncActif()` = URL
  présente. `@supabase/supabase-js` retiré de `package.json`.
- **`client.ts` réécrit** : implémente le port `SyncClient` existant avec `fetch`
  + lecteur SSE. **`engine.ts`, `outbox.ts`, `storage.ts` : zéro modification**
  (l'engine stamp `household_id`/`updated_at` dans les rows — le serveur ignore ;
  le port `supprimer`/`toutLire`/`purger` garde sa signature).
- **`session.ts`** : `demanderSession(code)` appelle `POST /connexion` du VPS.
  401 token expiré → exception → état `erreur` (comportement actuel) ; la
  reconnexion se fait avec le code permanent via le formulaire existant.
- **UX Profil → Synchronisation** :
  - bouton « **Créer un foyer** » → `POST /foyers` → le code est affiché une
    fois avec « Copier » et l'avertissement *« Notez ce code : il n'est pas
    stocké en clair »* ;
  - « **Rejoindre un foyer** » (saisie du code, existant), « Se déconnecter »,
    « Supprimer les données du foyer » : inchangés ;
  - note de posture : « Données synchronisées sur votre serveur
    (rituel.marco-studio.fr). »
  - l'onboarding (étape sync) garde uniquement « Rejoindre » ; la création passe
    par le Profil.
- **Bannière** : le point de sync (état + tap réparateur) reste tel quel.

## 5. Retrait des notifications push

Inventaire de suppression :

- `src/lib/push/` + `enregistrerSurEnvoye`/`surEnvoye` dans `engine.ts` (plus de
  consommateur — petit retrait documenté, seul écart à « engine intact ») ;
- page **Notifications** du hub Profil + sa tuile + e2e associés (si des éléments
  non-push y vivent — ex. « Alerte partagée » — les déménager avant retrait) ;
- handlers push du service worker (`sw.ts`), env `VITE_VAPID_PUBLIC_KEY`,
  secrets GitHub `VITE_*` liés ;
- tests push (unitaires + e2e) ;
- `supabase/functions/push-*`, migration `0002`, section push de `docs/backend.md`.

Le point de sync de la bannière et le bloc Synchronisation du Profil restent
(sync ≠ push).

## 6. Migration des données (re-jumelage)

Les téléphones sont la source primaire ; Supabase n'est qu'un miroir.

1. **Avant tout** : vérifier les 2 téléphones « Synchronisé » sur Supabase
   (Supabase devient la copie de secours).
2. Nouveau build avec `VITE_SYNC_URL` → déploiement Pages → les PWA se mettent à
   jour.
3. Téléphone A : Profil → « Créer un foyer » → noter le code. Téléphone B :
   « Rejoindre ».
4. La **fusion union existante** (`pousserTout` → merge outbox-prime → flush)
   repousse l'état local complet de chaque téléphone dans SQLite.
5. L'ancienne session Supabase (`sportapp:sync:token`) devient invalide avec le
   nouveau client : jusqu'au re-jumelage, l'app affiche `erreur`/formulaire de
   connexion — l'étape 3 la remplace d'abord (`demanderSession` réécrit la
   session).
6. Projet Supabase : mis en pause puis supprimé après vérification.

**Découpage suggéré en 2 PR indépendantes** : (1) retrait des push (aucun lien
avec le VPS, déployable seul) ; (2) serveur + client + migration.

## 7. Déploiement VPS

- Sous-domaine `rituel.marco-studio.fr` → reverse proxy existant (snippets Caddy
  **et** nginx fournis dans `server/README.md` ; SSE : désactiver le buffering —
  nginx `proxy_buffering off`, Caddy le gère par défaut en streaming).
- **systemd** `rituel-api.service` : `EnvironmentFile=/etc/rituel.env`
  (`JWT_SECRET`, `PORT`, `DB_PATH`, `CORS_ORIGINS`), `Restart=always`, utilisateur
  dédié sans shell, `WorkingDirectory=/srv/rituel/server`.
- BDD `/var/lib/rituel/rituel.db` (WAL). **Backup** : cron quotidien
  `sqlite3 rituel.db ".backup …"` + rétention 14 jours.
- Déploiement : `server/deploy.sh` (git pull, npm ci, build, restart).
- CI : étape ajoutée `npm ci && npm run check` dans `server/` (typecheck + lint +
  test — rapides, better-sqlite3 précompilé) ; la CI app reste inchangée.
- Node ≥ 20 sur le VPS (vérifier `node -v`).

## 8. Tests (TDD)

- **Serveur** (vitest + SQLite en mémoire) : création foyer (code court refusé,
  doublon 409, hash PBKDF2), connexion (code faux 401, token vérifié, claim
  foyerId), `POST /sync/:table` (upsert, `household_id` du body ignoré),
  `DELETE /sync/:table` (deletes par clés), `GET /sync/:table` (isolation par
  foyer), purge (cascade, foyer conservé), 401 (token expiré, mauvais secret),
  SSE (event reçu par l'autre appareil du foyer, rien pour un autre foyer,
  heartbeat), rate-limit.
- **Front** : `tests/sync/` adaptés au mock de `config` (une var au lieu de deux)
  ; nouveaux tests du lecteur SSE (statut ouvert/fermé, event → pull debouncé).
- **E2e** : specs sync existantes conservées (session mockée en localStorage) ;
  spec notifications supprimée.

## 9. Sécurité

- Code foyer : PBKDF2-SHA256 100 000 itérations, jamais en clair (identique à
  l'actuel).
- `JWT_SECRET` : `openssl rand -hex 32`, uniquement dans `/etc/rituel.env`.
- CORS en liste blanche ; HTTPS imposé par le proxy ; cookies absents (Bearer
  uniquement).
- Le serveur ne stocke rien de plus que Supabase (mêmes tables, moins les push) ;
  journaux sans payload.

## 10. Hors périmètre (non-goals)

- Héberger la PWA elle-même sur le VPS (reste GitHub Pages) ;
- changer le modèle de données ou les règles de merge (engine/outbox intacts) ;
- invitations jetables, rotation de code UI, multi-utilisateur par foyer (ids
  `marc`/`melanie` inchangés) ;
- `node:sqlite` natif (réévalué plus tard si envie de zéro dep).

## 11. Docs à mettre à jour

- `docs/backend.md` : réécrit pour le VPS (setup serveur, création foyer depuis
  l'app, rotation — supprimer la row `foyers`, re-jumelage) ;
- `AGENTS.md` : structure (`server/` remplace `supabase/`), commandes (`npm run
  server:test` ou équivalent), clés storage inchangées ;
- `CHANGELOG.md` : entrée à la release (renommage de section avant bump).

---

Spec relue une fois (pas de TBD, cohérence API/port vérifiée, périmètre unique).
Prochaine étape : plan d'implémentation via `writing-plans`.
