import { afterEach, beforeEach, vi } from 'vitest';
import type { RowSync, SyncClient } from '../../src/lib/sync/client';
import type { MutationSync, TableSync } from '../../src/lib/sync/outbox';

vi.mock('../../src/lib/sync/config', () => ({
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  syncActif: () => true,
}));

import {
  appliquerRemote,
  connecterFoyer,
  deconnecterFoyer,
  etatSync,
  flush,
  flushDiffere,
  injecterClient,
  lireSessionPub,
  pull,
  reinitialiser,
} from '../../src/lib/sync/engine';
import { definirSession, effacerSession, lireSession } from '../../src/lib/sync/session';
import { lireOutbox, viderOutbox } from '../../src/lib/sync/outbox';
import { parseWeeklyFile } from '../../src/lib/parse';
import {
  addWeight,
  getChecks,
  getDepenses,
  getWeights,
  loadProfile,
  loadWeeks,
  saveDepense,
  saveProfile,
  setCheck,
} from '../../src/lib/storage';
import type { ImportedWeek, UserProfile } from '../../src/lib/model';

// Faux client : enregistre les appels, pas de réseau.
interface FauxClient extends SyncClient {
  upserts: Array<{ table: TableSync; rows: RowSync[] }>;
  suppressions: Array<{ table: TableSync; clefs: Record<string, string>[] }>;
  echecApres: number;
  echouerLectures: boolean; // pull : échec des lectures (toutLire) — flush a déjà echecApres
  lues: Record<string, RowSync[]>;
  purgees: boolean;
  echouer: (apres: 'aucun' | number) => void;
}

