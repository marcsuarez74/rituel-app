import { serve } from '@hono/node-server';
import { dirname } from 'node:path';
import { ouvrirDb } from './db.js';
import { creerApp } from './routes.js';

// Boot VPS : secrets uniquement via l'environnement (systemd
// EnvironmentFile=/etc/rituel.env) — jamais dans le repo.
const secret = process.env.JWT_SECRET;
if (!secret) throw new Error('JWT_SECRET manquant — voir /etc/rituel.env');

const cheminDb = process.env.DB_PATH ?? 'rituel.db';
const db = ouvrirDb(cheminDb);
const origines = process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean);
const port = Number(process.env.PORT ?? 8787);

// STATIC_DIR : dossier de la PWA buildée (image Docker) — absent = API seule.
const statique = process.env.STATIC_DIR || undefined;

// Signaler un bug : jeton GitHub (Issues: read/write) via l'environnement, jamais dans le repo.
const bugs = {
  token: process.env.GITHUB_BUG_TOKEN || undefined,
  repo: process.env.GITHUB_REPO || undefined,
  api: process.env.GITHUB_API || undefined,
};

serve({
  fetch: creerApp({ db, secret, origines, statique, commit: process.env.APP_COMMIT, dataDir: dirname(cheminDb), bugs })
    .fetch,
  port,
});
console.log(`Rituel API sur :${port}`);

