import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RowSync, SyncClient } from '../../src/lib/sync/client';

vi.mock('../../src/lib/sync/config', () => ({
  SYNC_URL: 'https://rituel.example.fr',
  syncActif: vi.fn(() => true),
}));

import { syncActif } from '../../src/lib/sync/config';
import {
  flush,
  injecterClient,
  reinitialiser,
  supprimerProfil,
  etatSync,
} from '../../src/lib/sync/engine';
import { empiler, lireOutbox } from '../../src/lib/sync/outbox';
import { definirCode, definirSession, lireSession } from '../../src/lib/sync/session';

const fetchMock = vi.fn();

const clesApp = (): string[] => Object.keys(localStorage).filter((k) => k.startsWith('sportapp:'));

const peuplerApp = (): void => {
  localStorage.setItem('sportapp:profile', '{"id":"marc"}');
  localStorage.setItem('sportapp:weights:marc', '[]');
  localStorage.setItem('sportapp:cycle', '{}');
  localStorage.setItem('sportapp:v2', '1');
  localStorage.setItem('sportapp:profils:foyer', '[]');
  localStorage.setItem('autre-lib:reglage', 'garde'); // pas à nous : ne se touche pas
};

beforeEach(() => {
  localStorage.clear();
  vi.mocked(syncActif).mockReturnValue(true);
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  reinitialiser();
  vi.unstubAllGlobals();
});

describe('supprimerProfil', () => {
  it('sans foyer : efface toutes les clés sportapp:*, aucun appel réseau', async () => {
    peuplerApp();
    await supprimerProfil();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(clesApp()).toEqual([]);
    expect(localStorage.getItem('autre-lib:reglage')).toBe('garde');
  });

  it('sans VITE_SYNC_URL : suppression locale seule, même avec une session résiduelle', async () => {
    vi.mocked(syncActif).mockReturnValue(false);
    peuplerApp();
    definirSession('jeton', 'foyer-1');
    await supprimerProfil();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(clesApp()).toEqual([]);
    expect(etatSync()).toBe('off');
  });

  it('avec foyer : DELETE /foyers/moi avec le jeton, puis efface session, code et outbox', async () => {
    peuplerApp();
    definirSession('jeton-abc', 'foyer-1');
    definirCode('romarin-basilic-3f9a2c7e');
    empiler({ op: 'upsert', table: 'checks', key: { semaine: 's', check_id: 'c' }, payload: { done: true } });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, foyerSupprime: true }), { status: 200 }));

    await supprimerProfil();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://rituel.example.fr/foyers/moi');
    expect(init.method).toBe('DELETE');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jeton-abc');
    expect(clesApp()).toEqual([]);
    expect(lireSession()).toBeNull();
    expect(lireOutbox()).toEqual([]);
    expect(etatSync()).toBe('hors-foyer');
  });

  it('401 du serveur (foyer ou jeton déjà supprimé) : on efface quand même le local', async () => {
    peuplerApp();
    definirSession('jeton', 'foyer-1');
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));
    await supprimerProfil();
    expect(clesApp()).toEqual([]);
  });

  it.each([
    ['réseau coupé', () => fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))],
    ['erreur 500', () => fetchMock.mockResolvedValue(new Response('{}', { status: 500 }))],
  ])('%s : échoue en laissant TOUT intact (jamais à moitié effacé)', async (_nom, regler) => {
    peuplerApp();
    definirSession('jeton', 'foyer-1');
    empiler({ op: 'delete', table: 'weights', key: { profil: 'marc', date_: '2026-10-01' } });
    const avant = JSON.stringify(Object.entries(localStorage).sort());
    regler();

    await expect(supprimerProfil()).rejects.toThrow('serveur-injoignable');

    expect(JSON.stringify(Object.entries(localStorage).sort())).toBe(avant);
    expect(lireSession()).not.toBeNull();
  });

  it('localSeulement après un échec : pas d’appel réseau, tout est effacé', async () => {
    peuplerApp();
    definirSession('jeton', 'foyer-1');
    await supprimerProfil({ localSeulement: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(clesApp()).toEqual([]);
  });

  it('une flush en vol ne ressuscite rien : outbox vidée, aucun envoi après l’effacement', async () => {
    peuplerApp();
    definirSession('jeton', 'foyer-1');
    empiler({ op: 'upsert', table: 'checks', key: { semaine: 's', check_id: 'c1' }, payload: { done: true } });
    let liberer: () => void = () => undefined;
    const upsert = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          liberer = resolve;
        }),
    );
    const client: SyncClient = {
      upsert: upsert as unknown as SyncClient['upsert'],
      supprimer: vi.fn(async () => undefined),
      toutLire: vi.fn(async (): Promise<RowSync[]> => []),
      purger: vi.fn(async () => undefined),
      abonner: () => () => undefined,
    };
    injecterClient(client);
    const enVol = flush();
    expect(upsert).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));

    await supprimerProfil();
    liberer();
    await enVol;
    // Une mutation locale tardive (ex. un composant démonté qui écrit) n'est pas empilée.
    expect(lireOutbox()).toEqual([]);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(clesApp()).toEqual([]);
  });
});
