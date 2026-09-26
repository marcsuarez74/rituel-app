import { vi } from 'vitest';
import {
  empiler,
  empilerMutation,
  lireOutbox,
  retirer,
  surEmpile,
  viderOutbox,
  type MutationSync,
} from '../../src/lib/sync/outbox';

// Force l'activation : en vitest, VITE_SYNC_URL est undefined.
vi.mock('../../src/lib/sync/config', () => ({
  SYNC_URL: 'https://rituel.example.fr',
  syncActif: () => true,
}));

import { definirSession, effacerSession } from '../../src/lib/sync/session';

const up = (overrides: Partial<MutationSync> = {}): MutationSync => ({
  op: 'upsert',
  table: 'checks',
  key: { semaine: '2026-S39', check_id: 'b1' },
  payload: { done: true },
  ...overrides,
});

describe('sync: outbox', () => {
  beforeEach(() => {
    localStorage.clear();
    effacerSession();
  });

  afterEach(() => surEmpile(null)); // débranche pour les autres tests

  it('lireOutbox vide sans connexion', () => {
    expect(lireOutbox()).toEqual([]);
  });

  it('empiler + lireOutbox restitue la mutation', () => {
    definirSession('t', 'f');
    empiler(up());
    expect(lireOutbox()).toEqual([up()]);
  });

  it('empiler dédoublonne par (op, table, key) — le dernier gagne', () => {
    definirSession('t', 'f');
    empiler(up());
    empiler(up({ payload: { done: false } }));
    expect(lireOutbox()).toEqual([up({ payload: { done: false } })]);
  });

  it('retirer ne retire que la mutation identique (key + payload)', () => {
    definirSession('t', 'f');
    empiler(up());
    empiler(up({ key: { semaine: '2026-S39', check_id: 'b2' }, payload: { done: true } }));
    retirer(up({ key: { semaine: '2026-S39', check_id: 'b2' }, payload: { done: true } }));
    expect(lireOutbox()).toEqual([up()]);
    // même clé mais payload différent : conservé
    retirer(up({ payload: { done: false } }));
    expect(lireOutbox()).toEqual([up()]);
  });

  it('viderOutbox supprime la clé', () => {
    definirSession('t', 'f');
    empiler(up());
    viderOutbox();
    expect(lireOutbox()).toEqual([]);
  });

  it('empilerMutation est un no-op sans session', () => {
    empilerMutation(up());
    expect(lireOutbox()).toEqual([]);
  });

  it('empilerMutation empile et déclenche le callback avec session', () => {
    definirSession('t', 'f');
    const cb = vi.fn();
    surEmpile(cb);
    empilerMutation(up());
    expect(lireOutbox()).toEqual([up()]);
    expect(cb).toHaveBeenCalledOnce();
  });

  it('outbox corrompue → vidée silencieusement', () => {
    localStorage.setItem('sportapp:sync:outbox', '{pas-du-json');
    expect(lireOutbox()).toEqual([]);
  });

  it('lireOutbox filtre les éléments illégaux et conserve les valides', () => {
    localStorage.setItem(
      'sportapp:sync:outbox',
      JSON.stringify([{ foo: 1 }, up()]),
    );
    expect(lireOutbox()).toEqual([up()]);
  });

  it('lireOutbox : JSON valide non-tableau → vide et clé retirée', () => {
    localStorage.setItem('sportapp:sync:outbox', '{}');
    expect(lireOutbox()).toEqual([]);
    expect(localStorage.getItem('sportapp:sync:outbox')).toBeNull();
  });
});
