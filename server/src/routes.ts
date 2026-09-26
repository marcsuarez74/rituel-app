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

  // ---- Sync (auth Bearer) ----

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
    const colonnes = ['foyer_id', ...def.cles, ...def.colonnes, 'updated_at'];
    const insert = db.prepare(
      `insert or replace into ${table} (${colonnes.join(', ')}) values (${colonnes.map(() => '?').join(', ')})`,
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

  return app;
};
