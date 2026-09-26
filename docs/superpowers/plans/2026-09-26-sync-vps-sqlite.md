# Sync VPS + SQLite (serveur + client + migration) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** remplacer le backend Supabase par un mini-serveur Node (Hono + better-sqlite3) hébergé sur le VPS de Marc — API JSON + SSE, création du foyer depuis l'app, temps réel ~1 s — et brancher le client front dessus sans toucher à l'engine/outbox.

**Architecture :** un dossier `server/` autonome (hors tsconfig app, comme `supabase/`) exposant `POST /foyers`, `POST /connexion`, `GET/POST/DELETE /sync/:table`, `DELETE /sync`, `GET /evenements` (SSE). Le front garde le port `SyncClient` à l'identique : `config.ts` + `session.ts` + `client.ts` basculent ensemble sur `VITE_SYNC_URL` (fetch natif + lecteur SSE), le bloc Foyer du Profil gagne « Créer un foyer ». `engine.ts`, `outbox.ts`, `storage.ts` : **zéro modification**.

**Tech Stack :** Node ≥ 20, Hono v4 + `@hono/node-server` + better-sqlite3 (WAL), JWT HS256 et PBKDF2 via `node:crypto` (zéro autre dépendance), vitest (serveur : SQLite en mémoire ; front : fetch/SSE stubbés), SQLite en fichier unique côté prod.

**Spec :** `docs/superpowers/specs/2026-09-26-sync-vps-sqlite-design.md` — ce plan implémente les sections 3 (serveur), 4 (client), 7 (déploiement), 8 (tests), 9 (sécurité), 11 (docs). **Prérequis :** la PR « Retrait des notifications push » (`docs/superpowers/plans/2026-09-26-retrait-push.md`) doit être mergée avant de commencer (le hook `surEnvoye` n'existe plus dans `engine.ts`).

## Global Constraints

- Branche : `feat/sync-vps-sqlite` depuis `main` — 1 PR. Le serveur est **déployable indépendamment** (le front ne l'utilise qu'avec `VITE_SYNC_URL`).
- **Zéro modification** : `src/lib/sync/engine.ts`, `src/lib/sync/outbox.ts`, `src/lib/storage.ts`, la bannière (point de sync + tap réparateur), l'onboarding (étape 6 « Rejoindre » uniquement, déjà en place), les clés storage (`sportapp:sync:token`, `sportapp:sync:foyer`, `sportapp:sync:outbox`, etc.).
- Port `SyncClient` **inchangé** : `upsert(table, rows)`, `supprimer(table, clefs)`, `toutLire(table)`, `purger()`, `abonner(onEvenement, onStatut?) => désabonnement`. `RowSync = Record<string, unknown>`.
- Config : une seule var `VITE_SYNC_URL` ; `syncActif() = !!SYNC_URL` ; sans elle l'app reste 100 % locale (aucune requête réseau — gate `syncActif()` de l'engine inchangée).
- Serveur : JWT HS256 (`exp` 365 j, claim `foyerId`) ; code foyer PBKDF2-SHA256 **100 000 itérations**, jamais stocké en clair, plancher **12 caractères** ; rate-limit glissant **~10 req/min/IP** sur `/connexion` et `/foyers` ; CORS liste blanche par défaut `https://marcsuarez74.github.io` + `http://localhost:5173` (surchargeable `CORS_ORIGINS`, séparé par virgules) ; SSE : `event: changement` + `data: {"rev":N}`, heartbeat `: ping` toutes les **25 s** ; SQLite mode WAL, `foreign_keys = ON`.
- Multi-foyer (une row `foyers` par foyer) ; `DELETE /sync` purge les 5 tables **mais le foyer et son code survivent** ; erreurs JSON `{ erreur }` — jamais de crash ; 401 token absent/expiré/invalide ; 404 table inconnue ; 400 payload illégal.
- API shapes (contrat client↔serveur, cf. Task 5) : `POST /sync/:table` body `{ rows: [...] }` ; `DELETE /sync/:table` body `{ clefs: [...] }` ; `GET /sync/:table` réponse `{ rows: [...] }` — rows portent les clés métier (`semaine`, `check_id`, `date_`, `magasin_key`, `profil`) + colonnes (`payload` **objet** JSON, `done` **booléen**, `kg`/`total` nombres, `magasin` texte) + `updated_at`. Le `household_id` stampé par l'engine dans les rows est **ignoré** par le serveur.
- TypeScript strict partout ; exports nommés (pas de default) ; `server/` exclu du tsconfig/lint/vitest de l'app (il a les siens) ; textes UI en français.
- Avant tout commit : `npm test && npm run typecheck && npm run lint && npm run build` (appelé **« gate »**) — et pour les tâches serveur, en plus `cd server && npm run check`.
- Dépendances front : **aucune nouvelle** (`@supabase/supabase-js` est retirée). Dépendances serveur : `hono`, `@hono/node-server`, `better-sqlite3` uniquement.
- Tout passe par une PR, CI verte avant merge ; jamais de push direct sur `main`.

## Review Focus

Les façons dont ce système peut mordre un utilisateur réel que les tests « nominal » ne couvrent pas toujours — chacune est épinglée par un test nommé :

1. **Payload illégal reçu par le serveur** (row non objet, clé vide, JSON tronqué) → attente : réponse 400 `{ erreur }`, le serveur répond encore ensuite, rien de persisté. Pin : Task 5, « row illégale → 400 et le serveur vit ».
2. **Token expiré ou signé avec un autre secret** → attente : 401 sur **toutes** les routes authentifiées (sync + SSE), jamais de fuite de données. Pin : Task 5, « 401 mauvais secret » ; Task 6, « sans token → 401 ».
3. **Deux foyers différents** → attente : ni les GET, ni les DELETE, ni les événements SSE ne fuient d'un foyer à l'autre. Pin : Task 5, « isolation » ; Task 6, « rien pour l'autre foyer ».
4. **`household_id` stampé par l'engine dans les rows** → attente : ignoré (jamais utilisé comme clé ni stocké) — sinon les clés dupliquées casseraient l'upsert. Pin : Task 5, « household_id ignoré ».
5. **Types SQLite ≠ types JS** (`done` entier 0/1, `payload` texte JSON) → attente : le client reçoit `done` booléen et `payload` objet, sinon `appliquerRemote` re-coche en boucle. Pin : Task 5, « done booléen + payload objet ».
6. **Coupure du flux SSE** (réseau, proxy) → attente : `onStatut(false)` sans crash, c'est l'engine (reconnexion 5 s) qui réappelle `abonner`. Pin : Task 9, « flux fermé → onStatut(false) » et « abort volontaire → pas de false ».

---

### Task 1: Squelette `server/` + `db.ts` (schéma SQLite)

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/tsconfig.build.json`, `server/vitest.config.ts`, `server/eslint.config.js`, `server/src/db.ts`, `server/test/db.test.ts`
- Modify: `vite.config.ts` (exclude vitest), `eslint.config.js` (ignore serveur)

**Interfaces:**
- Produces: `ouvrirDb(chemin: string): Database.Database` (type `better-sqlite3`) — base WAL, `foreign_keys = ON`, 6 tables (`foyers`, `weeks`, `checks`, `weights`, `depenses`, `profiles`) créées si absentes. Les Tasks 4-6 injectent une `Database` dans `creerApp`.

- [ ] **Step 1: Scaffolder le dossier serveur + installer les deps**

`server/package.json` :
```json
{
  "name": "rituel-server",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "lint": "eslint .",
    "test": "vitest run",
    "check": "npm run typecheck && npm run lint && npm test"
  }
}
```
`server/tsconfig.json` :
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "types": ["node"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "test"]
}
```
`server/tsconfig.build.json` :
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": false, "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```
`server/vitest.config.ts` :
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
```
`server/eslint.config.js` :
```js
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config([
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.node },
  },
])
```
Puis :
```bash
cd server
npm install hono @hono/node-server better-sqlite3
npm install -D typescript vitest eslint typescript-eslint @eslint/js globals @types/node @types/better-sqlite3
```
Isolation du reste du repo — dans `vite.config.ts`, la clé `test.exclude` devient :
```ts
    exclude: ['**/node_modules/**', 'tests/e2e/**', '.worktrees/**', 'server/**'],
```
et dans `eslint.config.js` : `globalIgnores(['dist', 'server']),`.

- [ ] **Step 2: Écrire le test (rouge)**

`server/test/db.test.ts` :
```ts
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ouvrirDb } from '../src/db';

const TABLES = ['foyers', 'weeks', 'checks', 'weights', 'depenses', 'profiles'];

describe('server: db', () => {
  it('ouvre la base et crée les 6 tables', () => {
    const db = ouvrirDb(':memory:');
    const noms = (
      db.prepare("select name from sqlite_master where type='table'").all() as { name: string }[]
    ).map((r) => r.name);
    for (const t of TABLES) expect(noms).toContain(t);
    db.close();
  });

  it('foreign_keys actif : enfant sans foyer refusée, cascade à la suppression du foyer', () => {
    const db = ouvrirDb(':memory:');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    db.prepare("insert into foyers (id, code_hash, created_at) values ('f1', 'h', '2026-01-01T00:00:00Z')").run();
    expect(() =>
      db.prepare("insert into weeks (foyer_id, semaine, payload, updated_at) values ('inconnu', '2026-S39', '{}', 'x')").run(),
    ).toThrow(/FOREIGN KEY/);
    db.prepare("insert into weeks (foyer_id, semaine, payload, updated_at) values ('f1', '2026-S39', '{}', 'x')").run();
    db.prepare("delete from foyers where id = 'f1'").run();
    expect(db.prepare('select count(*) as n from weeks').get()).toEqual({ n: 0 });
    db.close();
  });

  it('mode WAL sur un fichier', () => {
    const chemin = join(mkdtempSync(join(tmpdir(), 'rituel-')), 'rituel.db');
    const db = ouvrirDb(chemin);
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    db.close();
  });
});
```

- [ ] **Step 3: Vérifier le rouge**

Run: `cd server && npx vitest run`
Expected: FAIL (`Cannot find module '../src/db'`).

- [ ] **Step 4: Implémenter `db.ts`**

`server/src/db.ts` :
```ts
import Database from 'better-sqlite3';

// Schéma de sync (spec 2026-09-26 §3.1) — JSON en text (SQLite), foyer_id au
// lieu de household_id (nouvelle base, pas de legacy), pas de RLS (le serveur
// filtre par le JWT). Noms de colonnes métier identiques à l'actuel : les rows
// échangées avec l'app gardent la même forme.
const MIGRATION = `
create table if not exists foyers (
  id text primary key,            -- uuid (crypto.randomUUID)
  code_hash text not null unique, -- pbkdf2-sha256$100000$salt$hash (b64url)
  rev integer not null default 0, -- compteur de changements (SSE)
  created_at text not null
);
create table if not exists weeks (
  foyer_id text not null references foyers on delete cascade,
  semaine text not null, payload text not null, updated_at text not null,
  primary key (foyer_id, semaine)
);
create table if not exists checks (
  foyer_id text not null references foyers on delete cascade,
  semaine text not null, check_id text not null, done integer not null, updated_at text not null,
  primary key (foyer_id, semaine, check_id)
);
create table if not exists weights (
  foyer_id text not null references foyers on delete cascade,
  profil text not null, date_ text not null, kg real not null, updated_at text not null,
  primary key (foyer_id, profil, date_)
);
create table if not exists depenses (
  foyer_id text not null references foyers on delete cascade,
  date_ text not null, magasin_key text not null, magasin text not null, total real not null, updated_at text not null,
  primary key (foyer_id, date_, magasin_key)
);
create table if not exists profiles (
  foyer_id text not null references foyers on delete cascade,
  profil text not null, payload text not null, updated_at text not null,
  primary key (foyer_id, profil)
);
`;

export const ouvrirDb = (chemin: string): Database.Database => {
  const db = new Database(chemin);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(MIGRATION);
  return db;
};
```

- [ ] **Step 5: Vert côté serveur + isolation du repo**

Run: `cd server && npx vitest run` → PASS (3 tests).
Run: `npm test` (racine) → PASS et **aucun** test serveur ramassé (`server/**` exclu).

- [ ] **Step 6: Gate + commit**

Run: gate + `cd server && npm run check`.
```bash
git add server vite.config.ts eslint.config.js package-lock.json
git commit -m "feat(server): squelette Node + db.ts — schéma SQLite WAL, 6 tables, cascade foyer"
```

### Task 2: `auth.ts` — PBKDF2 + JWT HS256 (node:crypto)

**Files:**
- Create: `server/src/auth.ts`, `server/test/auth.test.ts`

