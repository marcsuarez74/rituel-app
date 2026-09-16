import { afterEach, beforeEach, vi } from 'vitest';
import type { RowSync, SyncClient } from '../../src/lib/sync/client';
import type { MutationSync, TableSync } from '../../src/lib/sync/outbox';

vi.mock('../../src/lib/sync/config', () => ({
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  syncActif: () => true,
}));

import {
  etatSync,
  flush,
  injecterClient,
  reinitialiser,
} from '../../src/lib/sync/engine';
import { definirSession, effacerSession } from '../../src/lib/sync/session';
import { lireOutbox, viderOutbox } from '../../src/lib/sync/outbox';
import { setCheck } from '../../src/lib/storage';

// Faux client : enregistre les appels, pas de réseau.
interface FauxClient extends SyncClient {
  upserts: Array<{ table: TableSync; rows: RowSync[] }>;
  suppressions: Array<{ table: TableSync; clefs: Record<string, string>[] }>;
  echecApres: number;
  lues: Record<string, RowSync[]>;
  purgees: boolean;
  echouer: (apres: 'aucun' | number) => void;
}

const fauxClient = (): FauxClient => {
  const c: FauxClient = {
    upserts: [],
    suppressions: [],
    echecApres: Infinity,
    async upsert(table: TableSync, rows: RowSync[]) {
      if (c.echecApres <= c.upserts.length) throw new Error('reseau');
      c.upserts.push({ table, rows });
    },
    async supprimer(table: TableSync, clefs: Record<string, string>[]) {
      c.suppressions.push({ table, clefs });
    },
    async toutLire(table: TableSync) {
      return c.lues[table] ?? [];
    },
    async purger() {
      c.purgees = true;
    },
    abonner: () => () => {},
    lues: {},
    purgees: false,
    echouer: (apres) => {
      c.echecApres = apres === 'aucun' ? Infinity : apres;
    },
  };
  return c;
};

describe('sync: flush', () => {
  let client: FauxClient;

  beforeEach(() => {
    vi.setSystemTime(new Date('2026-09-16T10:00:00'));
    localStorage.clear();
    viderOutbox();
    effacerSession();
    reinitialiser();
    client = fauxClient();
    injecterClient(client);
    definirSession('t', '11111111-2222-3333-4444-555555555555');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flush vide : aucun appel, etat sync', async () => {
    await flush();
    expect(client.upserts).toEqual([]);
    expect(etatSync()).toBe('sync');
  });

  it('flush groupe les upserts par table puis retire les entrées', async () => {
    setCheck('2026-S39', 'b1', true);
    setCheck('2026-S39', 'b2', false);
    await flush();
    expect(client.upserts).toEqual([
      {
        table: 'checks',
        rows: [
          {
            household_id: '11111111-2222-3333-4444-555555555555',
            semaine: '2026-S39',
            check_id: 'b1',
            done: true,
            updated_at: expect.any(String),
          },
          {
            household_id: '11111111-2222-3333-4444-555555555555',
            semaine: '2026-S39',
            check_id: 'b2',
            done: false,
            updated_at: expect.any(String),
          },
        ],
      },
    ]);
    expect(lireOutbox()).toEqual([]);
    expect(etatSync()).toBe('sync');
  });

  it('flush envoie les deletes (op delete → client.supprimer)', async () => {
    definirSession('t', '11111111-2222-3333-4444-555555555555');
    localStorage.setItem(
      'sportapp:sync:outbox',
      JSON.stringify([
        {
          op: 'delete',
          table: 'depenses',
          key: { date_: '2026-09-21', magasin_key: 'lidl' },
        } satisfies MutationSync,
      ]),
    );
    await flush();
    expect(client.suppressions).toEqual([
      { table: 'depenses', clefs: [{ date_: '2026-09-21', magasin_key: 'lidl' }] },
    ]);
    expect(lireOutbox()).toEqual([]);
  });

  it('flush en échec : etat erreur, outbox conservée', async () => {
    setCheck('2026-S39', 'b1', true);
    client.echouer(0);
    await flush();
    expect(etatSync()).toBe('erreur');
    expect(lireOutbox()).toHaveLength(1);
  });
});