const fauxClient = (): FauxClient => {
  const c: FauxClient = {
    upserts: [],
    suppressions: [],
    echecApres: Infinity,
    echouerLectures: false,
    async upsert(table: TableSync, rows: RowSync[]) {
      if (c.echecApres <= c.upserts.length) throw new Error('reseau');
      c.upserts.push({ table, rows });
    },
    async supprimer(table: TableSync, clefs: Record<string, string>[]) {
      c.suppressions.push({ table, clefs });
    },
    async toutLire(table: TableSync) {
      if (c.echouerLectures) throw new Error('reseau');
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

const profilMarc = (): UserProfile => ({
  id: 'marc',
  dateNaissance: '1990-01-01',
  taille: 180,
  objectif: { type: 'maintien' },
  complements: [],
  regime: 'aucun',
});

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

  it('même clé : le dernier op gagne (delete→upsert ⇒ upsert seul, upsert→delete ⇒ delete seul)', async () => {
    localStorage.setItem(
      'sportapp:sync:outbox',
      JSON.stringify([
        { op: 'delete', table: 'depenses', key: { date_: '2026-09-21', magasin_key: 'lidl' } },
        {
          op: 'upsert',
          table: 'depenses',
          key: { date_: '2026-09-21', magasin_key: 'lidl' },
          payload: { total: 12.5 },
        },
        {
          op: 'upsert',
          table: 'depenses',
          key: { date_: '2026-09-22', magasin_key: 'aldi' },
          payload: { total: 5 },
        },
        { op: 'delete', table: 'depenses', key: { date_: '2026-09-22', magasin_key: 'aldi' } },
      ] satisfies MutationSync[]),
    );
    await flush();
    expect(client.upserts).toEqual([
      {
        table: 'depenses',
        rows: [
          {
            date_: '2026-09-21',
            magasin_key: 'lidl',
            total: 12.5,
            household_id: '11111111-2222-3333-4444-555555555555',
            updated_at: expect.any(String),
          },
        ],
      },
    ]);
    expect(client.suppressions).toEqual([
      { table: 'depenses', clefs: [{ date_: '2026-09-22', magasin_key: 'aldi' }] },
    ]);
    expect(lireOutbox()).toEqual([]);
    expect(etatSync()).toBe('sync');
  });

  it('échec après tables réussies : toutes les entrées sont conservées, etat erreur', async () => {
    localStorage.setItem(
      'sportapp:sync:outbox',
      JSON.stringify([
        {
          op: 'upsert',
          table: 'checks',
          key: { semaine: '2026-S39', check_id: 'b1' },
          payload: { done: true },
        },
        { op: 'delete', table: 'depenses', key: { date_: '2026-09-21', magasin_key: 'lidl' } },
        {
          op: 'upsert',
          table: 'profiles',
          key: { profil: 'marc' },
          payload: { poidsObjectif: 75 },
        },
      ] satisfies MutationSync[]),
    );
    // Ordre TABLES : checks (upsert n°1, réussit) → depenses (delete, réussit) →
    // profiles (upsert n°2, échoue). Point clé : AUCUNE entrée n'est retirée,
    // même celles des tables déjà envoyées avec succès.
    client.echouer(1);
    await flush();
    expect(client.upserts).toHaveLength(1);
    expect(client.suppressions).toHaveLength(1);
    expect(etatSync()).toBe('erreur');
    expect(lireOutbox()).toHaveLength(3);
  });

  it('flushDiffere debounce : une seule flush après 2s, reset du timer', async () => {
    vi.useFakeTimers();
    setCheck('2026-S39', 'b1', true);
    setCheck('2026-S39', 'b2', true);
    flushDiffere();
    await vi.advanceTimersByTimeAsync(1500);
    flushDiffere(); // reset : le premier timer (1500 ms déjà écoulés) est annulé
    await vi.advanceTimersByTimeAsync(1999);
    expect(client.upserts).toEqual([]); // 1500 + 1999 > 2000 : sans reset, la flush serait déjà passée
    await vi.advanceTimersByTimeAsync(10);
    expect(client.upserts).toHaveLength(1);
    expect(client.upserts[0]?.rows).toHaveLength(2); // les deux coches, groupées
  });
});

describe('sync: pull / merge (outbox prime)', () => {
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

  it('applique une semaine remote absente localement', async () => {
    // frontmatter complet requis par parseWeeklyFile (menu, du, au)
    const raw = '---\nsemaine: 2026-S40\nmenu: B\ndu: 2026-09-28\nau: 2026-10-04\n---\n';
    const { data } = parseWeeklyFile(raw);
    const payload: ImportedWeek = { raw, data, importedAt: '2026-09-16T08:00:00.000Z' };
    client.lues.weeks = [{ household_id: 'f', semaine: '2026-S40', payload }];
    await pull();
    expect(Object.keys(loadWeeks())).toEqual(['2026-S40']);
    expect(etatSync()).toBe('sync');
  });

  it('une coche en attente dans l\'outbox prime sur le remote', async () => {
    setCheck('2026-S39', 'b1', true); // local + outbox
    client.lues.checks = [
      { household_id: 'f', semaine: '2026-S39', check_id: 'b1', done: false },
    ];
    await pull();
    expect(getChecks('2026-S39')['b1']).toBe(true); // outbox gagne
  });

  it('une coche remote s\'applique quand rien n\'est en attente', async () => {
    client.lues.checks = [
      { household_id: 'f', semaine: '2026-S39', check_id: 'b1', done: true },
    ];
    await pull();
    expect(getChecks('2026-S39')['b1']).toBe(true);
  });

  it('une pesée remote inconnue s\'ajoute ; identique → aucune écriture', async () => {
    client.lues.weights = [
      { household_id: 'f', profil: 'marc', date_: '2026-09-21', kg: 82.4 },
    ];
    await pull();
    expect(getWeights('marc')).toEqual([{ date: '2026-09-21', kg: 82.4 }]);
    // re-pull identique : stable (pas de doublon)
    await pull();
    expect(getWeights('marc')).toEqual([{ date: '2026-09-21', kg: 82.4 }]);
  });

  it('les dépenses sont reconstruites depuis le serveur (delete inclus)', async () => {
    saveDepense('2026-09-20', 'Lidl', 10);
    viderOutbox(); // état déjà flushé : rien en attente, la suppression distante s'applique
    client.lues.depenses = [
      { household_id: 'f', date_: '2026-09-21', magasin_key: 'carrefour', magasin: 'Carrefour', total: 55 },
    ];
    await pull();
    // Lidl supprimée sur un autre téléphone → disparaît localement
    expect(getDepenses()).toEqual([{ date: '2026-09-21', magasin: 'Carrefour', total: 55 }]);
  });

  it('un dépense en attente d\'outbox survit à la reconstruction', async () => {
    saveDepense('2026-09-22', 'Aldi', 20); // local + outbox
    client.lues.depenses = [
      { household_id: 'f', date_: '2026-09-21', magasin_key: 'carrefour', magasin: 'Carrefour', total: 55 },
    ];
    await pull();
    const cles = getDepenses().map((d) => `${d.date}|${d.magasin.toLowerCase()}`);
    expect(cles).toContain('2026-09-22|aldi');
    expect(cles).toContain('2026-09-21|carrefour');
  });

  it('le profil de l\'autre téléphone est ignoré localement', async () => {
    saveProfile(profilMarc());
    viderOutbox();
    const mel = { ...profilMarc(), id: 'melanie' as const };
    client.lues.profiles = [{ household_id: 'f', profil: 'melanie', payload: mel }];
    await pull();
    expect(loadProfile()?.id).toBe('marc');
  });

  it('le profil actif remote modifié s\'applique', async () => {
    saveProfile(profilMarc());
    viderOutbox();
    const maj = { ...profilMarc(), taille: 181 };
    client.lues.profiles = [{ household_id: 'f', profil: 'marc', payload: maj }];
    await pull();
    expect(loadProfile()?.taille).toBe(181);
  });

  it('appliquerRemote retourne false sans changement', async () => {
    const vide = { weeks: [], checks: [], weights: [], depenses: [], profiles: [] };
    expect(await appliquerRemote(vide)).toBe(false);
  });

  it('payload remote invalide → ignoré sans crash', async () => {
    client.lues.weeks = [{ household_id: 'f', semaine: '2026-S40', payload: { nonsense: true } }];
    client.lues.weights = [{ household_id: 'f', profil: 'marc', date_: '2026-09-21', kg: 'invalide' }];
    await pull();
    expect(loadWeeks()['2026-S40']).toBeUndefined();
    expect(etatSync()).toBe('sync');
  });

  it('payload profil invalide → ignoré, profil local intact', async () => {
    saveProfile(profilMarc());
    viderOutbox();
    client.lues.profiles = [
      { household_id: 'f', profil: 'marc', payload: { id: 'marc', taille: 'abc' } },
    ];
    await pull();
    expect(loadProfile()?.taille).toBe(180); // local intact, payload pourri non persisté
  });

  it('profil remote inconnu (pas marc/melanie) → ignoré', async () => {
    client.lues.weights = [
      { household_id: 'f', profil: 'x', date_: '2026-09-21', kg: 82.4 },
    ];
    await pull();
    expect(getWeights('marc')).toEqual([]);
    expect(getWeights('x' as 'marc')).toEqual([]); // aucune clé junk
  });

  it('pull en échec réseau → etat erreur', async () => {
    client.echouerLectures = true;
    await pull();
    expect(etatSync()).toBe('erreur');
  });
});

describe('sync: connexion foyer', () => {
  let client: FauxClient;

  beforeEach(() => {
    vi.setSystemTime(new Date('2026-09-16T10:00:00'));
    localStorage.clear();
    viderOutbox();
    effacerSession();
    reinitialiser();
    client = fauxClient();
    injecterClient(client);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('foyer vide → push complet de l\'état local', async () => {
    addWeight('marc', '2026-09-21', 82.4);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ token: 'tok', foyer: 'foyer-1' }), { status: 200 })),
    );
    await connecterFoyer(' rituel-2026 ');
    expect(lireSession()).toEqual({ token: 'tok', foyerId: 'foyer-1' });
    // push : la pesée locale est partie vers le serveur
    const weights = client.upserts.find((u) => u.table === 'weights');
    expect(weights?.rows[0]).toMatchObject({ profil: 'marc', date_: '2026-09-21', kg: 82.4 });
    expect(etatSync()).toBe('sync');
    vi.unstubAllGlobals();
  });

  it('foyer déjà alimenté → pull (pas de push)', async () => {
    client.lues.checks = [
      { household_id: 'f', semaine: '2026-S39', check_id: 'b1', done: true },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ token: 'tok', foyer: 'foyer-1' }), { status: 200 })),
    );
    await connecterFoyer('code');
    expect(client.upserts).toEqual([]);
    expect(getChecks('2026-S39')['b1']).toBe(true);
    vi.unstubAllGlobals();
  });

  it('code refusé → erreur, pas de session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"error":"code-refuse"}', { status: 401 })),
    );
    await expect(connecterFoyer('mauvais')).rejects.toThrow('code-refuse');
    expect(lireSession()).toBeNull();
    vi.unstubAllGlobals();
  });

  it('deconnecterFoyer nettoie session + outbox', async () => {
    definirSession('t', 'f');
    setCheck('2026-S39', 'b1', true);
    deconnecterFoyer();
    expect(lireSession()).toBeNull();
    expect(lireOutbox()).toEqual([]);
    expect(etatSync()).toBe('off');
  });

  it('lireSessionPub expose la session (usage UI)', () => {
    definirSession('t', 'f');
    expect(lireSessionPub()).toEqual({ token: 't', foyerId: 'f' });
  });
});
