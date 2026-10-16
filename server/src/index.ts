import Anthropic from '@anthropic-ai/sdk';
import { serve } from '@hono/node-server';
import { dirname } from 'node:path';
import { ouvrirDb } from './db.js';
import { creerApp } from './routes.js';
import { creerAppelClaude, type Effort } from './v2/ia.js';

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

// Génération des menus de l'app native : clé API via l'environnement ; absente = 503.
const EFFORTS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];
const effort = EFFORTS.find((e) => e === process.env.IA_EFFORT) ?? 'medium';
const ia = process.env.ANTHROPIC_API_KEY
  ? creerAppelClaude({ client: new Anthropic(), modele: process.env.IA_MODELE || 'claude-opus-5-5', effort })
  : undefined;
const quotaJour = Number(process.env.IA_QUOTA_JOUR) || undefined;

serve({
  fetch: creerApp({
    db,
    secret,
    origines,
    statique,
    commit: process.env.APP_COMMIT,
    dataDir: dirname(cheminDb),
    bugs,
    v2: { ia, quotaJour },
  }).fetch,
  port,
});
console.log(`Rituel API sur :${port}`);

