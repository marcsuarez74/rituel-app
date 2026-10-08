import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Database } from 'better-sqlite3';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { hashCode, signerToken, verifierCode, verifierToken } from './auth.js';
import {
  CAPTURE_MAX,
  NOM_CAPTURE,
  QUOTA_JOUR,
  TYPES_MIME,
  construireCorps,
  extensionImage,
  lireAppareil,
  validerChamps,
} from './bugs.js';
import { creerLimiteur } from './rate-limit.js';
import { creerRegistreSse, type RegistreSse } from './sse.js';

export type TableSync = 'weeks' | 'checks' | 'weights' | 'depenses' | 'profiles' | 'etat';

// Clés métier (PK sans foyer) + colonnes de valeur par table — l'app envoie
// exactement ces noms (port SyncClient inchangé). `household_id` stampé par
// l'engine est ignoré : le serveur fait foi avec son token.
const DEFS: Record<TableSync, { cles: string[]; colonnes: string[] }> = {
  weeks: { cles: ['semaine'], colonnes: ['payload'] },
  checks: { cles: ['semaine', 'check_id'], colonnes: ['done'] },
  weights: { cles: ['profil', 'date_'], colonnes: ['kg'] },
  depenses: { cles: ['date_', 'magasin_key'], colonnes: ['magasin', 'total'] },
  profiles: { cles: ['profil'], colonnes: ['payload'] },
  etat: { cles: ['cle'], colonnes: ['payload'] },
};
const ORIGINES_DEFAUT = ['https://marcsuarez74.github.io', 'http://localhost:5173'];