**Interfaces:**
- Produces (consommées par Tasks 4-6) :
  - `hashCode(code: string): string` — format `pbkdf2-sha256$100000$salt$hash` (b64url, salt 16 octets, 32 octets de hash) ;
  - `verifierCode(code: string, stocke: string): boolean` (timing-safe, tolérant à un hash malformé) ;
  - `signerToken(foyerId: string, secret: string, dureeS = 365 * 24 * 3600): string` (JWT HS256, claims `foyerId`/`iat`/`exp`) ;
  - `verifierToken(token: string, secret: string): string | null` — `foyerId` ou null (signature invalide, exp dépassée, claims manquantes).

- [ ] **Step 1: Écrire les tests (rouge)**

`server/test/auth.test.ts` :
```ts
import { describe, expect, it } from 'vitest';
import { hashCode, signerToken, verifierCode, verifierToken } from '../src/auth';

const SECRET = 'secret-de-test-0123456789abcdef';

describe('server: auth — code foyer (PBKDF2)', () => {
  it('hashCode produit le format pbkdf2-sha256$100000$salt$hash, jamais le code en clair', () => {
    const hash = hashCode('romarin-basilic-3f9a2c7e');
    expect(hash).toMatch(/^pbkdf2-sha256\$100000\$[\w-]{22}\$[\w-]{43}$/);
    expect(hash).not.toContain('romarin');
  });

  it('verifierCode : vrai code OK, faux code refusé, hash malformé refusé', () => {
    const hash = hashCode('romarin-basilic-3f9a2c7e');
    expect(verifierCode('romarin-basilic-3f9a2c7e', hash)).toBe(true);
    expect(verifierCode('thym-menthe-00000000', hash)).toBe(false);
    expect(verifierCode('x', 'nimporte-quoi')).toBe(false);
  });

  it('deux hash du même code diffèrent (salt aléatoire) mais se vérifient tous deux', () => {
    const h1 = hashCode('code-de-foyer-long');
    const h2 = hashCode('code-de-foyer-long');
    expect(h1).not.toBe(h2);
    expect(verifierCode('code-de-foyer-long', h2)).toBe(true);
  });
});

describe('server: auth — JWT HS256', () => {
  it('signerToken puis verifierToken rend le foyerId', () => {
    const token = signerToken('foyer-1', SECRET);
    expect(token.split('.')).toHaveLength(3);
    expect(verifierToken(token, SECRET)).toBe('foyer-1');
  });

  it('mauvais secret → null', () => {
    expect(verifierToken(signerToken('foyer-1', SECRET), 'autre-secret')).toBeNull();
  });

  it('token expiré → null', () => {
    const token = signerToken('foyer-1', SECRET, -10); // exp dans le passé
    expect(verifierToken(token, SECRET)).toBeNull();
  });

  it('payload altéré → null', () => {
    const token = signerToken('foyer-1', SECRET);
    const [entete, , signature] = token.split('.');
    const corps = Buffer.from(JSON.stringify({ foyerId: 'foyer-2', exp: 9999999999 })).toString('base64url');
    expect(verifierToken(`${entete}.${corps}.${signature}`, SECRET)).toBeNull();
  });

  it('token malformé → null', () => {
    expect(verifierToken('abc', SECRET)).toBeNull();
  });
});
```

- [ ] **Step 2: Rouge** — Run: `cd server && npx vitest run test/auth.test.ts` → FAIL (module absent).

- [ ] **Step 3: Implémenter `auth.ts`**

`server/src/auth.ts` :
```ts
import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const b64url = (b: Buffer): string => b.toString('base64url');
const b64urlVersBuffer = (s: string): Buffer => Buffer.from(s, 'base64url');

const ITERATIONS = 100_000;

// Format identique à l'ancien script supabase/scripts/creer-foyer.mjs.
export const hashCode = (code: string): string => {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(code, salt, ITERATIONS, 32, 'sha256');
  return `pbkdf2-sha256$${ITERATIONS}$${b64url(salt)}$${b64url(hash)}`;
};

export const verifierCode = (code: string, stocke: string): boolean => {
  const [algo, iterations, salt64, hash64] = stocke.split('$');
  if (algo !== 'pbkdf2-sha256' || !iterations || !salt64 || !hash64) return false;
  const calcule = pbkdf2Sync(code, b64urlVersBuffer(salt64), Number(iterations), 32, 'sha256');
  const attendu = b64urlVersBuffer(hash64);
  return calcule.length === attendu.length && timingSafeEqual(calcule, attendu);
};

const claimsB64url = (v: unknown): string => b64url(Buffer.from(JSON.stringify(v), 'utf8'));

export const signerToken = (foyerId: string, secret: string, dureeS = 365 * 24 * 3600): string => {
  const t = Math.floor(Date.now() / 1000);
  const entete = claimsB64url({ alg: 'HS256', typ: 'JWT' });
  const corps = claimsB64url({ foyerId, iat: t, exp: t + dureeS });
  const signature = b64url(createHmac('sha256', secret).update(`${entete}.${corps}`).digest());
  return `${entete}.${corps}.${signature}`;
};

export const verifierToken = (token: string, secret: string): string | null => {
  const parties = token.split('.');
  if (parties.length !== 3) return null;
  const [entete, corps, signature] = parties;
  const recue = b64urlVersBuffer(signature);
  const attendue = createHmac('sha256', secret).update(`${entete}.${corps}`).digest();
  if (recue.length !== attendue.length || !timingSafeEqual(recue, attendue)) return null;
  try {
    const claims = JSON.parse(b64urlVersBuffer(corps).toString('utf8')) as {
      foyerId?: string;
      exp?: number;
    };
    if (!claims.foyerId || typeof claims.exp !== 'number') return null;
    if (claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims.foyerId;
  } catch {
    return null;
  }
};
```

- [ ] **Step 4: Vert + gate + commit**

Run: `cd server && npm run check` → PASS. Run: gate.
```bash
git add server/src/auth.ts server/test/auth.test.ts
git commit -m "feat(server): auth — PBKDF2 code foyer + JWT HS256 foyerId (node:crypto)"
```

### Task 3: `rate-limit.ts` — fenêtre glissante en mémoire

**Files:**
- Create: `server/src/rate-limit.ts`, `server/test/rate-limit.test.ts`

**Interfaces:**
- Produces: `creerLimiteur({ max, fenetreMs }): (clef: string) => boolean` — `true` = autorisé. Utilisé par `/foyers` et `/connexion` (Task 4) avec `{ max: 10, fenetreMs: 60_000 }`.

- [ ] **Step 1: Test (rouge)**

`server/test/rate-limit.test.ts` :
```ts
import { describe, expect, it, vi } from 'vitest';
import { creerLimiteur } from '../src/rate-limit';

describe('server: rate-limit', () => {
  it('laisse passer max requêtes puis refuse dans la fenêtre, réautorise après', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T10:00:00'));
    const limite = creerLimiteur({ max: 3, fenetreMs: 100 });
    expect([limite('ip1'), limite('ip1'), limite('ip1')]).toEqual([true, true, true]);
    expect(limite('ip1')).toBe(false);          // 4ᵉ refusée
    expect(limite('ip2')).toBe(true);           // autre clef : indépendante
    vi.advanceTimersByTime(120);                 // fenêtre écoulée
    expect(limite('ip1')).toBe(true);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Rouge** — `cd server && npx vitest run test/rate-limit.test.ts` → FAIL.

- [ ] **Step 3: Implémenter**

`server/src/rate-limit.ts` :
```ts
// Fenêtre glissante en mémoire (~10 req/min/IP sur /connexion et /foyers).
// Suffisant à l'échelle du foyer, zéro dépendance ; les vieilles entrées sont
// taillées à l'accès (une IP sans trafic disparaît de la carte d'elle-même).
export type Limiteur = (clef: string) => boolean;

export const creerLimiteur = ({
  max,
  fenetreMs,
}: {
  max: number;
  fenetreMs: number;
}): Limiteur => {
  const hits = new Map<string, number[]>();
  return (clef) => {
    const maintenant = Date.now();
    const recents = (hits.get(clef) ?? []).filter((t) => maintenant - t < fenetreMs);
    if (recents.length >= max) {
      hits.set(clef, recents);
      return false;
    }
    recents.push(maintenant);
    hits.set(clef, recents);
    return true;
  };
};
```

- [ ] **Step 4: Vert + gate + commit**

Run: `cd server && npm run check` + gate.
```bash
git add server/src/rate-limit.ts server/test/rate-limit.test.ts
git commit -m "feat(server): rate-limit glissant en mémoire (10 req/min/IP)"
```

### Task 4: `routes.ts` — `/foyers` + `/connexion` (+ CORS, middleware 401)

**Files:**
- Create: `server/src/routes.ts`, `server/src/sse.ts` (squelette, complété en Task 6), `server/test/routes-foyers.test.ts`

**Interfaces:**
- Produces: `creerApp({ db, secret, origines?, heartbeatMs? }): Hono<{ Variables: { foyerId: string } }>` — app factory testée via `app.request()` (aucun port écouté). `origines` remplace la liste CORS par défaut ; `heartbeatMs` sert aux tests SSE (Task 6).
- Consomme : `ouvrirDb` (Task 1), `hashCode/verifierCode/signerToken/verifierToken` (Task 2), `creerLimiteur` (Task 3), `creerRegistreSse` (squelette ici). Le middleware 401 sur `/sync/*` et `/evenements` est posé ici ; les routes correspondantes arrivent aux Tasks 5-6 (401 testable dès maintenant sur `GET /sync/weeks`).

- [ ] **Step 1: Tests (rouge)**

`server/test/routes-foyers.test.ts` :
```ts
import { describe, expect, it } from 'vitest';
import { ouvrirDb } from '../src/db';
import { creerApp } from '../src/routes';

const SECRET = 'secret-de-test-0123456789abcdef';
const CODE = 'romarin-basilic-3f9a2c7e';

const creerContexte = () => {
  const db = ouvrirDb(':memory:');
  return { db, app: creerApp({ db, secret: SECRET }) };
};

describe('server: POST /foyers', () => {
  it('crée un foyer : 201 { foyerId } (uuid)', async () => {
    const { app } = creerContexte();
    const res = await app.request('/foyers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: CODE }),
    });
    expect(res.status).toBe(201);
    const { foyerId } = (await res.json()) as { foyerId: string };
    expect(foyerId).toMatch(/^[\da-f-]{36}$/);
  });

  it('code < 12 caractères → 400', async () => {
    const { app } = creerContexte();
    const res = await app.request('/foyers', {
      method: 'POST',
      body: JSON.stringify({ code: 'court' }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ erreur: 'code-trop-court' });
  });

  it('corps illégal (JSON cassé, code absent) → 400, pas de crash', async () => {
    const { app } = creerContexte();
    expect((await app.request('/foyers', { method: 'POST', body: '{oops' })).status).toBe(400);
    expect((await app.request('/foyers', { method: 'POST' })).status).toBe(400);
  });

  it('code déjà pris → 409 (le hash diffère à chaque création : vérification par verifierCode)', async () => {
    const { app } = creerContexte();
    const premier = await app.request('/foyers', { method: 'POST', body: JSON.stringify({ code: CODE }) });
    expect(premier.status).toBe(201);
    const res = await app.request('/foyers', { method: 'POST', body: JSON.stringify({ code: CODE }) });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ erreur: 'code-occupe' });
  });

  it('rate-limit : 11ᵉ requête de la fenêtre → 429', async () => {
    const { app } = creerContexte();
    let dernier = 0;
    for (let i = 0; i < 11; i++) {
      dernier = (
        await app.request('/foyers', {
          method: 'POST',
          body: JSON.stringify({ code: `${CODE}-${i}`.slice(0, 30) }),
        })
      ).status;
    }
    expect(dernier).toBe(429);
  });
});

describe('server: POST /connexion', () => {
  it('code du foyer 2 reconnu parmi plusieurs foyers (multi-foyer)', async () => {
    const { app } = creerContexte();
    await app.request('/foyers', { method: 'POST', body: JSON.stringify({ code: CODE }) });
    const res = await app.request('/connexion', { method: 'POST', body: JSON.stringify({ code: 'thym-menthe-12345678' }) });
    expect(res.status).toBe(401); // ce foyer n'existe pas encore → refus
    await app.request('/foyers', { method: 'POST', body: JSON.stringify({ code: 'thym-menthe-12345678' }) });
    const ok = await app.request('/connexion', { method: 'POST', body: JSON.stringify({ code: 'thym-menthe-12345678' }) });
    expect(ok.status).toBe(200);
    const { token, foyerId } = (await ok.json()) as { token: string; foyerId: string };
    expect(foyerId).toMatch(/^[\da-f-]{36}$/);
    expect(token.split('.')).toHaveLength(3);
  });

  it('code faux → 401 { erreur: code-refuse }', async () => {
    const { app } = creerContexte();
    const res = await app.request('/connexion', { method: 'POST', body: JSON.stringify({ code: 'inconnu-12345678' }) });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ erreur: 'code-refuse' });
  });
});

describe('server: middleware auth', () => {
  it('GET /sync/weeks sans token → 401 { erreur: token-invalide }', async () => {
    const { app } = creerContexte();
    const res = await app.request('/sync/weeks');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ erreur: 'token-invalide' });
  });
});
```

- [ ] **Step 2: Rouge** — `cd server && npx vitest run test/routes-foyers.test.ts` → FAIL (module absent).

- [ ] **Step 3: Implémenter `sse.ts` (squelette compilable, complété en Task 6)**

`server/src/sse.ts` :
```ts
// Registre des flux SSE par foyer — diffusion réelle en Task 6.
export interface FluxSse {
  envoyer: (bloc: string) => void;
  fermer: () => void;
}

export interface RegistreSse {
  ajouter: (foyerId: string, flux: FluxSse) => () => void;
  diffuser: (foyerId: string, rev: number) => void;
}

export const creerRegistreSse = ({ heartbeatMs = 25_000 }: { heartbeatMs?: number } = {}): RegistreSse => {
  const fluxParFoyer = new Map<string, Set<FluxSse>>();
  return {
    ajouter: (foyerId, flux) => {
      let ensemble = fluxParFoyer.get(foyerId);
      if (!ensemble) {
        ensemble = new Set();
        fluxParFoyer.set(foyerId, ensemble);
      }
      ensemble.add(flux);
      void heartbeatMs;
      return () => {
        ensemble!.delete(flux);
        if (ensemble!.size === 0) fluxParFoyer.delete(foyerId);
      };
    },
    diffuser: (foyerId, rev) => {
      void foyerId;
      void rev;
    },
  };
};
```

- [ ] **Step 4: Implémenter `routes.ts` (infra + foyers ; les blocs `// (Task 5)` et `// (Task 6)` attendent les routes suivantes)**

`server/src/routes.ts` :
```ts
import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { hashCode, signerToken, verifierCode, verifierToken } from './auth';
import { creerLimiteur } from './rate-limit';
import { creerRegistreSse, type RegistreSse } from './sse';

export type TableSync = 'weeks' | 'checks' | 'weights' | 'depenses' | 'profiles';

// Clés métier (PK sans foyer) + colonnes de valeur par table — l'app envoie
// exactement ces noms (port SyncClient inchangé). `household_id` stampé par
// l'engine est ignoré : le serveur fait foi avec son token.
const DEFS: Record<TableSync, { cles: string[]; colonnes: string[] }> = {
  weeks: { cles: ['semaine'], colonnes: ['payload'] },
  checks: { cles: ['semaine', 'check_id'], colonnes: ['done'] },
  weights: { cles: ['profil', 'date_'], colonnes: ['kg'] },
  depenses: { cles: ['date_', 'magasin_key'], colonnes: ['magasin', 'total'] },
  profiles: { cles: ['profil'], colonnes: ['payload'] },
};

const ORIGINES_DEFAUT = ['https://marcsuarez74.github.io', 'http://localhost:5173'];

export interface OptionsApp {
  db: Database;
  secret: string;
  /** Liste blanche CORS complète — remplace le défaut si fournie. */
  origines?: string[];
  /** Tests : heartbeat SSE raccourci. */
  heartbeatMs?: number;
}

