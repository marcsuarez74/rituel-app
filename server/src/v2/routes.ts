import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { Context } from 'hono';
import { DUREE_TOKEN_S, empreinteToken, signerToken, verifierToken } from '../auth.js';
import { creerLimiteur } from '../rate-limit.js';
import { CONTRAT } from './contrat.js';
import { deriverSecret, empreinteCode, genererCode, normaliserCode } from './foyer.js';
import { pousser, revCourante, tirer, validerLot } from './sync.js';

export interface LimitesV2 {
  /** Essais de /foyers/rejoindre par IP sur 15 min. */
  rejoindreParIp?: number | undefined;
  /** Essais de /foyers/rejoindre, toutes IP confondues, par heure. */
  rejoindreGlobal?: number | undefined;
}

export interface OptionsV2 {
  db: Database;
  secret: string;
  limites?: LimitesV2 | undefined;
}

type EnvV2 = { Variables: { foyerId: string; jeton: string } };

const QUINZE_MIN = 15 * 60_000;
const UNE_HEURE = 60 * 60_000;

// API de l'app native, montée sous /v2 par creerApp (avant la PWA).
export const creerRoutesV2 = ({ db, secret, limites }: OptionsV2): Hono<EnvV2> => {
  const v2 = new Hono<EnvV2>();
  const secretCode = deriverSecret(secret, 'code-foyer');
  const secretJeton = deriverSecret(secret, 'jeton');
  const limiteCreation = creerLimiteur({ max: 10, fenetreMs: 60_000 });
  const limiteRejoindreIp = creerLimiteur({ max: limites?.rejoindreParIp ?? 10, fenetreMs: QUINZE_MIN });
  const limiteRejoindreGlobal = creerLimiteur({ max: limites?.rejoindreGlobal ?? 100, fenetreMs: UNE_HEURE });

  const ip = (c: Context): string => c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const lireCorps = async (c: Context): Promise<Record<string, unknown> | null> => {
    try {
      const v: unknown = await c.req.json();
      return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };

  const nouvelAppareil = (foyerId: string): string => {
    const jeton = signerToken(foyerId, secretJeton);
    const maintenant = Date.now();
    db.prepare('insert into v2_appareils (jeton_empreinte, foyer_id, cree_le, expire_le) values (?, ?, ?, ?)').run(
      empreinteToken(jeton),
      foyerId,
      new Date(maintenant).toISOString(),
      new Date(maintenant + DUREE_TOKEN_S * 1000).toISOString(),
    );
    return jeton;
  };

  // Un nouveau code, unique : la contrainte unique tranche les (rares) collisions.
  const poserNouveauCode = (ecrire: (empreinte: string) => void): string => {
    for (let essai = 0; essai < 5; essai++) {
      const code = genererCode();
      try {
        ecrire(empreinteCode(code, secretCode));
        return code;
      } catch (e) {
        if (!(e instanceof Error) || !/UNIQUE/.test(e.message)) throw e;
      }
    }
    throw new Error('code-foyer : collisions répétées');
  };

  // Jeton signé avec le secret v2 ET appareil encore connecté (pas sorti du foyer).
  const auth = async (c: Context<EnvV2>, next: () => Promise<void>): Promise<Response | void> => {
    const h = c.req.header('Authorization');
    const jeton = h?.startsWith('Bearer ') ? h.slice(7) : null;
    const foyerId = jeton ? verifierToken(jeton, secretJeton) : null;
    const connecte =
      jeton &&
      foyerId &&
      db.prepare('select 1 from v2_appareils where jeton_empreinte = ? and foyer_id = ?').get(empreinteToken(jeton), foyerId);
    if (!jeton || !foyerId || !connecte) return c.json({ erreur: 'token-invalide' }, 401);
    c.set('foyerId', foyerId);
    c.set('jeton', jeton);
    await next();
  };

  v2.get('/contrat', (c) => c.json({ contrat: CONTRAT }));

  // ---- Foyer (plan §A.2) ----

  v2.post('/foyers', (c) => {
    if (!limiteCreation(ip(c))) return c.json({ erreur: 'trop-de-requetes' }, 429);
    const foyerId = randomUUID();
    const creer = db.transaction(() => {
      const code = poserNouveauCode((empreinte) =>
        db.prepare('insert into v2_foyers (id, code_empreinte, cree_le) values (?, ?, ?)').run(
          foyerId,
          empreinte,
          new Date().toISOString(),
        ),
      );
      return { code, jeton: nouvelAppareil(foyerId) };
    });
    return c.json({ foyerId, ...creer() }, 201);
  });

  // 6 caractères se devinent si on laisse essayer : limite par IP ET globale (une
  // attaque répartie sur plusieurs IP bute sur la seconde). Chaque essai compte.
  v2.post('/foyers/rejoindre', async (c) => {
    if (!limiteRejoindreIp(ip(c)) || !limiteRejoindreGlobal('*')) {
      return c.json({ erreur: 'trop-de-requetes' }, 429);
    }
    const corps = await lireCorps(c);
    const code = normaliserCode(corps?.code);
    if (!code) return c.json({ erreur: 'code-invalide' }, 400);
    const foyer = db.prepare('select id from v2_foyers where code_empreinte = ?').get(empreinteCode(code, secretCode)) as
      | { id: string }
      | undefined;
    if (!foyer) return c.json({ erreur: 'code-inconnu' }, 404);
    return c.json({ foyerId: foyer.id, jeton: nouvelAppareil(foyer.id) });
  });

  // Réinitialiser le code : l'ancien cesse de marcher, les appareils connectés le restent.
  v2.post('/foyers/code', auth, (c) => {
    const foyerId = c.get('foyerId');
    const code = poserNouveauCode((empreinte) =>
      db.prepare('update v2_foyers set code_empreinte = ? where id = ?').run(empreinte, foyerId),
    );
    return c.json({ code });
  });

  // Quitter le foyer : le jeton de l'appareil est refusé ensuite ; le dernier appareil
  // emporte le foyer (et, par cascade, toutes ses données v2).
  v2.delete('/foyers/moi', auth, (c) => {
    const foyerId = c.get('foyerId');
    db.transaction(() => {
      db.prepare('delete from v2_appareils where jeton_empreinte = ?').run(empreinteToken(c.get('jeton')));
      const restants = db.prepare('select count(*) as n from v2_appareils where foyer_id = ?').get(foyerId) as {
        n: number;
      };
      if (restants.n === 0) db.prepare('delete from v2_foyers where id = ?').run(foyerId);
    })();
    return c.body(null, 204);
  });

  // ---- État partagé (plan §A.3) ----

  v2.get('/sync', auth, (c) => {
    const foyerId = c.get('foyerId');
    const depuis = Number.parseInt(c.req.query('depuis') ?? '', 10);
    const entites = tirer(db, foyerId, Number.isFinite(depuis) && depuis > 0 ? depuis : 0);
    return c.json({ contrat: CONTRAT, rev: revCourante(db, foyerId), entites });
  });

  v2.post(
    '/sync',
    auth,
    bodyLimit({ maxSize: 8 * 1024 * 1024, onError: (c) => c.json({ erreur: 'lot-trop-gros' }, 413) }),
    async (c) => {
      const lot = validerLot((await lireCorps(c))?.entites);
      if (!lot) return c.json({ erreur: 'lot-invalide' }, 400);
      return c.json({ contrat: CONTRAT, ...pousser(db, c.get('foyerId'), lot) });
    },
  );

  // Toujours en dernier : une route /v2 inconnue ne doit jamais tomber sur la PWA.
  v2.all('*', (c) => c.json({ erreur: 'introuvable' }, 404));
  return v2;
};
