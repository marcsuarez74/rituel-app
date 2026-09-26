import { serve } from '@hono/node-server';
import { ouvrirDb } from './db.js';
import { creerApp } from './routes.js';

// Boot VPS : secrets uniquement via l'environnement (systemd
// EnvironmentFile=/etc/rituel.env) — jamais dans le repo.
const secret = process.env.JWT_SECRET;
if (!secret) throw new Error('JWT_SECRET manquant — voir /etc/rituel.env');

const db = ouvrirDb(process.env.DB_PATH ?? 'rituel.db');
const origines = process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean);
const port = Number(process.env.PORT ?? 8787);

serve({ fetch: creerApp({ db, secret, origines }).fetch, port });
console.log(`Rituel API sur :${port}`);

