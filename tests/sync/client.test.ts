import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { creerClient } from '../../src/lib/sync/client';
import { definirSession, effacerSession } from '../../src/lib/sync/session';

vi.mock('../../src/lib/sync/config', () => ({
  SYNC_URL: 'https://rituel.example.fr',
  syncActif: () => true,
}));

vi.mock('../../src/lib/sync/sse', () => ({
  abonnerSse: vi.fn(() => () => {}),
}));

import { abonnerSse } from '../../src/lib/sync/sse';

interface Appel {
  url: string;
  init: RequestInit;
}

describe('sync: client VPS (fetch natif)', () => {
  let appels: Appel[];

  beforeEach(() => {
    localStorage.clear();
    definirSession('jwt.tok', 'foyer-1');
    appels = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown, init?: RequestInit) => {
        appels.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify({ rows: [] }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    effacerSession();
  });

  it('upsert : POST /sync/:table, rows + Bearer token', async () => {
    const c = await creerClient();
    await c.upsert('checks', [{ semaine: 's', check_id: 'c1', done: true, household_id: 'x' }]);
    expect(appels[0]?.url).toBe('https://rituel.example.fr/sync/checks');
    expect(appels[0]?.init.method).toBe('POST');
    expect(appels[0]?.init.headers).toMatchObject({ Authorization: 'Bearer jwt.tok' });
    expect(JSON.parse(String(appels[0]?.init.body))).toEqual({
      rows: [{ semaine: 's', check_id: 'c1', done: true, household_id: 'x' }],
    });
  });

  it('toutLire : GET /sync/:table → rows', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
      appels.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ rows: [{ semaine: 's', payload: {} }] }));
    }));
    const c = await creerClient();
    await expect(c.toutLire('weeks')).resolves.toEqual([{ semaine: 's', payload: {} }]);
    expect(appels[0]?.url).toBe('https://rituel.example.fr/sync/weeks');
    expect(appels[0]?.init.method).toBeUndefined(); // GET
  });

  it('supprimer : DELETE /sync/:table avec { clefs }', async () => {
    const c = await creerClient();
    await c.supprimer('weights', [{ profil: 'marc', date_: '2026-09-25' }]);
    expect(appels[0]?.init.method).toBe('DELETE');
    expect(JSON.parse(String(appels[0]?.init.body))).toEqual({
      clefs: [{ profil: 'marc', date_: '2026-09-25' }],
    });
  });

  it('purger : DELETE /sync', async () => {
    const c = await creerClient();
    await c.purger();
    expect(appels[0]?.url).toBe('https://rituel.example.fr/sync');
    expect(appels[0]?.init.method).toBe('DELETE');
  });

  it('erreur HTTP → exception sync-<status> (état erreur côté engine)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('non', { status: 401 })));
    const c = await creerClient();
    await expect(c.toutLire('weeks')).rejects.toThrow('sync-401');
  });

  it('abonner : lecteur SSE avec url du VPS et token', async () => {
    const c = await creerClient();
    const desabonner = c.abonner(() => {}, () => {});
    expect(abonnerSse).toHaveBeenCalledWith(
      'https://rituel.example.fr/evenements',
      'jwt.tok',
      expect.any(Function),
      expect.any(Function),
    );
    desabonner();
  });
});