type EnvApp = { Variables: { foyerId: string } };

const estObjet = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

const lireCorps = async (c: Context): Promise<Record<string, unknown> | null> => {
  try {
    const v: unknown = await c.req.json();
    return estObjet(v) ? v : null;
  } catch {
    return null;
  }
};

export const creerApp = ({ db, secret, origines, heartbeatMs }: OptionsApp): Hono<EnvApp> => {
  const app = new Hono<EnvApp>();
  const limiter = creerLimiteur({ max: 10, fenetreMs: 60_000 });
  const registre: RegistreSse = creerRegistreSse({ heartbeatMs });

  const ip = (c: Context): string =>
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const foyerDuToken = (c: Context): string | null => {
    const h = c.req.header('Authorization');
    return h?.startsWith('Bearer ') ? verifierToken(h.slice(7), secret) : null;
  };
  const incrementerRev = (foyerId: string): number => {
    db.prepare('update foyers set rev = rev + 1 where id = ?').run(foyerId);
    return (db.prepare('select rev from foyers where id = ?').get(foyerId) as { rev: number }).rev;
  };

  app.use(
    '*',
    cors({
      origin: (o) => (o && (origines ?? ORIGINES_DEFAUT).includes(o) ? o : null),
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    }),
  );

  const auth = async (c: Context<EnvApp>, next: () => Promise<void>): Promise<Response | void> => {
    const foyer = foyerDuToken(c);
    if (!foyer) return c.json({ erreur: 'token-invalide' }, 401);
    c.set('foyerId', foyer);
    await next();
  };
  app.use('/sync/*', auth);
  app.use('/evenements', auth);

  // ---- Foyers (sans auth, rate-limitées) ----

  app.post('/foyers', async (c) => {
    if (!limiter(ip(c))) return c.json({ erreur: 'trop-de-requetes' }, 429);
    const corps = await lireCorps(c);
    const code = typeof corps?.code === 'string' ? corps.code : '';
    if (code.length < 12) return c.json({ erreur: 'code-trop-court' }, 400);
    // Le hash porte un salt aléatoire : impossible de chercher par égalité —
    // on vérifie le code contre chaque foyer (échelle : quelques foyers).
    const foyers = db.prepare('select id, code_hash from foyers').all() as {
      id: string;
      code_hash: string;
    }[];
    if (foyers.some((f) => verifierCode(code, f.code_hash))) {
      return c.json({ erreur: 'code-occupe' }, 409);
    }
    const id = randomUUID();
    db.prepare('insert into foyers (id, code_hash, rev, created_at) values (?, ?, 0, ?)').run(
      id,
      hashCode(code),
      new Date().toISOString(),
    );
    return c.json({ foyerId: id }, 201);
  });

  app.post('/connexion', async (c) => {
    if (!limiter(ip(c))) return c.json({ erreur: 'trop-de-requetes' }, 429);
    const corps = await lireCorps(c);
    const code = typeof corps?.code === 'string' ? corps.code : '';
    const foyers = db.prepare('select id, code_hash from foyers').all() as {
      id: string;
      code_hash: string;
    }[];
    const foyer = foyers.find((f) => verifierCode(code, f.code_hash));
    if (!foyer) return c.json({ erreur: 'code-refuse' }, 401);
    return c.json({ token: signerToken(foyer.id, secret), foyerId: foyer.id });
  });

  // ---- Sync (auth Bearer) — routes ajoutées en Task 5 ----
  // ---- SSE — route ajoutée en Task 6 ----

  return app;
};
```

- [ ] **Step 5: Vert + gate + commit**

Run: `cd server && npm run check` → PASS. Run: gate.
```bash
git add server/src/routes.ts server/src/sse.ts server/test/routes-foyers.test.ts
git commit -m "feat(server): /foyers + /connexion — multi-foyer, PBKDF2, rate-limit, CORS, 401"
```

### Task 5: `/sync/:table` (GET/POST/DELETE) + `DELETE /sync` — purge

**Files:**
- Modify: `server/src/routes.ts` (remplace le commentaire `// ---- Sync (auth Bearer) — routes ajoutées en Task 5 ----`)
- Test: `server/test/routes-sync.test.ts`

**Interfaces:**
- Produces (contrat client↔serveur, cf. Global Constraints) :
  - `GET /sync/:table` → `{ rows }` — `payload` **objet** (JSON parsé), `done` **booléen** (`=== 1`), `kg`/`total` nombres, `updated_at` texte ;
  - `POST /sync/:table` body `{ rows }` → upsert `insert or replace`, `household_id` ignoré, `updated_at` = horodatage serveur, `rev`++ + diffusion SSE ;
  - `DELETE /sync/:table` body `{ clefs }` → delete par clés métier, `rev`++ + diffusion ;
  - `DELETE /sync` → purge des 5 tables du foyer (le foyer et son code survivent), `rev`++ + diffusion.
