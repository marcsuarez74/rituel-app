import { describe, expect, it } from 'vitest';
import { signerToken } from '../src/auth.js';
import { ouvrirDb } from '../src/db.js';
import { creerApp } from '../src/routes.js';

const SECRET = 'secret-de-test-0123456789abcdef';

const creerContexte = async () => {
  const db = ouvrirDb(':memory:');
  const app = creerApp({ db, secret: SECRET });
  await app.request('/foyers', { method: 'POST', body: JSON.stringify({ code: 'romarin-basilic-3f9a2c7e' }) });
  const res = await app.request('/connexion', { method: 'POST', body: JSON.stringify({ code: 'romarin-basilic-3f9a2c7e' }) });
  const token = ((await res.json()) as { token: string }).token;
  return { db, app, token };
};

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('server: POST /sync/:table (upsert)', () => {
  it('upsert weeks : payload objet stocké puis relu en objet', async () => {
    const { app, token } = await creerContexte();
    const payload = { raw: 'md', data: { meta: { semaine: '2026-S39' } } };
    const res = await app.request('/sync/weeks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ rows: [{ semaine: '2026-S39', payload, household_id: 'stampé-par-engine' }] }),
    });
    expect(res.status).toBe(200);
    const { rows } = (await (await app.request('/sync/weeks', { headers: bearer(token) })).json()) as {
      rows: Array<{ semaine: string; payload: unknown; updated_at: string }>;
    };
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payload).toEqual(payload); // objet, pas du texte
    expect(rows[0]!.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('checks : done booléen à l\u2019écriture, booléen à la lecture (pas 0/1)', async () => {
    const { app, token } = await creerContexte();
    await app.request('/sync/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ rows: [
        { semaine: '2026-S39', check_id: 'courses:c1', done: true },
        { semaine: '2026-S39', check_id: 'courses:c2', done: false },
      ] }),
    });
    const { rows } = (await (await app.request('/sync/checks', { headers: bearer(token) })).json()) as {
      rows: Array<{ check_id: string; done: unknown }>;
    };
    expect(rows.find((r) => r.check_id === 'courses:c1')!.done).toBe(true);
    expect(rows.find((r) => r.check_id === 'courses:c2')!.done).toBe(false);
  });

  it('weights/depenses : kg et total numériques', async () => {
    const { app, token } = await creerContexte();
    await app.request('/sync/weights', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ rows: [{ profil: 'marc', date_: '2026-09-25', kg: 78.4 }] }),
    });
    await app.request('/sync/depenses', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ rows: [{ date_: '2026-09-25', magasin_key: 'carrefour', magasin: 'Carrefour', total: 42.5 }] }),
    });
    const w = (await (await app.request('/sync/weights', { headers: bearer(token) })).json()) as { rows: Array<{ kg: unknown }> };
    const d = (await (await app.request('/sync/depenses', { headers: bearer(token) })).json()) as { rows: Array<{ total: unknown }> };
    expect(w.rows[0]!.kg).toBe(78.4);
    expect(d.rows[0]!.total).toBe(42.5);
  });

  it('household_id stampé par l\u2019engine est ignoré (jamais stocké, jamais clé)', async () => {
    const { app, token } = await creerContexte();
    await app.request('/sync/weeks', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ rows: [{ semaine: '2026-S39', payload: { raw: 'a', data: { meta: { semaine: '2026-S39' } } }, household_id: 'autre-foyer' }] }),
    });
    const { rows } = (await (await app.request('/sync/weeks', { headers: bearer(token) })).json()) as { rows: Array<Record<string, unknown>> };
    expect(rows[0]!.semaine).toBe('2026-S39');
    expect('household_id' in rows[0]!).toBe(false);
  });

  it('re-upsert même clé → remplace (dernier op gagne)', async () => {
    const { app, token } = await creerContexte();
    const post = (rows: unknown) =>
      app.request('/sync/checks', { method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) }, body: JSON.stringify({ rows }) });
    await post([{ semaine: 's', check_id: 'c', done: true }]);
    await post([{ semaine: 's', check_id: 'c', done: false }]);
    const { rows } = (await (await app.request('/sync/checks', { headers: bearer(token) })).json()) as { rows: Array<{ done: boolean }> };
    expect(rows).toHaveLength(1);
    expect(rows[0]!.done).toBe(false);
  });

  it('row illégale (clé vide, colonne manquante, non-objet, rows manquantes) → 400 et le serveur vit', async () => {
    const { app, token } = await creerContexte();
    const post = (rows: unknown) =>
      app.request('/sync/checks', { method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) }, body: JSON.stringify({ rows }) });
    expect((await post([{ semaine: '', check_id: 'c', done: true }])).status).toBe(400);
    expect((await post([{ semaine: 's', done: true }])).status).toBe(400); // colonne manquante
    expect((await post(['junk'])).status).toBe(400);
    expect((await post({})).status).toBe(400); // rows manquantes
    expect((await post([{ semaine: 'x', check_id: 'c', done: true }])).status).toBe(200); // serveur toujours debout
  });

  it('isolation : un 2ᵉ foyer ne voit pas les rows du 1ᵉʳ', async () => {
    const { app, token } = await creerContexte();
    await app.request('/sync/weights', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ rows: [{ profil: 'marc', date_: '2026-09-25', kg: 78.4 }] }),
    });
    await app.request('/foyers', { method: 'POST', body: JSON.stringify({ code: 'thym-menthe-12345678' }) });
    const resAutre = await app.request('/connexion', { method: 'POST', body: JSON.stringify({ code: 'thym-menthe-12345678' }) });
    const tokenAutre = ((await resAutre.json()) as { token: string }).token;
    const res = await app.request('/sync/weights', { headers: bearer(tokenAutre) });
    expect(((await res.json()) as { rows: unknown[] }).rows).toEqual([]);
  });

  it('404 table inconnue ; 401 token signé avec un autre secret', async () => {
    const { app, token } = await creerContexte();
    const res404 = await app.request('/sync/nimporte', { headers: bearer(token) });
    expect(res404.status).toBe(404);
    const faux = creerApp({ db: ouvrirDb(':memory:'), secret: 'autre-secret' });
    const res = await faux.request('/sync/weeks', { headers: bearer(signerToken('f', SECRET, 3600)) });
    expect(res.status).toBe(401);
  });
});

