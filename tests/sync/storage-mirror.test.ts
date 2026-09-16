import { vi } from 'vitest';
import type { ImportedWeek, UserProfile } from '../../src/lib/model';
import { parseWeeklyFile } from '../../src/lib/parse';

// Force l'activation : en vitest, VITE_SUPABASE_* est undefined.
vi.mock('../../src/lib/sync/config', () => ({
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
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
  upsertWeek,
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

  it('upsertWeek empile une upsert weeks (payload = ImportedWeek)', () => {
    connecte();
    const raw = '---\nsemaine: 2026-S39\nmenu: A\ndu: 2026-09-21\nau: 2026-09-27\n---\n';
    const { data } = parseWeeklyFile(raw);
    // Horloge gelée : le importedAt attendu et celui du payload sont identiques.
    vi.setSystemTime(new Date('2026-09-21T10:00:00'));
    const imp: ImportedWeek = { raw, data, importedAt: new Date().toISOString() };
    upsertWeek(raw, data);
    vi.useRealTimers();
    const outbox = lireOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0].table).toBe('weeks');
    expect(outbox[0].key).toEqual({ semaine: '2026-S39' });
    expect(outbox[0].payload).toEqual(imp);
  });

  it('sans connexion : aucune outbox (comportement actuel préservé)', () => {
    setCheck('2026-S39', 'b1', true);
    addWeight('marc', '2026-09-21', 82.4);
    expect(lireOutbox()).toEqual([]);
  });
});
