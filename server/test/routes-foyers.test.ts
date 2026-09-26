import { describe, expect, it } from 'vitest';
import { ouvrirDb } from '../src/db.js';
import { creerApp } from '../src/routes.js';

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