describe('server: DELETE /sync/:table', () => {
  it('delete par clés métier ; clefs illégales → 400', async () => {
    const { app, token } = await creerContexte();
    await app.request('/sync/checks', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ rows: [
        { semaine: 's', check_id: 'c1', done: true },
        { semaine: 's', check_id: 'c2', done: true },
      ] }),
    });
    const suppr = (clefs: unknown) =>
      app.request('/sync/checks', { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...bearer(token) }, body: JSON.stringify({ clefs }) });
    expect((await suppr([{ semaine: 's', check_id: 'c1' }])).status).toBe(200);
    const { rows } = (await (await app.request('/sync/checks', { headers: bearer(token) })).json()) as { rows: Array<{ check_id: string }> };
    expect(rows.map((r) => r.check_id)).toEqual(['c2']);
    expect((await suppr('junk')).status).toBe(400);
    expect((await suppr([{ semaine: 1 }])).status).toBe(400);
  });
});

describe('server: DELETE /sync (purge)', () => {
  it('vide les 5 tables du foyer, le foyer et son code survivent', async () => {
    const { app, token } = await creerContexte();
    const post = (table: string, rows: unknown) =>
      app.request(`/sync/${table}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) }, body: JSON.stringify({ rows }) });
    await post('weeks', [{ semaine: '2026-S39', payload: { raw: 'a', data: { meta: { semaine: '2026-S39' } } } }]);
    await post('checks', [{ semaine: '2026-S39', check_id: 'c', done: true }]);
    await post('weights', [{ profil: 'marc', date_: '2026-09-25', kg: 78 }]);
    await post('depenses', [{ date_: '2026-09-25', magasin_key: 'c', magasin: 'C', total: 1 }]);
    await post('profiles', [{ profil: 'marc', payload: { id: 'marc' } }]);

    const res = await app.request('/sync', { method: 'DELETE', headers: bearer(token) });
    expect(res.status).toBe(200);
    for (const t of ['weeks', 'checks', 'weights', 'depenses', 'profiles']) {
      expect(((await (await app.request(`/sync/${t}`, { headers: bearer(token) })).json()) as { rows: unknown[] }).rows).toEqual([]);
    }
    // Le foyer survit : reconnexion possible au même code.
    const ok = await app.request('/connexion', { method: 'POST', body: JSON.stringify({ code: 'romarin-basilic-3f9a2c7e' }) });
    expect(ok.status).toBe(200);
  });
});