export interface OptionsApp {
  db: Database;
  secret: string;
  /** Liste blanche CORS complète — remplace le défaut si fournie. */
  origines?: string[];
  /** Tests : heartbeat SSE raccourci. */
  heartbeatMs?: number;
  /** Dossier de la PWA buildée (dist/) : servie sur la même origine que l'API. */
  statique?: string;
  /** SHA git déployé (build arg GIT_SHA → APP_COMMIT), exposé par /sante. */
  commit?: string;
  /** Dossier de données (captures de bugs dans `<dataDir>/bugs`). Défaut : ./data. */
  dataDir?: string;
  /** "Signaler un bug" → issue GitHub. `fetch` injectable pour les tests. */
  bugs?: {
    token?: string | undefined;
    repo?: string | undefined;
    api?: string | undefined;
    /** Origine publique servant les captures (liens de l'issue). */
    urlPublique?: string | undefined;
    fetch?: typeof fetch | undefined;
  };
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

// Fichiers versionnés par Vite (assets/…-hash) : cache long ; le reste (index,
// sw.js, manifest, icônes) revalidé à chaque visite pour que la PWA se mette à jour.
const IMMUABLE = 'public, max-age=31536000, immutable';
const cacheDe = (chemin: string): string => (chemin.startsWith('/assets/') ? IMMUABLE : 'no-cache');

export const creerApp = ({ db, secret, origines, heartbeatMs, statique, commit, dataDir, bugs }: OptionsApp): Hono<EnvApp> => {
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
  app.post('/bugs', auth); // POST seulement : le GET des captures reste public

  // Sonde de santé (Docker HEALTHCHECK, vérification après déploiement).
  app.get('/sante', (c) => c.json({ ok: true, commit: commit || 'inconnu' }));

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

  // Purge du foyer : les tables de sync sont vidées, le foyer et son code survivent
  // (même sémantique qu'au temps de Supabase — purge ≠ suppression du foyer).
  app.delete('/sync', (c) => {
    const foyerId = c.get('foyerId');
    for (const t of Object.keys(DEFS)) {
      db.prepare(`delete from ${t} where foyer_id = ?`).run(foyerId);
    }
    const rev = incrementerRev(foyerId);
    registre.diffuser(foyerId, rev);
    return c.json({ ok: true });
  });

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

  // ---- Signaler un bug (issue GitHub) ----

  const dossierBugs = join(dataDir ?? 'data', 'bugs');

  app.post('/bugs', async (c) => {
    const foyerId = c.get('foyerId');
    if (Number(c.req.header('content-length') ?? 0) > CAPTURE_MAX + 200_000) {
      return c.json({ erreur: 'trop-volumineux' }, 413);
    }
    let form: FormData;
    try {
      form = await c.req.formData();
    } catch {
      return c.json({ erreur: 'formulaire-invalide' }, 400);
    }
    const champs = validerChamps(form);
    if (!champs) return c.json({ erreur: 'champs-invalides' }, 400);

    const fichier = form.get('capture');
    let octets: Buffer | null = null;
    let extension: 'png' | 'jpg' | 'webp' | null = null;
    if (fichier && typeof fichier !== 'string' && fichier.size > 0) {
      if (fichier.size > CAPTURE_MAX) return c.json({ erreur: 'capture-trop-grosse' }, 400);
      octets = Buffer.from(await fichier.arrayBuffer());
      extension = extensionImage(octets);
      if (!extension) return c.json({ erreur: 'capture-invalide' }, 400);
    }

    const { n } = db
      .prepare(
        "select count(*) as n from bug_reports where foyer_id = ? and date(created_at,'localtime') = date('now','localtime')",
      )
      .get(foyerId) as { n: number };
    if (n >= QUOTA_JOUR) return c.json({ erreur: 'quota-atteint' }, 429);

    if (!bugs?.token) return c.json({ erreur: 'signalement-indisponible' }, 503);

    // Le fichier n'est écrit qu'une fois tout le reste validé (pas d'orphelin).
    let nomCapture: string | null = null;
    if (octets && extension) {
      nomCapture = `${randomUUID()}.${extension}`;
      mkdirSync(dossierBugs, { recursive: true });
      writeFileSync(join(dossierBugs, nomCapture), octets);
    }
    const supprimerCapture = (): void => {
      if (!nomCapture) return;
      try {
        unlinkSync(join(dossierBugs, nomCapture));
      } catch {
        /* déjà absent */
      }
    };

    const urlPublique = bugs.urlPublique ?? 'https://rituel.marco-studio.fr';
    const corps = construireCorps(
      champs,
      lireAppareil(form.get('device')),
      c.req.header('user-agent') ?? '',
      nomCapture ? `${urlPublique}/bugs/capture/${nomCapture}` : null,
      new Date(),
    );
    const prefixe = champs.type === 'bug' ? '[Bug]' : '[Amélioration]';
    try {
      const res = await (bugs.fetch ?? fetch)(
        `${bugs.api ?? 'https://api.github.com'}/repos/${bugs.repo ?? 'marcsuarez74/rituel-app'}/issues`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${bugs.token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
            'User-Agent': 'rituel-app',
          },
          body: JSON.stringify({ title: `${prefixe} ${champs.titre}`, body: corps, labels: [champs.type] }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!res.ok) {
        // Ni jeton ni corps de réponse dans les logs : le statut seul.
        console.error(`GitHub issues: statut ${res.status}`);
        supprimerCapture();
        return c.json({ erreur: 'github-indisponible' }, 502);
      }
      const issue = (await res.json()) as { number?: number; html_url?: string };
      db.prepare(
        'insert into bug_reports (foyer_id, type, titre, issue_url, capture_name, created_at) values (?, ?, ?, ?, ?, ?)',
      ).run(foyerId, champs.type, champs.titre, issue.html_url ?? '', nomCapture, new Date().toISOString());
      return c.json({ ok: true, issueUrl: issue.html_url ?? '', issueNumber: issue.number ?? 0 });
    } catch {
      console.error('GitHub issues: appel impossible');
      supprimerCapture();
      return c.json({ erreur: 'github-indisponible' }, 502);
    }
  });

  // Captures : publiques (GitHub les affiche), nom = UUID strict (pas de traversée).
  app.get('/bugs/capture/:name', (c) => {
    const nom = c.req.param('name');
    const chemin = join(dossierBugs, nom);
    if (!NOM_CAPTURE.test(nom) || !existsSync(chemin)) return c.json({ erreur: 'introuvable' }, 404);
    return new Response(readFileSync(chemin), {
      headers: {
        'Content-Type': TYPES_MIME[extname(nom).slice(1)] ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });

  // ---- PWA (après l'API : ses routes gardent la main) ----

  if (statique) {
    const fichiers = serveStatic({ root: statique });
    app.use('*', async (c, next) => {
      const res = await fichiers(c, async () => {});
      if (!res) return next();
      res.headers.set('Cache-Control', cacheDe(c.req.path));
      return res;
    });
    // Chemin sans extension inconnu → l'app (navigation interne) ; un fichier
    // manquant reste un 404.
    app.get('*', (c) => {
      if (extname(c.req.path)) return c.notFound();
      c.header('Cache-Control', 'no-cache');
      return c.html(readFileSync(join(statique, 'index.html'), 'utf8'));
    });
  }

  return app;
};