- Consomme : `DEFS`, `valeurSql`/`normaliser` (ajoutés ici), `registre` (diffusion réelle en Task 6 — no-op tant que personne n'est branché).

- [ ] **Step 1: Tests (rouge)**

`server/test/routes-sync.test.ts` :
```ts
import { describe, expect, it } from 'vitest';
import { signerToken } from '../src/auth';
import { ouvrirDb } from '../src/db';
import { creerApp } from '../src/routes';

const SECRET = 'secret-de-test-0123456789abcdef';

const creerContexte = async () => {
  const db = ouvrirDb(':memory:');
  const app = creerApp({ db, secret: SECRET });
  await app.request('/foyers', { method: 'POST', body: JSON.stringify({ code: 'romarin-basilic-3f9a2c7e' }) });
  const res = await app.request('/connexion', { method: 'POST', body: JSON.stringify({ code: 'romarin-basilic-3f9a2c7e' }) });
  const token = ((await res.json()) as { token: string }).token;
  return { db, app, token };
};

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('server: POST /sync/:table (upsert)', () => {
  it('upsert weeks : payload objet stocké puis relu en objet', async () => {
    const { app, token } = await creerContexte();
    const payload = { raw: 'md', data: { meta: { semaine: '2026-S39' } } };
    const res = await app.request('/sync/weeks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ rows: [{ semaine: '2026-S39', payload, household_id: 'stampé-par-engine' }] }),
    });
    expect(res.status).toBe(200);
    const { rows } = (await (await app.request('/sync/weeks', { headers: bearer(token) })).json()) as {
      rows: Array<{ semaine: string; payload: unknown; updated_at: string }>;
    };
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payload).toEqual(payload); // objet, pas du texte
    expect(rows[0]!.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('checks : done booléen à l\u2019écriture, booléen à la lecture (pas 0/1)', async () => {
    const { app, token } = await creerContexte();
    await app.request('/sync/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ rows: [
        { semaine: '2026-S39', check_id: 'courses:c1', done: true },
        { semaine: '2026-S39', check_id: 'courses:c2', done: false },
      ] }),
    });
    const { rows } = (await (await app.request('/sync/checks', { headers: bearer(token) })).json()) as {
      rows: Array<{ check_id: string; done: unknown }>;
    };
    expect(rows.find((r) => r.check_id === 'courses:c1')!.done).toBe(true);
    expect(rows.find((r) => r.check_id === 'courses:c2')!.done).toBe(false);
  });

  it('weights/depenses : kg et total numériques', async () => {
    const { app, token } = await creerContexte();
    await app.request('/sync/weights', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ rows: [{ profil: 'marc', date_: '2026-09-25', kg: 78.4 }] }),
    });
    await app.request('/sync/depenses', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ rows: [{ date_: '2026-09-25', magasin_key: 'carrefour', magasin: 'Carrefour', total: 42.5 }] }),
    });
    const w = (await (await app.request('/sync/weights', { headers: bearer(token) })).json()) as { rows: Array<{ kg: unknown }> };
    const d = (await (await app.request('/sync/depenses', { headers: bearer(token) })).json()) as { rows: Array<{ total: unknown }> };
    expect(w.rows[0]!.kg).toBe(78.4);
    expect(d.rows[0]!.total).toBe(42.5);
  });

  it('household_id stampé par l\u2019engine est ignoré (jamais stocké, jamais clé)', async () => {
    const { app, token } = await creerContexte();
    await app.request('/sync/weeks', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ rows: [{ semaine: '2026-S39', payload: { raw: 'a', data: { meta: { semaine: '2026-S39' } } }, household_id: 'autre-foyer' }] }),
    });
    const { rows } = (await (await app.request('/sync/weeks', { headers: bearer(token) })).json()) as { rows: Array<Record<string, unknown>> };
    expect(rows[0]!.semaine).toBe('2026-S39');
    expect('household_id' in rows[0]!).toBe(false);
  });

  it('re-upsert même clé → remplace (dernier op gagne)', async () => {
    const { app, token } = await creerContexte();
    const post = (rows: unknown) =>
      app.request('/sync/checks', { method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) }, body: JSON.stringify({ rows }) });
    await post([{ semaine: 's', check_id: 'c', done: true }]);
    await post([{ semaine: 's', check_id: 'c', done: false }]);
    const { rows } = (await (await app.request('/sync/checks', { headers: bearer(token) })).json()) as { rows: Array<{ done: boolean }> };
    expect(rows).toHaveLength(1);
    expect(rows[0]!.done).toBe(false);
  });

  it('row illégale (clé vide, colonne manquante, non-objet, rows manquantes) → 400 et le serveur vit', async () => {
    const { app, token } = await creerContexte();
    const post = (rows: unknown) =>
      app.request('/sync/checks', { method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) }, body: JSON.stringify({ rows }) });
    expect((await post([{ semaine: '', check_id: 'c', done: true }])).status).toBe(400);
    expect((await post([{ semaine: 's', done: true }])).status).toBe(400); // colonne manquante
    expect((await post(['junk'])).status).toBe(400);
    expect((await post({})).status).toBe(400); // rows manquantes
    expect((await post([{ semaine: 'x', check_id: 'c', done: true }])).status).toBe(200); // serveur toujours debout
  });

  it('isolation : un 2ᵉ foyer ne voit pas les rows du 1ᵉʳ', async () => {
    const { app, token } = await creerContexte();
    await app.request('/sync/weights', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ rows: [{ profil: 'marc', date_: '2026-09-25', kg: 78.4 }] }),
    });
    await app.request('/foyers', { method: 'POST', body: JSON.stringify({ code: 'thym-menthe-12345678' }) });
    const resAutre = await app.request('/connexion', { method: 'POST', body: JSON.stringify({ code: 'thym-menthe-12345678' }) });
    const tokenAutre = ((await resAutre.json()) as { token: string }).token;
    const res = await app.request('/sync/weights', { headers: bearer(tokenAutre) });
    expect(((await res.json()) as { rows: unknown[] }).rows).toEqual([]);
  });

  it('404 table inconnue ; 401 token signé avec un autre secret', async () => {
    const { app, token } = await creerContexte();
    const res404 = await app.request('/sync/nimporte', { headers: bearer(token) });
    expect(res404.status).toBe(404);
    const faux = creerApp({ db: ouvrirDb(':memory:'), secret: 'autre-secret' });
    const res = await faux.request('/sync/weeks', { headers: bearer(signerToken('f', SECRET, 3600)) });
    expect(res.status).toBe(401);
  });
});

describe('server: DELETE /sync/:table', () => {
  it('delete par clés métier ; clefs illégales → 400', async () => {
    const { app, token } = await creerContexte();
    await app.request('/sync/checks', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ rows: [
        { semaine: 's', check_id: 'c1', done: true },
        { semaine: 's', check_id: 'c2', done: true },
      ] }),
    });
    const suppr = (clefs: unknown) =>
      app.request('/sync/checks', { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...bearer(token) }, body: JSON.stringify({ clefs }) });
    expect((await suppr([{ semaine: 's', check_id: 'c1' }])).status).toBe(200);
    const { rows } = (await (await app.request('/sync/checks', { headers: bearer(token) })).json()) as { rows: Array<{ check_id: string }> };
    expect(rows.map((r) => r.check_id)).toEqual(['c2']);
    expect((await suppr('junk')).status).toBe(400);
    expect((await suppr([{ semaine: 1 }])).status).toBe(400);
  });
});

describe('server: DELETE /sync (purge)', () => {
  it('vide les 5 tables du foyer, le foyer et son code survivent', async () => {
    const { app, token } = await creerContexte();
    const post = (table: string, rows: unknown) =>
      app.request(`/sync/${table}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) }, body: JSON.stringify({ rows }) });
    await post('weeks', [{ semaine: '2026-S39', payload: { raw: 'a', data: { meta: { semaine: '2026-S39' } } } }]);
    await post('checks', [{ semaine: '2026-S39', check_id: 'c', done: true }]);
    await post('weights', [{ profil: 'marc', date_: '2026-09-25', kg: 78 }]);
    await post('depenses', [{ date_: '2026-09-25', magasin_key: 'c', magasin: 'C', total: 1 }]);
    await post('profiles', [{ profil: 'marc', payload: { id: 'marc' } }]);

    const res = await app.request('/sync', { method: 'DELETE', headers: bearer(token) });
    expect(res.status).toBe(200);
    for (const t of ['weeks', 'checks', 'weights', 'depenses', 'profiles']) {
      expect((await (await app.request(`/sync/${t}`, { headers: bearer(token) })).json()).rows).toEqual([]);
    }
    // Le foyer survit : reconnexion possible au même code.
    const ok = await app.request('/connexion', { method: 'POST', body: JSON.stringify({ code: 'romarin-basilic-3f9a2c7e' }) });
    expect(ok.status).toBe(200);
  });
});
```

- [ ] **Step 2: Rouge** — `cd server && npx vitest run test/routes-sync.test.ts` → FAIL (routes absentes).

- [ ] **Step 3: Implémenter**

Dans `server/src/routes.ts`, ajouter au niveau module (au-dessus de `creerApp`) :
```ts
// SQLite n'a pas de booléen ni d'objet : coercition à l'écriture.
const valeurSql = (colonne: string, v: unknown): string | number => {
  if (colonne === 'payload') return typeof v === 'string' ? v : JSON.stringify(v ?? null);
  if (colonne === 'done') return v === true ? 1 : 0;
  if (colonne === 'kg' || colonne === 'total') return Number(v);
  return String(v);
};

// …et retour aux types JS à la lecture — les rows gardent la même forme que
// du temps de Supabase : appliquerRemote ne voit aucune différence.
const normaliser = (r: Record<string, unknown>): Record<string, unknown> => {
  const out = { ...r };
  if (typeof out.payload === 'string') {
    try {
      out.payload = JSON.parse(out.payload) as unknown;
    } catch {
      /* payload texte illisible → laissé tel quel, le client filtrera */
    }
  }
  if (out.done !== undefined) out.done = out.done === 1;
  return out;
};
```
Puis remplacer le commentaire `// ---- Sync (auth Bearer) — routes ajoutées en Task 5 ----` par :
```ts
  app.get('/sync/:table', (c) => {
    const table = c.req.param('table');
    const def = DEFS[table as TableSync];
    if (!def) return c.json({ erreur: 'table-inconnue' }, 404);
    const colonnes = [...def.cles, ...def.colonnes, 'updated_at'].join(', ');
    const rows = db
      .prepare(`select ${colonnes} from ${table} where foyer_id = ?`)
      .all(c.get('foyerId')) as Record<string, unknown>[];
    return c.json({ rows: rows.map(normaliser) });
  });

  app.post('/sync/:table', async (c) => {
    const table = c.req.param('table');
    const def = DEFS[table as TableSync];
    if (!def) return c.json({ erreur: 'table-inconnue' }, 404);
    const corps = await lireCorps(c);
    const rows = corps?.rows;
    if (!Array.isArray(rows)) return c.json({ erreur: 'rows-manquantes' }, 400);
    for (const r of rows) {
      if (!estObjet(r)) return c.json({ erreur: 'row-illegale' }, 400);
      for (const k of def.cles) {
        if (typeof r[k] !== 'string' || !r[k]) return c.json({ erreur: 'cle-illegale' }, 400);
      }
      for (const col of def.colonnes) {
        if (!(col in r)) return c.json({ erreur: 'colonne-manquante' }, 400);
      }
    }
    const colonnes = [...def.cles, ...def.colonnes, 'updated_at'];
    const insert = db.prepare(
      `insert or replace into ${table} (foyer_id, ${colonnes.join(', ')}) values (${colonnes.map(() => '?').join(', ')})`,
    );
    const maintenant = new Date().toISOString();
    for (const r of rows as Record<string, unknown>[]) {
      insert.run(
        c.get('foyerId'),
        ...def.cles.map((k) => r[k] as string),
        ...def.colonnes.map((col) => valeurSql(col, r[col])),
        maintenant,
      );
    }
    const rev = incrementerRev(c.get('foyerId'));
    registre.diffuser(c.get('foyerId'), rev);
    return c.json({ ok: true });
  });

  app.delete('/sync/:table', async (c) => {
    const table = c.req.param('table');
    const def = DEFS[table as TableSync];
    if (!def) return c.json({ erreur: 'table-inconnue' }, 404);
    const corps = await lireCorps(c);
    const clefs = corps?.clefs;
    if (!Array.isArray(clefs)) return c.json({ erreur: 'clefs-manquantes' }, 400);
    for (const cle of clefs) {
      if (!estObjet(cle)) return c.json({ erreur: 'clef-illegale' }, 400);
      for (const k of def.cles) {
        if (typeof cle[k] !== 'string' || !cle[k]) return c.json({ erreur: 'clef-illegale' }, 400);
      }
    }
    const del = db.prepare(
      `delete from ${table} where foyer_id = ? and ${def.cles.map((k) => `${k} = ?`).join(' and ')}`,
    );
    for (const cle of clefs as Record<string, unknown>[]) {
      del.run(c.get('foyerId'), ...def.cles.map((k) => cle[k] as string));
    }
    const rev = incrementerRev(c.get('foyerId'));
    registre.diffuser(c.get('foyerId'), rev);
    return c.json({ ok: true });
  });

  // Purge du foyer : les 5 tables sont vidées, le foyer et son code survivent
  // (même sémantique qu'au temps de Supabase — purge ≠ suppression du foyer).
  app.delete('/sync', (c) => {
    const foyerId = c.get('foyerId');
    for (const t of ['weeks', 'checks', 'weights', 'depenses', 'profiles'] as const) {
      db.prepare(`delete from ${t} where foyer_id = ?`).run(foyerId);
    }
    const rev = incrementerRev(foyerId);
    registre.diffuser(foyerId, rev);
    return c.json({ ok: true });
  });
```

- [ ] **Step 4: Vert + gate + commit**

Run: `cd server && npm run check` → PASS. Run: gate.
```bash
git add server/src/routes.ts server/test/routes-sync.test.ts
git commit -m "feat(server): /sync/:table upsert/delete + purge foyer — shapes client identiques"
```

### Task 6: `sse.ts` complet + `GET /evenements` — temps réel

**Files:**
- Modify: `server/src/sse.ts` (complète le squelette de Task 4), `server/src/routes.ts` (remplace `// ---- SSE — route ajoutée en Task 6 ----`)
- Test: `server/test/sse.test.ts`

**Interfaces:**
- Produces: `creerRegistreSse({ heartbeatMs = 25_000 }): RegistreSse` — `ajouter(foyerId, flux) => retrait` installe un heartbeat `: ping\n\n` par flux ; `diffuser(foyerId, rev)` écrit `event: changement\ndata: {"rev":N}\n\n` à tous les flux du foyer. Route `GET /evenements` (auth Bearer) : `text/event-stream`, cleanup sur abort.
- Consomme : `incrementerRev` + `registre` déjà câblés dans `creerApp` (Tasks 4-5) — la diffusion devient réelle.

- [ ] **Step 1: Tests (rouge)**

