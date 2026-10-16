import { describe, expect, it } from 'vitest';
import { ouvrirDb } from '../src/db.js';
import { creerApp } from '../src/routes.js';
import { CONTRAT } from '../src/v2/contrat.js';

// État partagé du foyer (plan 2026-10-16-app-native §A.3) : une ligne par entité,
// « dernière écriture gagne » sur l'horodatage de l'appareil, curseur `rev` par foyer.
const SECRET = 'secret-de-test-0123456789abcdef';

const creerContexte = () => {
  const db = ouvrirDb(':memory:');
  return { db, app: creerApp({ db, secret: SECRET }) };
};
type App = ReturnType<typeof creerContexte>['app'];

interface Entite {
  type: string;
  id: string;
  donnees: unknown;
  modifie_le: string;
  supprime?: boolean;
}
interface ReponseTirer {
  contrat: number;
  rev: number;
  entites: (Entite & { supprime: boolean; version: number })[];
}

const creerFoyer = async (app: App) => {
  const res = await app.request('/v2/foyers', { method: 'POST' });
  return (await res.json()) as { foyerId: string; code: string; jeton: string };
};
const pousser = (app: App, jeton: string, entites: unknown) =>
  app.request('/v2/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
    body: JSON.stringify({ entites }),
  });
const tirer = async (app: App, jeton: string, depuis = 0) => {
  const res = await app.request(`/v2/sync?depuis=${depuis}`, { headers: { Authorization: `Bearer ${jeton}` } });
  expect(res.status).toBe(200);
  return (await res.json()) as ReponseTirer;
};

const T1 = '2026-10-16T10:00:00.000Z';
const T2 = '2026-10-16T11:00:00.000Z';

describe('v2 sync : pousser puis tirer', () => {
  it('une entité poussée revient au tirage, avec le contrat et le curseur', async () => {
    const { app } = creerContexte();
    const { jeton } = await creerFoyer(app);
    const res = await pousser(app, jeton, [{ type: 'budget', id: 'courant', donnees: { montant: 400 }, modifie_le: T1 }]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ contrat: CONTRAT, rev: 1, ignorees: [] });
    const tire = await tirer(app, jeton);
    expect(tire.contrat).toBe(CONTRAT);
    expect(tire.rev).toBe(1);
    expect(tire.entites).toEqual([
      { type: 'budget', id: 'courant', donnees: { montant: 400 }, modifie_le: T1, supprime: false, version: 1 },
    ]);
  });

  it('?depuis=n ne renvoie que ce qui a changé après n', async () => {
    const { app } = creerContexte();
    const { jeton } = await creerFoyer(app);
    await pousser(app, jeton, [{ type: 'courses', id: 'a', donnees: 1, modifie_le: T1 }]);
    await pousser(app, jeton, [{ type: 'courses', id: 'b', donnees: 2, modifie_le: T1 }]);
    const tire = await tirer(app, jeton, 1);
    expect(tire.rev).toBe(2);
    expect(tire.entites.map((e) => e.id)).toEqual(['b']);
    expect((await tirer(app, jeton, 2)).entites).toEqual([]);
  });

  it('un autre appareil du foyer voit les écritures ; un autre foyer non', async () => {
    const { app } = creerContexte();
    const foyer = await creerFoyer(app);
    const rejoint = await app.request('/v2/foyers/rejoindre', {
      method: 'POST',
      body: JSON.stringify({ code: foyer.code }),
    });
    const { jeton: jeton2 } = (await rejoint.json()) as { jeton: string };
    await pousser(app, foyer.jeton, [{ type: 'menus', id: 'm1', donnees: { s: 1 }, modifie_le: T1 }]);
    expect((await tirer(app, jeton2)).entites).toHaveLength(1);
    const etranger = await creerFoyer(app);
    expect((await tirer(app, etranger.jeton)).entites).toEqual([]);
  });
});

