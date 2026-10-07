import { vi } from 'vitest';
import type { UserProfile } from '../../src/lib/model';
import { foyerParDefaut, saveFoyer } from '../../src/lib/cycle/etat';

// Force l'activation : en vitest, VITE_SYNC_URL est undefined.
vi.mock('../../src/lib/sync/config', () => ({
  SYNC_URL: 'https://rituel.example.fr',
  syncActif: () => true,
}));

import { definirSession, effacerSession } from '../../src/lib/sync/session';
import { lireOutbox, viderOutbox } from '../../src/lib/sync/outbox';
import {
  addWeight,
  deleteDepense,
  saveDepense,
  saveProfile,
  setCheck,
} from '../../src/lib/storage';

describe('sync: storage → outbox', () => {
  beforeEach(() => {
    localStorage.clear();
    viderOutbox();
    effacerSession();
  });

  const connecte = () => definirSession('t', '11111111-2222-3333-4444-555555555555');

  it('setCheck empile une upsert checks', () => {
    connecte();
    setCheck('2026-S39', 'b1', true);
    expect(lireOutbox()).toEqual([
      {
        op: 'upsert',
        table: 'checks',
        key: { semaine: '2026-S39', check_id: 'b1' },
        payload: { done: true },
      },
    ]);
  });

  it('addWeight empile une upsert weights', () => {
    connecte();
    addWeight('marc', '2026-09-21', 82.4);
    expect(lireOutbox()).toEqual([
      {
        op: 'upsert',
        table: 'weights',
        key: { profil: 'marc', date_: '2026-09-21' },
        payload: { kg: 82.4 },
      },
    ]);
  });

  it('saveDepense empile avec magasin_key minuscule ; deleteDepense empile un delete', () => {
    connecte();
    saveDepense('2026-09-21', 'Lidl', 43.2);
    deleteDepense('2026-09-21', 'Lidl');
    expect(lireOutbox()).toEqual([
      {
        op: 'upsert',
        table: 'depenses',
        key: { date_: '2026-09-21', magasin_key: 'lidl' },
        payload: { magasin: 'Lidl', total: 43.2 },
      },
      {
        op: 'delete',
        table: 'depenses',
        key: { date_: '2026-09-21', magasin_key: 'lidl' },
      },
    ]);
  });

  it('saveProfile empile une upsert profiles (payload = profil nettoyé)', () => {
    connecte();
    const p = {
      id: 'marc',
      dateNaissance: '1990-01-01',
      taille: 180,
      objectif: { type: 'maintien' },
      complements: [],
      regime: 'aucun',
    } as unknown as UserProfile;
    saveProfile(p);
    const outbox = lireOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0].table).toBe('profiles');
    expect(outbox[0].key).toEqual({ profil: 'marc' });
    expect(outbox[0].payload).toMatchObject({ id: 'marc' });
  });

  it('saveFoyer empile une upsert etat (clé foyer, payload { valeur })', () => {
    connecte();
    saveFoyer(foyerParDefaut(null));
    expect(lireOutbox()).toEqual([
      { op: 'upsert', table: 'etat', key: { cle: 'foyer' }, payload: { valeur: foyerParDefaut(null) } },
    ]);
  });

  it('sans connexion : aucune outbox (comportement actuel préservé)', () => {
    setCheck('2026-S39', 'b1', true);
    addWeight('marc', '2026-09-21', 82.4);
    expect(lireOutbox()).toEqual([]);
  });
});
