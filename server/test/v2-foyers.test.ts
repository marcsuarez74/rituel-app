import { describe, expect, it } from 'vitest';
import { ouvrirDb } from '../src/db.js';
import { creerApp } from '../src/routes.js';
import { ALPHABET_CODE, genererCode, normaliserCode } from '../src/v2/foyer.js';

// Foyer de l'app native (plan 2026-10-16-app-native §A.2) : code de 6 caractères,
// stocké en empreinte HMAC recherchable, rejoindre fortement limité.
const SECRET = 'secret-de-test-0123456789abcdef';

const creerContexte = (limites?: { rejoindreParIp?: number; rejoindreGlobal?: number }) => {
  const db = ouvrirDb(':memory:');
  return { db, app: creerApp({ db, secret: SECRET, v2: { limites } }) };
};

type App = ReturnType<typeof creerContexte>['app'];

const post = (app: App, chemin: string, corps?: unknown, entetes: Record<string, string> = {}) =>
  app.request(chemin, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...entetes },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });

const creerFoyer = async (app: App) => {
  const res = await post(app, '/v2/foyers');
  return (await res.json()) as { foyerId: string; code: string; jeton: string };
};

const bearer = (jeton: string) => ({ Authorization: `Bearer ${jeton}` });

describe('v2 foyer : le code', () => {
  it('genererCode : 6 caractères de l\'alphabet sans ambiguïté (pas de 0, O, 1, I, L)', () => {
    for (const c of '0O1IL') expect(ALPHABET_CODE).not.toContain(c);
    for (let i = 0; i < 200; i++) {
      const code = genererCode();
      expect(code).toHaveLength(6);
      for (const c of code) expect(ALPHABET_CODE).toContain(c);
    }
  });

  it('normaliserCode : majuscules, espaces et tirets ignorés ; sinon null', () => {
    expect(normaliserCode(' ab3-k9m ')).toBe('AB3K9M');
    expect(normaliserCode('AB3K9')).toBeNull();
    expect(normaliserCode('AB3K9MX')).toBeNull();
    expect(normaliserCode('AB0K9M')).toBeNull();
    expect(normaliserCode(42)).toBeNull();
  });
});

describe('v2 foyer : POST /v2/foyers', () => {
  it('crée un foyer : 201 { foyerId, code, jeton } ; le code n\'est jamais stocké en clair', async () => {
    const { app, db } = creerContexte();
    const res = await post(app, '/v2/foyers');
    expect(res.status).toBe(201);
    const { foyerId, code, jeton } = (await res.json()) as { foyerId: string; code: string; jeton: string };
    expect(foyerId).toMatch(/^[\da-f-]{36}$/);
    expect(normaliserCode(code)).toBe(code);
    expect(jeton.split('.')).toHaveLength(3);
    const ligne = db.prepare('select code_empreinte from v2_foyers where id = ?').get(foyerId) as {
      code_empreinte: string;
    };
    expect(ligne.code_empreinte).not.toContain(code);
    expect(ligne.code_empreinte).toMatch(/^[\da-f]{64}$/);
  });

  it('création limitée par IP → 429', async () => {
    const { app } = creerContexte();
    const statuts: number[] = [];
    for (let i = 0; i < 11; i++) statuts.push((await post(app, '/v2/foyers')).status);
    expect(statuts.slice(0, 10).every((s) => s === 201)).toBe(true);
    expect(statuts[10]).toBe(429);
  });
});