`server/test/sse.test.ts` :
```ts
import { describe, expect, it } from 'vitest';
import { ouvrirDb } from '../src/db';
import { creerApp } from '../src/routes';

const SECRET = 'secret-de-test-0123456789abcdef';

interface FluxOuvert {
  res: Response;
  lire: () => Promise<string>;
}

const ouvrirFlux = async (app: ReturnType<typeof creerApp>, token: string): Promise<FluxOuvert> => {
  const res = await app.request('/evenements', { headers: { Authorization: `Bearer ${token}` } });
  const lecteur = res.body!.getReader();
  const decodeur = new TextDecoder();
  let tampon = '';
  return {
    res,
    lire: async (): Promise<string> => {
      const { done, value } = await lecteur.read();
      if (done) return tampon;
      tampon += decodeur.decode(value, { stream: true });
      return tampon;
    },
  };
};

const creerContexte = async () => {
  const db = ouvrirDb(':memory:');
  const app = creerApp({ db, secret: SECRET, heartbeatMs: 10 });
  await app.request('/foyers', { method: 'POST', body: JSON.stringify({ code: 'romarin-basilic-3f9a2c7e' }) });
  const res = await app.request('/connexion', { method: 'POST', body: JSON.stringify({ code: 'romarin-basilic-3f9a2c7e' }) });
  const token = ((await res.json()) as { token: string }).token;
  return { db, app, token };
};

describe('server: SSE /evenements', () => {
  it('headers text/event-stream', async () => {
    const { app, token } = await creerContexte();
    const { res } = await ouvrirFlux(app, token);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache');
  });

  it('mutation → event changement + rev diffusé aux flux du foyer', async () => {
    const { app, token } = await creerContexte();
    const a = await ouvrirFlux(app, token);
    const b = await ouvrirFlux(app, token); // 2ᵉ appareil, même foyer
    await app.request('/sync/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rows: [{ semaine: 's', check_id: 'c', done: true }] }),
    });
    const luA = await a.lire();
    const luB = await b.lire();
    expect(luA).toContain('event: changement');
    expect(luA).toContain('"rev":1');
    expect(luB).toContain('event: changement');
  });

  it('rien pour un autre foyer', async () => {
    const { app, token } = await creerContexte();
    await ouvrirFlux(app, token);
    await app.request('/foyers', { method: 'POST', body: JSON.stringify({ code: 'thym-menthe-12345678' }) });
    const resAutre = await app.request('/connexion', { method: 'POST', body: JSON.stringify({ code: 'thym-menthe-12345678' }) });
    const autre = await ouvrirFlux(app, ((await resAutre.json()) as { token: string }).token);
    await app.request('/sync/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rows: [{ semaine: 's', check_id: 'c', done: true }] }),
    });
    expect(await autre.lire()).not.toContain('changement');
  });

  it('heartbeat : ping périodique (heartbeatMs=10)', async () => {
    const { app, token } = await creerContexte();
    const { lire } = await ouvrirFlux(app, token);
    await new Promise((r) => setTimeout(r, 50));
    expect(await lire()).toContain(': ping');
  });

  it('purge diffuse aussi un changement (rev incrémenté)', async () => {
    const { app, token } = await creerContexte();
    const { lire } = await ouvrirFlux(app, token);
    await app.request('/sync', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    const lu = await lire();
    expect(lu).toContain('event: changement');
    expect(lu).toContain('"rev":1');
  });

  it('sans token → 401', async () => {
    const { app } = await creerContexte();
    const res = await app.request('/evenements');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Rouge** — `cd server && npx vitest run test/sse.test.ts` → FAIL (diffusion no-op, pas de heartbeat, pas de route).

- [ ] **Step 3: Implémenter `sse.ts` complet**

Remplacer `server/src/sse.ts` par :
```ts
// Registre des flux SSE par foyer : diffusion des changements + heartbeat
// 25 s (surchargeable pour les tests). Un flux = un appareil abonné.
export interface FluxSse {
  envoyer: (bloc: string) => void;
  fermer: () => void;
}

export interface RegistreSse {
  /** Enregistre un flux (avec son heartbeat) ; retourne la fonction de retrait. */
  ajouter: (foyerId: string, flux: FluxSse) => () => void;
  /** Diffuse `event: changement` + rev à tous les flux du foyer. */
  diffuser: (foyerId: string, rev: number) => void;
}

export const creerRegistreSse = ({ heartbeatMs = 25_000 }: { heartbeatMs?: number } = {}): RegistreSse => {
  const fluxParFoyer = new Map<string, Set<FluxSse>>();
  const battements = new Map<FluxSse, ReturnType<typeof setInterval>>();

  return {
    ajouter: (foyerId, flux) => {
      let ensemble = fluxParFoyer.get(foyerId);
      if (!ensemble) {
        ensemble = new Set();
        fluxParFoyer.set(foyerId, ensemble);
      }
      ensemble.add(flux);
      const battement = setInterval(() => flux.envoyer(': ping\n\n'), heartbeatMs);
      battements.set(flux, battement);
      return () => {
        clearInterval(battement);
        battements.delete(flux);
        const set = fluxParFoyer.get(foyerId);
        if (!set) return;
        set.delete(flux);
        if (set.size === 0) fluxParFoyer.delete(foyerId);
      };
    },
    diffuser: (foyerId, rev) => {
      const bloc = `event: changement\ndata: ${JSON.stringify({ rev })}\n\n`;
      for (const flux of fluxParFoyer.get(foyerId) ?? []) flux.envoyer(bloc);
    },
  };
};
```
Et remplacer `// ---- SSE — route ajoutée en Task 6 ----` dans `routes.ts` par :
```ts
  app.get('/evenements', (c) => {
    const foyerId = c.get('foyerId');
    let retirer: (() => void) | null = null;
    const encodeur = new TextEncoder();
    const flux = new ReadableStream<Uint8Array>({
      start: (ctrl) => {
        retirer = registre.ajouter(foyerId, {
          envoyer: (bloc) => {
            try {
              ctrl.enqueue(encodeur.encode(bloc));
            } catch {
              /* flux déjà fermé : le retrait fera le ménage */
            }
          },
          fermer: () => {
            try {
              ctrl.close();
            } catch {
              /* déjà fermé */
            }
          },
        });
      },
      cancel: () => retirer?.(),
    });
    c.req.raw.signal.addEventListener('abort', () => retirer?.());
    return new Response(flux, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  });
```

- [ ] **Step 4: Vert + gate + commit**

Run: `cd server && npm run check` → PASS (tout le serveur). Run: gate.
```bash
git add server/src/sse.ts server/src/routes.ts server/test/sse.test.ts
git commit -m "feat(server): SSE /evenements — diffusion rev par foyer + heartbeat 25 s"
```

### Task 7: `index.ts` + `deploy.sh` + `server/README.md` (ops)

**Files:**
- Create: `server/src/index.ts`, `server/deploy.sh`, `server/README.md`

**Interfaces:**
- Produces: point d'entrée exécutable (`npm run build && npm start`) lisant `JWT_SECRET` (requis), `PORT` (défaut 8787), `DB_PATH` (défaut `rituel.db`), `CORS_ORIGINS` (optionnel, remplace la liste par défaut).

- [ ] **Step 1: `server/src/index.ts`**

```ts
import { serve } from '@hono/node-server';
import { ouvrirDb } from './db';
import { creerApp } from './routes';

// Boot VPS : secrets uniquement via l'environnement (systemd
// EnvironmentFile=/etc/rituel.env) — jamais dans le repo.
const secret = process.env.JWT_SECRET;
if (!secret) throw new Error('JWT_SECRET manquant — voir /etc/rituel.env');

const db = ouvrirDb(process.env.DB_PATH ?? 'rituel.db');
const origines = process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean);
const port = Number(process.env.PORT ?? 8787);

serve({ fetch: creerApp({ db, secret, origines }).fetch, port });
console.log(`Rituel API sur :${port}`);
```

- [ ] **Step 2: `server/deploy.sh`** (exécutable)

```bash
#!/usr/bin/env bash
# Déploiement sur le VPS (lancé depuis /srv/rituel) : pull, install, build, restart.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
cd server
npm ci
npm run build
sudo systemctl restart rituel-api
```
Run: `chmod +x server/deploy.sh`.

- [ ] **Step 3: `server/README.md`** (ops — contenu complet)

````markdown
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
JWT_SECRET=dev DB_PATH=/tmp/rituel.db npm run build && npm start   # :8787
```

## VPS (première installation)

1. Node ≥ 20 (`node -v`) ; utilisateur dédié sans shell :
   `sudo useradd -r -s /usr/sbin/nologin rituel`
2. Dépôt dans `/srv/rituel` ; base dans `/var/lib/rituel/` :
   `sudo mkdir -p /var/lib/rituel && sudo chown rituel:rituel /var/lib/rituel`
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
````

- [ ] **Step 4: Vérification manuelle locale (smoke)**

Run: `cd server && JWT_SECRET=dev npm run build` puis `JWT_SECRET=dev PORT=8791 DB_PATH=$(mktemp -d)/rituel.db node dist/index.js &` puis :
```bash
curl -s -X POST localhost:8791/foyers -H 'Content-Type: application/json' -d '{"code":"romarin-basilic-3f9a2c7e"}'
```
Expected: `{"foyerId":"…"}` (201) ; kill le serveur ensuite.

- [ ] **Step 5: Gate + commit**

Run: `cd server && npm run check` + gate.
```bash
git add server/src/index.ts server/deploy.sh server/README.md
git commit -m "feat(server): boot Hono (env JWT_SECRET/PORT/DB_PATH/CORS) + ops systemd/proxy/backup"
```

### Task 8: CI — étape `server check`

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Ajouter les steps serveur (après le step Build de l'app)**

```yaml
      - name: Server — install
        run: npm ci
        working-directory: server
      - name: Server — check (typecheck + lint + test)
        run: npm run check
        working-directory: server
```

- [ ] **Step 2: Gate + commit**

Run: `cd server && npm run check` (c'est ce que la CI exécutera) + gate.
```bash
git add .github/workflows/ci.yml
git commit -m "ci: étape server check (typecheck + lint + test) dans la CI PR"
```

### Task 9: Client — lecteur SSE basé sur `fetch` (`src/lib/sync/sse.ts`)

**Files:**
- Create: `src/lib/sync/sse.ts`, `tests/sync/sse.test.ts`

**Interfaces:**
- Produces: `abonnerSse(url: string, token: string, onChangement: () => void, onStatut: (ouvert: boolean) => void): () => void` — fetch avec `Authorization: Bearer` (EventSource ne sait pas poser d'en-tête), parse les blocs `event: changement` (les `: ping` et tout autre event sont ignorés), `onStatut(true)` à l'ouverture, `onStatut(false)` à la fermeture/erreur. La reconnexion N'EST PAS gérée ici : c'est `engine.ts` (`planifierReconnexion`, 5 s) qui réappelle `abonner` — mécanisme existant inchangé.
- Consommé par : `client.ts` (Task 10).

- [ ] **Step 1: Tests (rouge)** — environnement `node` (fetch/ReadableStream natifs, localStorage inutile ici)

`tests/sync/sse.test.ts` :
```ts
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { abonnerSse } from '../../src/lib/sync/sse';

// Stream contrôlé par le test : envoyer/fermer depuis le scénario.
const streamControle = (): {
  stream: ReadableStream<Uint8Array>;
  envoyer: (s: string) => void;
  fermer: () => void;
} => {
  let ctrl!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start: (c) => {
      ctrl = c;
    },
  });
  const encodeur = new TextEncoder();
  return {
    stream,
    envoyer: (s) => ctrl.enqueue(encodeur.encode(s)),
    fermer: () => {
      try {
        ctrl.close();
      } catch {
        /* déjà fermé */
      }
    },
  };
};

describe('sync: lecteur SSE (fetch)', () => {
  it('flux ouvert → onStatut(true) ; event changement → onChangement ; ping ignoré ; fermeture → onStatut(false)', async () => {
    const s = streamControle();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(s.stream)));
    const statuts: boolean[] = [];
    let changements = 0;
    abonnerSse('https://rituel.example.fr/evenements', 'tok', () => changements++, (o) => statuts.push(o));
    await vi.waitFor(() => expect(statuts).toEqual([true]));
    s.envoyer(': ping\n\n');
    s.envoyer('event: changement\ndata: {"rev":2}\n\n');
    await vi.waitFor(() => expect(changements).toBe(1));
    s.fermer();
    await vi.waitFor(() => expect(statuts).toEqual([true, false]));
    vi.unstubAllGlobals();
  });

  it('fetch en échec (500) → onStatut(false) sans crash', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));
    const statuts: boolean[] = [];
    abonnerSse('https://rituel.example.fr/evenements', 'tok', () => {}, (o) => statuts.push(o));
    await vi.waitFor(() => expect(statuts).toEqual([false]));
    vi.unstubAllGlobals();
  });

  it('abort volontaire (désabonnement) → pas de onStatut(false) parasite', async () => {
    const s = streamControle();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(s.stream)));
    const statuts: boolean[] = [];
    const annuler = abonnerSse('https://rituel.example.fr/evenements', 'tok', () => {}, (o) => statuts.push(o));
    await vi.waitFor(() => expect(statuts).toEqual([true]));
    annuler();
    await new Promise((r) => setTimeout(r, 20));
    expect(statuts).toEqual([true]);
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Rouge** — `npx vitest run tests/sync/sse.test.ts` → FAIL (module absent).

- [ ] **Step 3: Implémenter `src/lib/sync/sse.ts`**

```ts
// Lecteur SSE basé sur fetch (~40 lignes) : EventSource ne sait pas poser
// d'en-tête Authorization — ici le token voyage en en-tête, rien dans les
// logs proxy. La reconnexion n'est PAS gérée ici : sur coupure on émet
// onStatut(false) et c'est engine.ts (planifierReconnexion, 5 s) qui
// réappelle abonner() — mécanisme existant inchangé.
export const abonnerSse = (
  url: string,
  token: string,
  onChangement: () => void,
  onStatut: (ouvert: boolean) => void,
): (() => void) => {
  const ctrl = new AbortController();
  void (async () => {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`sse-${res.status}`);
      onStatut(true);
      const lecteur = res.body.getReader();
      const decodeur = new TextDecoder();
      let tampon = '';
      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        tampon += decodeur.decode(value, { stream: true });
        const blocs = tampon.split('\n\n');
        tampon = blocs.pop() ?? '';
        for (const bloc of blocs) {
          const changement = bloc
            .split('\n')
            .some((l) => l.startsWith('event:') && l.slice(6).trim() === 'changement');
          if (changement) onChangement();
        }
      }
      onStatut(false); // flux fermé proprement = coupure vue par l'engine
    } catch (e) {
      if ((e as { name?: string } | null)?.name !== 'AbortError') onStatut(false);
    }
  })();
  return () => ctrl.abort();
};
```