describe('v2 sync : dernière écriture gagne', () => {
  it('une écriture plus récente remplace ; une plus ancienne est ignorée et signalée', async () => {
    const { app } = creerContexte();
    const { jeton } = await creerFoyer(app);
    await pousser(app, jeton, [{ type: 'budget', id: 'courant', donnees: { montant: 400 }, modifie_le: T1 }]);
    await pousser(app, jeton, [{ type: 'budget', id: 'courant', donnees: { montant: 450 }, modifie_le: T2 }]);
    const vieille = await pousser(app, jeton, [{ type: 'budget', id: 'courant', donnees: { montant: 1 }, modifie_le: T1 }]);
    expect(((await vieille.json()) as { ignorees: unknown }).ignorees).toEqual([{ type: 'budget', id: 'courant' }]);
    const tire = await tirer(app, jeton);
    expect(tire.entites[0]?.donnees).toEqual({ montant: 450 });
    expect(tire.rev).toBe(2);
  });

  it('suppression : l\'entité revient marquée supprimée, sans données', async () => {
    const { app } = creerContexte();
    const { jeton } = await creerFoyer(app);
    await pousser(app, jeton, [{ type: 'courses', id: 'a', donnees: { x: 1 }, modifie_le: T1 }]);
    await pousser(app, jeton, [{ type: 'courses', id: 'a', donnees: null, modifie_le: T2, supprime: true }]);
    const [e] = (await tirer(app, jeton, 1)).entites;
    expect(e).toMatchObject({ type: 'courses', id: 'a', donnees: null, supprime: true, version: 2 });
  });
});

describe('v2 sync : garde-fous', () => {
  it('sans jeton → 401', async () => {
    const { app } = creerContexte();
    expect((await app.request('/v2/sync?depuis=0')).status).toBe(401);
    expect((await app.request('/v2/sync', { method: 'POST', body: '{}' })).status).toBe(401);
  });

  it('lot invalide → 400 et rien n\'est écrit (tout ou rien)', async () => {
    const { app } = creerContexte();
    const { jeton } = await creerFoyer(app);
    const invalides: unknown[] = [
      'pas-un-tableau',
      [{ type: 'Majuscule', id: 'a', donnees: 1, modifie_le: T1 }],
      [{ type: 'budget', id: '', donnees: 1, modifie_le: T1 }],
      [{ type: 'budget', id: 'a', donnees: 1, modifie_le: 'hier' }],
      [{ type: 'budget', id: 'a', modifie_le: T1 }],
      [
        { type: 'budget', id: 'ok', donnees: 1, modifie_le: T1 },
        { type: 'budget', id: 'a', donnees: 'x'.repeat(600_000), modifie_le: T1 },
      ],
      Array.from({ length: 501 }, (_, i) => ({ type: 'cases', id: `c${i}`, donnees: true, modifie_le: T1 })),
    ];
    for (const entites of invalides) {
      const res = await pousser(app, jeton, entites);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ erreur: 'lot-invalide' });
    }
    expect((await tirer(app, jeton)).entites).toEqual([]);
    const casse = await app.request('/v2/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jeton}` },
      body: '{oops',
    });
    expect(casse.status).toBe(400);
  });

  it('corps de plus de 8 Mo → 413, avant toute lecture', async () => {
    const { app } = creerContexte();
    const { jeton } = await creerFoyer(app);
    const lourd = Array.from({ length: 20 }, (_, i) => ({ type: 'menus', id: `m${i}`, donnees: 'x'.repeat(500_000), modifie_le: T1 }));
    const res = await pousser(app, jeton, lourd);
    expect(res.status).toBe(413);
    expect((await tirer(app, jeton)).entites).toEqual([]);
  });

  it('?depuis absent ou faux → depuis 0', async () => {
    const { app } = creerContexte();
    const { jeton } = await creerFoyer(app);
    await pousser(app, jeton, [{ type: 'budget', id: 'courant', donnees: 1, modifie_le: T1 }]);
    const res = await app.request('/v2/sync?depuis=abc', { headers: { Authorization: `Bearer ${jeton}` } });
    expect(((await res.json()) as ReponseTirer).entites).toHaveLength(1);
  });

  it('le foyer supprimé emporte son état (cascade)', async () => {
    const { app, db } = creerContexte();
    const { jeton } = await creerFoyer(app);
    await pousser(app, jeton, [{ type: 'budget', id: 'courant', donnees: 1, modifie_le: T1 }]);
    await app.request('/v2/foyers/moi', { method: 'DELETE', headers: { Authorization: `Bearer ${jeton}` } });
    expect((db.prepare('select count(*) as n from v2_entites').get() as { n: number }).n).toBe(0);
  });
});