describe('v2 foyer : POST /v2/foyers/rejoindre', () => {
  it('bon code (saisi en minuscules) → 200 { foyerId, jeton }', async () => {
    const { app } = creerContexte();
    const foyer = await creerFoyer(app);
    const res = await post(app, '/v2/foyers/rejoindre', { code: foyer.code.toLowerCase() });
    expect(res.status).toBe(200);
    const corps = (await res.json()) as { foyerId: string; jeton: string };
    expect(corps.foyerId).toBe(foyer.foyerId);
    expect(corps.jeton).not.toBe(foyer.jeton);
  });

  it('code mal formé → 400 code-invalide ; code inconnu → 404 code-inconnu ; corps cassé → 400', async () => {
    const { app } = creerContexte();
    const r1 = await post(app, '/v2/foyers/rejoindre', { code: 'abc' });
    expect(r1.status).toBe(400);
    expect(await r1.json()).toEqual({ erreur: 'code-invalide' });
    const r2 = await post(app, '/v2/foyers/rejoindre', { code: 'ABCDEF' });
    expect(r2.status).toBe(404);
    expect(await r2.json()).toEqual({ erreur: 'code-inconnu' });
    const r3 = await app.request('/v2/foyers/rejoindre', { method: 'POST', body: '{oops' });
    expect(r3.status).toBe(400);
  });

  it('limité par IP : au-delà, 429 même avec le bon code ; une autre IP passe', async () => {
    const { app } = creerContexte({ rejoindreParIp: 3, rejoindreGlobal: 100 });
    const foyer = await creerFoyer(app);
    const ip = { 'x-forwarded-for': '203.0.113.7' };
    for (let i = 0; i < 3; i++) await post(app, '/v2/foyers/rejoindre', { code: 'ABCDEF' }, ip);
    expect((await post(app, '/v2/foyers/rejoindre', { code: foyer.code }, ip)).status).toBe(429);
    const autre = { 'x-forwarded-for': '203.0.113.8' };
    expect((await post(app, '/v2/foyers/rejoindre', { code: foyer.code }, autre)).status).toBe(200);
  });

  it('limité globalement : des IP différentes ne contournent pas la limite', async () => {
    const { app } = creerContexte({ rejoindreParIp: 100, rejoindreGlobal: 5 });
    const statuts: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await post(app, '/v2/foyers/rejoindre', { code: 'ABCDEF' }, { 'x-forwarded-for': `198.51.100.${i}` });
      statuts.push(res.status);
    }
    expect(statuts.slice(0, 5).every((s) => s === 404)).toBe(true);
    expect(statuts[5]).toBe(429);
  });
});

describe('v2 foyer : POST /v2/foyers/code (réinitialiser)', () => {
  it('nouveau code ; l\'ancien est refusé ; les appareils connectés le restent', async () => {
    const { app } = creerContexte();
    const foyer = await creerFoyer(app);
    const res = await post(app, '/v2/foyers/code', undefined, bearer(foyer.jeton));
    expect(res.status).toBe(200);
    const { code } = (await res.json()) as { code: string };
    expect(code).not.toBe(foyer.code);
    expect((await post(app, '/v2/foyers/rejoindre', { code: foyer.code })).status).toBe(404);
    expect((await post(app, '/v2/foyers/rejoindre', { code })).status).toBe(200);
    expect((await post(app, '/v2/foyers/code', undefined, bearer(foyer.jeton))).status).toBe(200);
  });

  it('sans jeton, jeton faux ou jeton de la PWA → 401', async () => {
    const { app } = creerContexte();
    expect((await post(app, '/v2/foyers/code')).status).toBe(401);
    expect((await post(app, '/v2/foyers/code', undefined, bearer('a.b.c'))).status).toBe(401);
    const pwa = await post(app, '/foyers', { code: 'romarin-basilic-3f9a2c7e' });
    expect(pwa.status).toBe(201);
    const connexion = await post(app, '/connexion', { code: 'romarin-basilic-3f9a2c7e' });
    const { token } = (await connexion.json()) as { token: string };
    expect((await post(app, '/v2/foyers/code', undefined, bearer(token))).status).toBe(401);
  });

  it('un jeton v2 n\'ouvre pas l\'API de la PWA', async () => {
    const { app } = creerContexte();
    const foyer = await creerFoyer(app);
    expect((await app.request('/sync/weeks', { headers: bearer(foyer.jeton) })).status).toBe(401);
  });
});

describe('v2 foyer : DELETE /v2/foyers/moi (quitter)', () => {
  it('l\'appareil quitte : son jeton est refusé ; le foyer reste pour les autres', async () => {
    const { app, db } = creerContexte();
    const foyer = await creerFoyer(app);
    const autre = (await (await post(app, '/v2/foyers/rejoindre', { code: foyer.code })).json()) as { jeton: string };
    const res = await app.request('/v2/foyers/moi', { method: 'DELETE', headers: bearer(foyer.jeton) });
    expect(res.status).toBe(204);
    expect((await post(app, '/v2/foyers/code', undefined, bearer(foyer.jeton))).status).toBe(401);
    expect((await post(app, '/v2/foyers/code', undefined, bearer(autre.jeton))).status).toBe(200);
    expect(db.prepare('select 1 from v2_foyers where id = ?').get(foyer.foyerId)).toBeTruthy();
  });

  it('le dernier appareil quitte : le foyer est supprimé', async () => {
    const { app, db } = creerContexte();
    const foyer = await creerFoyer(app);
    await app.request('/v2/foyers/moi', { method: 'DELETE', headers: bearer(foyer.jeton) });
    expect(db.prepare('select 1 from v2_foyers where id = ?').get(foyer.foyerId)).toBeUndefined();
    expect((await post(app, '/v2/foyers/rejoindre', { code: foyer.code })).status).toBe(404);
  });
});
