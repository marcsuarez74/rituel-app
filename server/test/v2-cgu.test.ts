import { describe, expect, it } from 'vitest';
import { empreinteToken } from '../src/auth.js';
import { ouvrirDb } from '../src/db.js';
import { creerApp } from '../src/routes.js';
import { cguAcceptees, VERSION_CGU } from '../src/v2/cgu.js';

// Acceptation des CGU (plan 2026-10-16-app-native §A.4) : par appareil, version et date
// enregistrées côté serveur ; la génération des menus l'exigera (cguAcceptees).
const SECRET = 'secret-de-test-0123456789abcdef';

const creerContexte = () => {
  const db = ouvrirDb(':memory:');
  return { db, app: creerApp({ db, secret: SECRET }) };
};
type App = ReturnType<typeof creerContexte>['app'];

const creerFoyer = async (app: App) =>
  (await (await app.request('/v2/foyers', { method: 'POST' })).json()) as { code: string; jeton: string };
const accepter = (app: App, jeton: string | null, corps: unknown) =>
  app.request('/v2/cgu/acceptation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) },
    body: JSON.stringify(corps),
  });

describe('v2 CGU', () => {
  it('GET /v2/cgu → la version en vigueur, sans connexion', async () => {
    const { app } = creerContexte();
    const res = await app.request('/v2/cgu');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ version: VERSION_CGU });
  });

  it('accepter la version en vigueur → 204, version et date serveur enregistrées', async () => {
    const { app, db } = creerContexte();
    const { jeton } = await creerFoyer(app);
    expect(cguAcceptees(db, empreinteToken(jeton))).toBe(false);
    const avant = Date.now();
    expect((await accepter(app, jeton, { version: VERSION_CGU })).status).toBe(204);
    expect(cguAcceptees(db, empreinteToken(jeton))).toBe(true);
    const ligne = db.prepare('select version, accepte_le from v2_acceptations').get() as {
      version: string;
      accepte_le: string;
    };
    expect(ligne.version).toBe(VERSION_CGU);
    expect(Date.parse(ligne.accepte_le)).toBeGreaterThanOrEqual(avant - 1000);
  });

  it('accepter deux fois ne crée pas de doublon et garde la première date', async () => {
    const { app, db } = creerContexte();
    const { jeton } = await creerFoyer(app);
    await accepter(app, jeton, { version: VERSION_CGU });
    const premiere = (db.prepare('select accepte_le from v2_acceptations').get() as { accepte_le: string }).accepte_le;
    expect((await accepter(app, jeton, { version: VERSION_CGU })).status).toBe(204);
    const lignes = db.prepare('select accepte_le from v2_acceptations').all() as { accepte_le: string }[];
    expect(lignes).toEqual([{ accepte_le: premiere }]);
  });

  it('version périmée ou absente → 409 cgu-perimees, rien d\'enregistré', async () => {
    const { app, db } = creerContexte();
    const { jeton } = await creerFoyer(app);
    for (const corps of [{ version: '2000-01-01' }, {}]) {
      const res = await accepter(app, jeton, corps);
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ erreur: 'cgu-perimees', version: VERSION_CGU });
    }
    expect(cguAcceptees(db, empreinteToken(jeton))).toBe(false);
  });

  it('par appareil : un appareil qui rejoint le foyer doit accepter à son tour', async () => {
    const { app, db } = creerContexte();
    const foyer = await creerFoyer(app);
    await accepter(app, foyer.jeton, { version: VERSION_CGU });
    const rejoint = (await (
      await app.request('/v2/foyers/rejoindre', { method: 'POST', body: JSON.stringify({ code: foyer.code }) })
    ).json()) as { jeton: string };
    expect(cguAcceptees(db, empreinteToken(rejoint.jeton))).toBe(false);
  });

  it('sans connexion → 401 ; l\'appareil qui quitte le foyer emporte son acceptation', async () => {
    const { app, db } = creerContexte();
    expect((await accepter(app, null, { version: VERSION_CGU })).status).toBe(401);
    const { jeton } = await creerFoyer(app);
    await accepter(app, jeton, { version: VERSION_CGU });
    await app.request('/v2/foyers/moi', { method: 'DELETE', headers: { Authorization: `Bearer ${jeton}` } });
    expect((db.prepare('select count(*) as n from v2_acceptations').get() as { n: number }).n).toBe(0);
  });
});