- [ ] **Step 4: Vert + gate + commit**

Run: `npx vitest run tests/sync/sse.test.ts` → PASS ; gate.
```bash
git add src/lib/sync/sse.ts tests/sync/sse.test.ts
git commit -m "feat: lecteur SSE fetch-based (token en en-tête, statut coupure vers engine)"
```

### Task 10: Client — bascule du trio `config`/`session`/`client` sur le VPS (+ retrait supabase-js)

Les trois modules sont couplés par l'import de `SYNC_URL` : ils changent **dans la même tâche** pour que l'arbre reste vert à chaque commit. `engine.ts`/`outbox.ts`/`storage.ts` : zéro modification (le port `SyncClient` est préservé).

**Files:**
- Modify: `src/lib/sync/config.ts`, `src/lib/sync/session.ts`, `src/lib/sync/client.ts`, `package.json` (retrait dep)
- Test: `tests/sync/session.test.ts`, `tests/sync/client.test.ts` (nouveau), mocks à renommer dans `tests/sync/{engine,ui,storage-mirror,outbox}.test.*`

**Interfaces:**
- Produces :
  - `config.ts` : `SYNC_URL: string | undefined` + `syncActif(): boolean` (`SUPABASE_URL`/`SUPABASE_ANON_KEY` disparaissent) ;
  - `session.ts` : `demanderSession(code): Promise<SessionFoyer>` — `POST /connexion` → `{ token, foyerId }`, 401 → `Error('code-refuse')`, autre statut → `Error('indisponible')`, corps incomplet → `Error('reponse-invalide')` ; **`creerFoyer(code): Promise<{ foyerId: string }>`** — `POST /foyers`, 400 → `Error('code-trop-court')`, 409 → `Error('code-occupe')`, autre → `Error('indisponible')` ; **`genererCodeFoyer(): string`** — « mot-mot-8hex » (mots d'herbes, `crypto.getRandomValues`), ≥ 12 caractères, ex. `romarin-basilic-3f9a2c7e` ; `lireSession`/`definirSession`/`effacerSession` **inchangés** (mêmes clés storage) ;
  - `client.ts` : `creerClient(): Promise<SyncClient>` — même port que l'ancien : `upsert` → `POST {SYNC_URL}/sync/:table` body `{ rows }` ; `supprimer` → `DELETE {SYNC_URL}/sync/:table` body `{ clefs }` ; `toutLire` → `GET` → `{ rows }` ; `purger` → `DELETE {SYNC_URL}/sync` ; `abonner` → `abonnerSse('{SYNC_URL}/evenements', token, …)` ; toute réponse `!ok` → `throw new Error('sync-<status>')` (état `erreur` côté engine).
- Consomme : `SYNC_URL` (ce task), `abonnerSse` (Task 9).

- [ ] **Step 1: Adapter les tests `session` (rouge)**

Dans `tests/sync/session.test.ts` : le mock de config devient :
```ts
vi.mock('../../src/lib/sync/config', () => ({
  SYNC_URL: 'https://rituel.example.fr',
  syncActif: () => true,
}));
```
Ajouter `creerFoyer` et `genererCodeFoyer` à l'import, et remplacer les 3 tests `demanderSession` existants (401, 500, header Authorization) par :
```ts
  it('demanderSession : POST /connexion → { token, foyerId }', async () => {
    const appels: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown, init?: RequestInit) => {
        appels.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify({ token: 'jwt', foyerId: 'f-1' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    await expect(demanderSession('bon-code')).resolves.toEqual({ token: 'jwt', foyerId: 'f-1' });
    expect(appels[0]?.url).toBe('https://rituel.example.fr/connexion');
    expect(appels[0]?.init.method).toBe('POST');
    expect(JSON.parse(String(appels[0]?.init.body))).toEqual({ code: 'bon-code' });
    vi.unstubAllGlobals();
  });

  it('demanderSession : 401 → code-refuse ; 500 → indisponible', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unauthorized', { status: 401 })));
    await expect(demanderSession('mauvais')).rejects.toThrow('code-refuse');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));
    await expect(demanderSession('code')).rejects.toThrow('indisponible');
    vi.unstubAllGlobals();
  });

  it('demanderSession : corps incomplet → reponse-invalide', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ token: 'jwt' }))));
    await expect(demanderSession('code')).rejects.toThrow('reponse-invalide');
    vi.unstubAllGlobals();
  });

  it('creerFoyer : 201 → { foyerId } ; 409 → code-occupe ; 400 → code-trop-court', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ foyerId: 'f-9' }), { status: 201 })));
    await expect(creerFoyer('romarin-basilic-3f9a2c7e')).resolves.toEqual({ foyerId: 'f-9' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"erreur":"code-occupe"}', { status: 409 })));
    await expect(creerFoyer('x')).rejects.toThrow('code-occupe');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"erreur":"code-trop-court"}', { status: 400 })));
    await expect(creerFoyer('x')).rejects.toThrow('code-trop-court');
    vi.unstubAllGlobals();
  });

  it('genererCodeFoyer : mot-mot-8hex, ≥ 12 caractères', () => {
    for (let i = 0; i < 20; i++) {
      const code = genererCodeFoyer();
      expect(code).toMatch(/^[a-z]+-[a-z]+-[0-9a-f]{8}$/);
      expect(code.length).toBeGreaterThanOrEqual(12);
    }
  });
```

- [ ] **Step 2: Écrire les tests `client` (rouge)**

`tests/sync/client.test.ts` :
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { creerClient } from '../../src/lib/sync/client';
import { definirSession, effacerSession } from '../../src/lib/sync/session';

vi.mock('../../src/lib/sync/config', () => ({
  SYNC_URL: 'https://rituel.example.fr',
  syncActif: () => true,
}));

vi.mock('../../src/lib/sync/sse', () => ({
  abonnerSse: vi.fn(() => () => {}),
}));

import { abonnerSse } from '../../src/lib/sync/sse';

interface Appel {
  url: string;
  init: RequestInit;
}

describe('sync: client VPS (fetch natif)', () => {
  let appels: Appel[];

  beforeEach(() => {
    localStorage.clear();
    definirSession('jwt.tok', 'foyer-1');
    appels = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown, init?: RequestInit) => {
        appels.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify({ rows: [] }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    effacerSession();
  });

  it('upsert : POST /sync/:table, rows + Bearer token', async () => {
    const c = await creerClient();
    await c.upsert('checks', [{ semaine: 's', check_id: 'c1', done: true, household_id: 'x' }]);
    expect(appels[0]?.url).toBe('https://rituel.example.fr/sync/checks');
    expect(appels[0]?.init.method).toBe('POST');
    expect(appels[0]?.init.headers).toMatchObject({ Authorization: 'Bearer jwt.tok' });
    expect(JSON.parse(String(appels[0]?.init.body))).toEqual({
      rows: [{ semaine: 's', check_id: 'c1', done: true, household_id: 'x' }],
    });
  });

  it('toutLire : GET /sync/:table → rows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ rows: [{ semaine: 's', payload: {} }] }))),
    );
    const c = await creerClient();
    await expect(c.toutLire('weeks')).resolves.toEqual([{ semaine: 's', payload: {} }]);
    expect(appels[0]?.init.method).toBeUndefined(); // GET
  });

  it('supprimer : DELETE /sync/:table avec { clefs }', async () => {
    const c = await creerClient();
    await c.supprimer('weights', [{ profil: 'marc', date_: '2026-09-25' }]);
    expect(appels[0]?.init.method).toBe('DELETE');
    expect(JSON.parse(String(appels[0]?.init.body))).toEqual({
      clefs: [{ profil: 'marc', date_: '2026-09-25' }],
    });
  });

  it('purger : DELETE /sync', async () => {
    const c = await creerClient();
    await c.purger();
    expect(appels[0]?.url).toBe('https://rituel.example.fr/sync');
    expect(appels[0]?.init.method).toBe('DELETE');
  });

  it('erreur HTTP → exception sync-<status> (état erreur côté engine)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('non', { status: 401 })));
    const c = await creerClient();
    await expect(c.toutLire('weeks')).rejects.toThrow('sync-401');
  });

  it('abonner : lecteur SSE avec url du VPS et token', async () => {
    const c = await creerClient();
    const desabonner = c.abonner(() => {}, (o) => {});
    expect(abonnerSse).toHaveBeenCalledWith(
      'https://rituel.example.fr/evenements',
      'jwt.tok',
      expect.any(Function),
      expect.any(Function),
    );
    desabonner();
  });
});
```

- [ ] **Step 3: Rouge** — `npx vitest run tests/sync/session.test.ts tests/sync/client.test.ts` → FAIL.

- [ ] **Step 4: Implémenter les trois modules**

`src/lib/sync/config.ts` :
```ts
/// <reference types="vite/client" />

// Sync optionnelle : sans VITE_SYNC_URL, l'app se comporte exactement comme
// avant (aucune requête réseau, aucune outbox).

interface ImportMetaEnv {
  readonly VITE_SYNC_URL?: string;
}

const env = import.meta.env as ImportMetaEnv;

export const SYNC_URL: string | undefined = env.VITE_SYNC_URL;

export const syncActif = (): boolean => !!SYNC_URL;
```

`src/lib/sync/session.ts` (réécriture ; `lireSession`/`definirSession`/`effacerSession` inchangés) :
```ts
import { SYNC_URL } from './config';

const TOKEN_KEY = 'sportapp:sync:token';
const FOYER_KEY = 'sportapp:sync:foyer';

export interface SessionFoyer {
  token: string;
  foyerId: string;
}

export const lireSession = (): SessionFoyer | null => {
  const token = localStorage.getItem(TOKEN_KEY);
  const foyerId = localStorage.getItem(FOYER_KEY);
  return token && foyerId ? { token, foyerId } : null;
};

export const definirSession = (token: string, foyerId: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(FOYER_KEY, foyerId);
};

export const effacerSession = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(FOYER_KEY);
};

const post = async (route: string, body: Record<string, string>): Promise<Response> =>
  fetch(`${SYNC_URL}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

// Connexion par code : { code } → { token, foyerId }. 401 = code refusé.
export const demanderSession = async (code: string): Promise<SessionFoyer> => {
  const res = await post('/connexion', { code });
  if (res.status === 401) throw new Error('code-refuse');
  if (!res.ok) throw new Error('indisponible');
  const { token, foyerId } = (await res.json()) as { token?: string; foyerId?: string };
  if (!token || !foyerId) throw new Error('reponse-invalide');
  return { token, foyerId };
};

// Création du foyer depuis l'app : { code } → { foyerId }. Le code n'est
// jamais stocké en clair côté serveur (PBKDF2) — impossible de le réafficher.
export const creerFoyer = async (code: string): Promise<{ foyerId: string }> => {
  const res = await post('/foyers', { code });
  if (res.status === 400) throw new Error('code-trop-court');
  if (res.status === 409) throw new Error('code-occupe');
  if (!res.ok) throw new Error('indisponible');
  const { foyerId } = (await res.json()) as { foyerId?: string };
  if (!foyerId) throw new Error('reponse-invalide');
  return { foyerId };
};

const MOTS = ['basilic', 'citron', 'sauge', 'romarin', 'thym', 'menthe', 'origan', 'estragon'];

// Phrase « mots d'herbes + 8 hex » — même générateur que l'ancien script CLI
// supabase/scripts/creer-foyer.mjs (ex. romarin-basilic-3f9a2c7e).
export const genererCodeFoyer = (): string => {
  const mot = (): string => MOTS[crypto.getRandomValues(new Uint32Array(1))[0]! % MOTS.length]!;
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${mot()}-${mot()}-${hex}`;
};
```

`src/lib/sync/client.ts` (réécriture) :
```ts
import { SYNC_URL } from './config';
import type { TableSync } from './outbox';
import { abonnerSse } from './sse';
import { lireSession } from './session';

export type RowSync = Record<string, unknown>;

export interface SyncClient {
  upsert: (table: TableSync, rows: RowSync[]) => Promise<void>;
  supprimer: (table: TableSync, clefs: Record<string, string>[]) => Promise<void>;
  toutLire: (table: TableSync) => Promise<RowSync[]>;
  purger: () => Promise<void>;
  abonner: (onEvenement: () => void, onStatut?: (ouvert: boolean) => void) => () => void;
}

