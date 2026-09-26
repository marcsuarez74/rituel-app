import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { hashCode, signerToken, verifierCode, verifierToken } from './auth.js';
import { creerLimiteur } from './rate-limit.js';
import { creerRegistreSse, type RegistreSse } from './sse.js';

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
// (Task 5) — consumed par les routes sync à venir;
void DEFS;

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
  // Stubs pour Tasks 5-6 — utilisées par les routes à venir:
  void DEFS;
  void registre;
  void incrementerRev;

  return app;
};