// Port étroit sur l'API du VPS — fetch natif, zéro dépendance. L'app sans
// VITE_SYNC_URL n'appelle jamais creerClient (gate syncActif de l'engine) :
// aucun réseau.
export const creerClient = async (): Promise<SyncClient> => {
  const session = lireSession()!;
  const entetes = (): Record<string, string> => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${lireSession()?.token ?? session.token}`,
  });
  const verifier = async (res: Response): Promise<void> => {
    if (!res.ok) throw new Error(`sync-${res.status}`);
  };

  return {
    upsert: async (table, rows) => {
      const res = await fetch(`${SYNC_URL}/sync/${table}`, {
        method: 'POST',
        headers: entetes(),
        body: JSON.stringify({ rows }),
      });
      await verifier(res);
    },
    supprimer: async (table, clefs) => {
      const res = await fetch(`${SYNC_URL}/sync/${table}`, {
        method: 'DELETE',
        headers: entetes(),
        body: JSON.stringify({ clefs }),
      });
      await verifier(res);
    },
    toutLire: async (table) => {
      const res = await fetch(`${SYNC_URL}/sync/${table}`, { headers: entetes() });
      await verifier(res);
      const { rows } = (await res.json()) as { rows?: RowSync[] };
      return rows ?? [];
    },
    purger: async () => {
      const res = await fetch(`${SYNC_URL}/sync`, { method: 'DELETE', headers: entetes() });
      await verifier(res);
    },
    abonner: (onEvenement, onStatut) =>
      abonnerSse(`${SYNC_URL}/evenements`, session.token, onEvenement, (ouvert) =>
        onStatut?.(ouvert),
      ),
  };
};
```

- [ ] **Step 5: Renommer les mocks de config restants + retirer la dépendance Supabase**

1. Dans `tests/sync/engine.test.ts`, `tests/sync/ui.test.tsx`, `tests/sync/storage-mirror.test.ts`, `tests/sync/outbox.test.ts`, remplacer :
   ```ts
   vi.mock('../../src/lib/sync/config', () => ({
     SUPABASE_URL: 'https://example.supabase.co',
     SUPABASE_ANON_KEY: 'anon',
     syncActif: () => true,
   }));
   ```
   par :
   ```ts
   vi.mock('../../src/lib/sync/config', () => ({
     SYNC_URL: 'https://rituel.example.fr',
     syncActif: () => true,
   }));
   ```
   (garder la forme `vi.fn(() => true)` là où elle existe — `engine.test.ts`, `ui.test.tsx`.)
2. Retirer la dépendance :
   ```bash
   npm uninstall @supabase/supabase-js
   ```
3. Vérifier : `grep -rn "supabase" src/ package.json` → vide (hors commentaires doc).

- [ ] **Step 6: Vert (toute la suite) + gate + commit**

Run: `npm test && npm run typecheck` → PASS (engine/outbox/ui inchangés et verts). Run: gate.
```bash
git add src/lib/sync/config.ts src/lib/sync/session.ts src/lib/sync/client.ts tests/sync/ package.json package-lock.json
git commit -m "feat: client sync sur le VPS — VITE_SYNC_URL unique, fetch natif + SSE, supabase-js retiré"
```

### Task 11: UI — « Créer un foyer » au Profil + note de posture

**Files:**
- Modify: `src/components/profil/ProfilFoyer.tsx`, `src/lib/sync/messages.ts`, `src/index.css`
- Test: `tests/sync/ui.test.tsx`

**Interfaces:**
- Produces : écran non connecté = bouton « Créer un foyer » + formulaire « Se connecter au foyer » (inchangé) ; après création, écran intermédiaire : code affiché une fois + « Copier le code » + avertissement + « C'est noté — connecter ce téléphone » (`connecterFoyer(code)`, engine existant) ; note de posture : « Données synchronisées sur votre serveur (rituel.marco-studio.fr). » ; texte de purge : « … sur le serveur du foyer et sur tous les téléphones. »
- Consomme : `creerFoyer` + `genererCodeFoyer` (Task 10), `connecterFoyer` (engine, inchangé).

- [ ] **Step 1: Tests (rouge)**

Dans `tests/sync/ui.test.tsx`, ajouter (le mock de config vient d'être renommé en Task 10) :
```tsx
const { creerFoyerMock, genererCodeMock } = vi.hoisted(() => ({
  creerFoyerMock: vi.fn(async () => ({ foyerId: 'f-1' })),
  genererCodeMock: vi.fn(() => 'romarin-basilic-3f9a2c7e'),
}));

vi.mock('../../src/lib/sync/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/sync/session')>()),
  creerFoyer: (...a: Parameters<typeof import('../../src/lib/sync/session').creerFoyer>) =>
    creerFoyerMock(...a),
  genererCodeFoyer: () => genererCodeMock(),
}));
```
Puis le describe (recopier le helper `renderProfil` local — celui du describe « bloc profil » est hors portée) :
```tsx
describe('profil: création de foyer (VPS)', () => {
  const profilBase = (): UserProfile => ({
    id: 'marc',
    dateNaissance: '1990-01-01',
    taille: 180,
    objectif: { type: 'maintien' },
    complements: [],
    regime: 'aucun',
  });
  const renderProfil = () =>
    render(
      <ProfilScreen
        profile={profilBase()}
        syncEtat="attente"
        onBack={() => {}}
        onChangeProfile={() => {}}
        onProfileSaved={() => {}}
        onImported={() => {}}
      />,
    );

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('créer → code affiché une fois + copie + connexion au même code', async () => {
    const engine = await import('../../src/lib/sync/engine');
    renderProfil();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /voir le foyer/ }));
    await user.click(screen.getByRole('button', { name: 'Créer un foyer' }));
    expect(await screen.findByText('romarin-basilic-3f9a2c7e')).toBeInTheDocument();
    expect(screen.getByText(/n'est pas stocké en clair/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Copier le code/ }));
    await user.click(screen.getByRole('button', { name: /C'est noté/ }));
    expect(engine.connecterFoyer).toHaveBeenCalledWith('romarin-basilic-3f9a2c7e');
  });

  it('code déjà pris (409) → alerte visible', async () => {
    creerFoyerMock.mockRejectedValueOnce(new Error('code-occupe'));
    renderProfil();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /voir le foyer/ }));
    await user.click(screen.getByRole('button', { name: 'Créer un foyer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/déjà pris/i);
  });

  it('note de posture VPS', async () => {
    renderProfil();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /voir le foyer/ }));
    expect(screen.getByText(/votre serveur.*rituel\.marco-studio\.fr/i)).toBeInTheDocument();
  });
});
```
Adapter le test existant `note de transparence affichée` (assertion `/supabase.*région ue/i`) → le **supprimer** (le nouveau « note de posture VPS » le remplace). Vérifier qu'aucun autre test n'asserte « Supabase » : `grep -n "upabase" tests/sync/ui.test.tsx` → plus rien.

- [ ] **Step 2: Rouge** — `npx vitest run tests/sync/ui.test.tsx` → FAIL (bouton Créer absent).

- [ ] **Step 3: `messages.ts` — ajouter `messageCreation`**

```ts
// Message d'erreur de création de foyer (ProfilFoyer) — symétrique de
// messageConnexion : la session distingue, l'UI parle utilisateur.
export const messageCreation = (e: unknown): string =>
  e instanceof Error && e.message === 'code-occupe'
    ? 'Ce code est déjà pris — relance « Créer un foyer » (un nouveau code sera généré).'
    : 'Création impossible pour le moment. Réessaie plus tard.';
```

- [ ] **Step 4: Réécrire `ProfilFoyer.tsx`**

```tsx
import { useState } from 'react';
import {
  connecterFoyer,
  deconnecterFoyer,
  lireSessionPub,
  purgerFoyer,
} from '../../lib/sync/engine';
import type { SyncEtat } from '../../lib/sync/engine';
import { creerFoyer, genererCodeFoyer } from '../../lib/sync/session';
import { messageConnexion, messageCreation } from '../../lib/sync/messages';
import { Alerte } from './presente';

// Message d'état en vue connectée (texte simple — pas de symbole).
const ETAT_SYNC: Record<Exclude<SyncEtat, 'off' | 'hors-foyer'>, string> = {
  attente: 'Synchronisation : en attente.',
  sync: 'Synchronisé.',
  erreur: 'Synchronisation : erreur.',
};

// Page détail « Foyer » — création (code d'invitation permanent), connexion
// par code, état duo, déconnexion, purge (double confirmation).
export function ProfilFoyer({ syncEtat }: { syncEtat: SyncEtat }) {
  const [codeFoyer, setCodeFoyer] = useState('');
  const [syncErreur, setSyncErreur] = useState<string | null>(null);
  const [syncOccupe, setSyncOccupe] = useState(false);
  const [purgeEnCours, setPurgeEnCours] = useState(false);
  // Création : le code n'est récupérable qu'ici (hashé côté serveur) — il
  // reste affiché jusqu'à la connexion du téléphone.
  const [codeCree, setCodeCree] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  const connecterFoyerCode = async () => {
    const code = codeFoyer.trim();
    if (!code) return;
    setSyncOccupe(true);
    setSyncErreur(null);
    try {
      await connecterFoyer(code);
      setCodeFoyer('');
    } catch (e) {
      setSyncErreur(messageConnexion(e));
    } finally {
      setSyncOccupe(false);
    }
  };

  const creerFoyerCode = async () => {
    if (syncOccupe) return;
    setSyncOccupe(true);
    setSyncErreur(null);
    try {
      const code = genererCodeFoyer();
      await creerFoyer(code);
      setCopie(false);
      setCodeCree(code);
    } catch (e) {
      setSyncErreur(messageCreation(e));
    } finally {
      setSyncOccupe(false);
    }
  };

  const copierCode = async () => {
    if (!codeCree) return;
    try {
      await navigator.clipboard.writeText(codeCree);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = codeCree;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopie(true);
  };

  const connecterApresCreation = async () => {
    if (!codeCree || syncOccupe) return;
    setSyncOccupe(true);
    try {
      await connecterFoyer(codeCree);
      setCodeCree(null);
    } catch (e) {
      setSyncErreur(messageConnexion(e));
    } finally {
      setSyncOccupe(false);
    }
  };

  // Purge : le serveur est nettoyé avant le local (engine) — double
  // confirmation car l'action est définitive pour tout le foyer.
  const supprimerFoyer = () => {
    if (purgeEnCours) return;
    if (
      !window.confirm(
        'Supprimer les données du foyer ? Semaines, pesées et dépenses partagées seront effacées sur le serveur du foyer et sur tous les téléphones.',
      )
    )
      return;
    if (!window.confirm('Dernière confirmation : cette action est définitive.')) return;
    setPurgeEnCours(true);
    purgerFoyer()
      .catch(() => setSyncErreur('Suppression impossible : réessaie plus tard.'))
      .finally(() => setPurgeEnCours(false));
  };

  return (
    <section className="detail-page">
      <h2>Foyer</h2>
      <div className="sync-bloc">
        {lireSessionPub() ? (
          <>
            {syncEtat !== 'off' && syncEtat !== 'hors-foyer' && <p className="muted">{ETAT_SYNC[syncEtat]}</p>}
            <button type="button" className="profil-ghost" onClick={deconnecterFoyer}>
              Déconnecter le foyer
            </button>
            <button
              type="button"
              className="sync-danger"
              onClick={supprimerFoyer}
              disabled={purgeEnCours}
            >
              {purgeEnCours ? 'Suppression…' : 'Supprimer les données du foyer'}
            </button>
          </>
        ) : codeCree ? (
          <>
            <p className="sync-code">{codeCree}</p>
            <button type="button" className="profil-ghost" onClick={() => void copierCode()}>
              {copie ? 'Copié' : 'Copier le code'}
            </button>
            <p className="onb-hint">
              Notez ce code : il n'est pas stocké en clair. Il sera demandé sur
              l'autre téléphone (« Se connecter au foyer »).
            </p>
            <button
              type="button"
              className="profil-ghost"
              onClick={() => void connecterApresCreation()}
              disabled={syncOccupe}
            >
              {syncOccupe ? 'Connexion…' : 'C’est noté — connecter ce téléphone'}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="profil-ghost"
              onClick={() => void creerFoyerCode()}
              disabled={syncOccupe}
            >
              Créer un foyer
            </button>
            <div className="onboarding-field">
              <label htmlFor="sync-code">Code de foyer</label>
              <input
                id="sync-code"
                type="password"
                value={codeFoyer}
                onChange={(e) => {
                  setSyncErreur(null);
                  setCodeFoyer(e.target.value);
                }}
              />
            </div>
            <button
              type="button"
              className="profil-ghost"
              onClick={connecterFoyerCode}
              disabled={syncOccupe}
            >
              {syncOccupe ? 'Connexion…' : 'Se connecter au foyer'}
            </button>
          </>
        )}
        <Alerte texte={syncErreur} />
        <p className="onb-hint">
          Données synchronisées sur votre serveur (rituel.marco-studio.fr).
        </p>
      </div>
    </section>
  );
}
```
⚠️ Le libellé `C’est noté — connecter ce téléphone` utilise l'apostrophe typographique U+2019 (comme le reste de l'UI) — le test matche `/C'est noté/` avec U+2019.

- [ ] **Step 5: CSS — `.sync-code` (tokens obligatoires, garde-fou `tests/css-tokens.test.ts`)**

Dans `src/index.css`, à côté du bloc `.sync-bloc` :
```css
.sync-code {
  padding: var(--sp-12) var(--sp-16);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: var(--fs-h3);
  line-height: var(--lh-titre);
  font-weight: 600;
  letter-spacing: 0.04em;
  word-break: break-all;
  text-align: center;
}
```
⚠️ Vérifier le nom exact du token d'interlignage dans `:root` (ex. `--lh-titre`) et l'utiliser — aucun `font-size`/`line-height`/`padding` brut : le test `tests/css-tokens.test.ts` échoue sinon.

- [ ] **Step 6: Vert + e2e responsive + gate + commit**

Run: `npx vitest run tests/sync/ui.test.tsx tests/css-tokens.test.ts` → PASS ; `npm run e2e` (changement UI du Profil) → PASS ; gate.
```bash
git add src/components/profil/ProfilFoyer.tsx src/lib/sync/messages.ts src/index.css tests/sync/ui.test.tsx
git commit -m "feat: « Créer un foyer » depuis l'app — code d'invitation affiché une fois + note VPS"
```

### Task 12: Déploiement, docs, CHANGELOG, retrait `supabase/` + PR

**Files:**
- Modify: `.github/workflows/deploy.yml`, `README.md`, `AGENTS.md`, `CHANGELOG.md`, `docs/backend.md` (réécriture)
- Delete: `supabase/` (dossier entier)

- [ ] **Step 1: deploy.yml — la var build**

Remplacer les 3 lignes env du step Build par :
```yaml
          VITE_SYNC_URL: ${{ secrets.VITE_SYNC_URL }}
```
et le commentaire par :
```yaml
          # Sync optionnelle (voir docs/backend.md) : injectée au build, jamais
          # dans le repo. Sans secret, la sync reste inactive (build local, CI PR).
```

- [ ] **Step 2: Retirer `supabase/`**

```bash
git rm -r supabase
```
(`connexion-foyer`, `creer-foyer.mjs`, `migrations/` — tout est remplacé par `server/`.)

- [ ] **Step 3: docs/backend.md — réécriture complète**

Remplacer tout le fichier par :
````markdown
# Backend de synchronisation (VPS + SQLite)

La sync est **optionnelle** : sans `VITE_SYNC_URL` au build, l'app reste 100 %
locale (aucune requête réseau, aucune outbox). Elle sert à un seul cas :
retrouver semaines, coches, pesées, dépenses et profils sur les 2 téléphones
du foyer.

Spec : `docs/superpowers/specs/2026-09-26-sync-vps-sqlite-design.md`.
Guide serveur (systemd, proxy, backup) : `server/README.md`.

## Posture

- Les données vivent d'abord dans le téléphone (localStorage) ; le serveur est
  un miroir — l'app doit toujours être utilisable sans lui.
- Transparence : le bloc Profil → Foyer affiche « Données synchronisées sur
  votre serveur (rituel.marco-studio.fr). »
- Aucun secret dans le front : `VITE_SYNC_URL` est une URL publique ; le
  `JWT_SECRET` ne vit que dans `/etc/rituel.env` sur le VPS.

## 1. Installer le serveur (une fois)

Voir `server/README.md` : Node ≥ 20, `/srv/rituel`, `/var/lib/rituel/rituel.db`
(WAL), systemd `rituel-api.service`, reverse proxy `rituel.marco-studio.fr`
(nginx : `proxy_buffering off` — indispensable pour le SSE), backup cron
quotidien + rétention 14 jours. Secret : `openssl rand -hex 32` → `JWT_SECRET`.

## 2. Brancher l'app (build)

```bash
# local
VITE_SYNC_URL="https://rituel.marco-studio.fr" npm run build

# CI Deploy : secret GitHub VITE_SYNC_URL (Settings → Secrets → Actions)
```

Les téléphones se connectent ensuite **depuis l'app** :

- **Profil → Foyer → « Créer un foyer »** : un code d'invitation permanent est
  généré (phrase « mots d'herbes + 8 hex », ex. `romarin-basilic-3f9a2c7e`) ;
  il est affiché **une fois** (« Notez ce code : il n'est pas stocké en
  clair ») puis le téléphone se connecte ;
- **l'autre téléphone** : « Se connecter au foyer » avec ce code ;
- l'onboarding propose l'étape 6 optionnelle « Synchroniser les téléphones »
  (rejoindre un foyer existant).

## 3. Vérifier

1. Téléphone A : « Créer un foyer » → pastille bannière « Synchronisé ».
2. Téléphone B : « Se connecter au foyer » → la fusion union lui apporte les
   données du foyer (et pousse les siennes).
3. Cocher un item sur A → apparaît coché sur B (~1 s, SSE).
4. Mode avion : l'app continue hors ligne (outbox locale) ; au retour du
   réseau la file est vidée.
5. Indisponibilité du VPS → point en erreur ; un appui dessus (ou le retour du
   réseau) reconnecte en ~5 s sans recharger la page.

## Comment ça marche (résumé)

- **Outbox locale** (`sportapp:sync:outbox`) : toute mutation passe par
  `storage.ts` → `empilerMutation` (no-op sans env/token). Flush différée
  ~300 ms, dédup « dernier op gagne » par clé.
- **Pull/merge** : le SSE (debounce 150 ms) déclenche un pull ; le merge
  applique le remote sauf sur les clés en attente (l'outbox locale prime).
- **Connexion** : fusion union — le local part d'abord, puis le remote est
  fusionné, puis la flush pousse l'union (rien n'est écrasé ni perdu).
- **Purge** : « Supprimer les données du foyer » vide les 5 tables du foyer
  sur le serveur **avant** le local ; le foyer et son code survivent.
- **Déconnexion** : efface session + outbox locales ; le foyer garde ses
  données côté serveur.
- **Rotation / révocation du code** : supprimer la row du foyer dans SQLite
  (`sqlite3 /var/lib/rituel/rituel.db "delete from foyers where id = '…'"` —
  cascade sur les 5 tables) rend tous les JWT inertes ; recréer ensuite le
  foyer depuis l'app et reconnecter chaque téléphone (la fusion union repart
  des données locales de chacun).

## 4. Migration depuis Supabase (re-jumelage)

Les téléphones sont la source primaire ; Supabase n'était qu'un miroir.

1. **Avant tout** : vérifier les 2 téléphones « Synchronisé » sur Supabase
   (Supabase devient la copie de secours).
2. Ajouter le secret GitHub `VITE_SYNC_URL`, merger la PR → déploiement Pages
   → les PWA se mettent à jour (autoUpdate).
3. Téléphone A : Profil → « Créer un foyer » → noter le code. Téléphone B :
   « Se connecter au foyer » avec ce code.
4. La **fusion union existante** (`pousserTout` → merge outbox-prime → flush)
   repousse l'état local complet de chaque téléphone dans SQLite.
5. L'ancienne session Supabase (`sportapp:sync:token`) devient invalide avec
   le nouveau client : jusqu'au re-jumelage, l'app affiche `erreur`/formulaire
   de connexion — l'étape 3 la remplace d'abord (`demanderSession` réécrit la
   session).
6. Projet Supabase : mis en pause puis supprimé après vérification.
````

- [ ] **Step 4: AGENTS.md + README.md**

`AGENTS.md` :
- bullet du projet : « 100 % front + backend optionnel de sync (Supabase — voir `docs/backend.md`) » → « 100 % front + backend optionnel de sync (serveur VPS + SQLite — voir `docs/backend.md`) » ;
- structure : la ligne « `supabase/` # SQL + edge function + script foyer, hors tsconfig » devient « `server/` # serveur de sync VPS (Hono + better-sqlite3), hors tsconfig app ; ses propres scripts `npm run check` (typecheck + lint + test) » ;
- section Tests : ajouter une ligne « `server/test/` — vitest + SQLite en mémoire (serveur de sync, cf. `docs/backend.md`) ; exclu du vitest racine ».

`README.md` :
- note vie privée : « > Vie privée : données hébergées chez Supabase (région UE), accès limité au foyer. » → « > Vie privée : données synchronisées sur le serveur du foyer (VPS), accès limité au foyer. Sans configuration, l'app reste 100 % locale. » ;
- supprimer toute mention push/Supabase restante (`grep -n "Supabase\|push" README.md` → vide, hors historique).

- [ ] **Step 5: CHANGELOG.md**

Sous `## [Non publié]` :
- `### Ajouté` (à la fin de la liste existante) :
  ```markdown
  - Sync sur VPS personnel (Node + SQLite) : mini-serveur `server/` (Hono, better-sqlite3 WAL, API JSON + SSE temps réel ~1 s, JWT 365 j, code foyer PBKDF2, rate-limit, backup cron) remplaçant Supabase ; **création du foyer depuis l'app** (code d'invitation permanent affiché une fois, « mots d'herbes + 8 hex »), bouton « Créer un foyer » au Profil.
  ```
- `### Changé` :
  ```markdown
  - Sync : une seule variable de build `VITE_SYNC_URL` (remplace `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`) ; client sync en fetch natif + lecteur SSE (supabase-js retiré) ; engine/outbox/storage inchangés (port SyncClient identique, migration par re-jumelage des téléphones).
  ```
- `### Retiré` (section créée par la PR push — compléter) :
  ```markdown
  - Backend Supabase : projet, edge function `connexion-foyer`, script CLI `creer-foyer.mjs`, migrations SQL (dossier `supabase/` supprimé) — remplacés par le serveur VPS.
  ```

- [ ] **Step 6: Vérification complète + secret GitHub (⚠️ point opérateur)**

```bash
npm test && npm run typecheck && npm run lint && npm run build && npm run e2e
cd server && npm run check
```
**⚠️ Avant le merge** (sinon le deploy Pages buildera sans sync) :
```bash
gh secret set VITE_SYNC_URL --body "https://rituel.marco-studio.fr"
```
— à faire valider par Marc (le sous-domaine doit répondre : `curl -s -X POST https://rituel.marco-studio.fr/connexion -d '{}' -H 'Content-Type: application/json'` → `{"erreur":"code-refuse"}`).

- [ ] **Step 7: Push + PR**

```bash
git push -u origin feat/sync-vps-sqlite
gh pr create --title "feat: sync sur VPS + SQLite (serveur + client)" --body "## Résumé

Implémente la spec 2026-09-26-sync-vps-sqlite (§3, 4, 7, 8, 9, 11) :

- \`server/\` : Hono + better-sqlite3 (WAL) — \`POST /foyers\`, \`POST /connexion\`, \`GET/POST/DELETE /sync/:table\`, \`DELETE /sync\` (purge), \`GET /evenements\` (SSE, heartbeat 25 s) ; JWT HS256 365 j, PBKDF2 100 000 itérations, rate-limit 10 req/min/IP, CORS liste blanche ; tests vitest + SQLite en mémoire ; ops : systemd, nginx/Caddy, backup cron, \`deploy.sh\` ;
- front : \`VITE_SYNC_URL\` unique, \`client.ts\` en fetch natif + lecteur SSE, \`session.ts\` gagne \`creerFoyer\`/\`genererCodeFoyer\`, Profil → « Créer un foyer » (code affiché une fois) ; \`engine.ts\`/\`outbox.ts\`/\`storage.ts\` intacts ;
- \`supabase/\` supprimé ; \`@supabase/supabase-js\` retiré ; docs (backend.md, AGENTS.md, README) + CHANGELOG.

⚠️ Secret GitHub \`VITE_SYNC_URL\` à définir avant le merge (migration : re-jumelage des téléphones, cf. docs/backend.md §4)."
gh pr checks --watch
```
Merge (merge commit) une fois la CI verte — le déploiement Pages embarque `VITE_SYNC_URL`.
