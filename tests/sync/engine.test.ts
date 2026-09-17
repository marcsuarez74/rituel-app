import { afterEach, beforeEach, vi } from 'vitest';
import type { RowSync, SyncClient } from '../../src/lib/sync/client';
import type { MutationSync, TableSync } from '../../src/lib/sync/outbox';

vi.mock('../../src/lib/sync/config', () => ({
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  syncActif: vi.fn(() => true),
}));

// Mocks partiels : seul creerClient / demanderSession est substituable —
// le reste des modules reste réel (session localStorage, types du client).
const { creerClientMock, demanderSessionMock } = vi.hoisted(() => ({
  creerClientMock: vi.fn(),
  demanderSessionMock: vi.fn(),
}));

vi.mock('../../src/lib/sync/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/sync/client')>()),
  creerClient: (...args: Parameters<typeof import('../../src/lib/sync/client').creerClient>) =>
    creerClientMock(...args),
}));

vi.mock('../../src/lib/sync/session', async (importOriginal) => {
  const reel = await importOriginal<typeof import('../../src/lib/sync/session')>();
  demanderSessionMock.mockImplementation(reel.demanderSession); // passthrough réel par défaut
  return {
    ...reel,
    demanderSession: (...args: Parameters<typeof reel.demanderSession>) =>
      demanderSessionMock(...args),
  };
});

import { syncActif } from '../../src/lib/sync/config';
import {
  appliquerRemote,
  connecterFoyer,
  deconnecterFoyer,
  etatSync,
  flush,
  flushDiffere,
  initSync,
  injecterClient,
  lireSessionPub,
  pull,
  purgerFoyer,
  reinitialiser,
  ressynchroniser,
} from '../../src/lib/sync/engine';
import { definirSession, effacerSession, lireSession } from '../../src/lib/sync/session';
import { empiler, lireOutbox, viderOutbox } from '../../src/lib/sync/outbox';
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
  upsertWeek,
} from '../../src/lib/storage';
import type { ImportedWeek, UserProfile } from '../../src/lib/model';

// Faux client : enregistre les appels, pas de réseau.
interface FauxClient extends SyncClient {
  upserts: Array<{ table: TableSync; rows: RowSync[] }>;
  suppressions: Array<{ table: TableSync; clefs: Record<string, string>[] }>;
  echecApres: number;
  echouerLectures: boolean; // pull : échec des lectures (toutLire) — flush a déjà echecApres
  lues: Record<string, RowSync[]>;
  lectures: TableSync[]; // trace des toutLire (ordre des tables lues)
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
      c.lectures.push(table);
      if (c.echouerLectures) throw new Error('reseau');
      return c.lues[table] ?? [];
    },
    async purger() {
      c.purgees = true;
    },
    abonner: () => () => {},
    lues: {},
    lectures: [],
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

// Semaine complète (ImportedWeek) pour tester le format wire jsonb.
const semaineFictive = (): ImportedWeek => {
  const raw = '---\nsemaine: 2026-S39\nmenu: A\ndu: 2026-09-21\nau: 2026-09-27\n---\n';
  const { data } = parseWeeklyFile(raw);
  return { raw, data, importedAt: '2026-09-16T08:00:00.000Z' };
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

  it('flush weeks : payload enveloppé (colonne jsonb serveur), jamais de champs plats', async () => {
    empiler({
      op: 'upsert',
      table: 'weeks',
      key: { semaine: '2026-S39' },
      payload: { ...semaineFictive() },
    });
    await flush();
    expect(client.upserts).toHaveLength(1);
    const ligne = client.upserts[0].rows[0];
    expect(ligne).toMatchObject({
      semaine: '2026-S39',
      payload: semaineFictive(),
      household_id: '11111111-2222-3333-4444-555555555555',
    });
    expect('raw' in ligne).toBe(false);
    expect('data' in ligne).toBe(false);
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
    vi.unstubAllGlobals();
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
    // fusion union : le merge (lectures de toutes les tables) a bien eu lieu
    expect(client.lectures).toContain('weeks');
  });

  it('foyer alimenté → fusion : l\'état local part, le remote s\'applique', async () => {
    addWeight('marc', '2026-09-21', 82.4);
    client.lues.checks = [
      { household_id: 'f', semaine: '2026-S39', check_id: 'b1', done: true },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ token: 'tok', foyer: 'foyer-1' }), { status: 200 })),
    );
    await connecterFoyer('code');
    expect(client.upserts).not.toEqual([]); // le local est parti
    expect(getChecks('2026-S39')['b1']).toBe(true); // le remote s'est appliqué
    expect(getWeights('marc')).toEqual([{ date: '2026-09-21', kg: 82.4 }]); // local intact
  });

  it('conflit à la connexion : le local gagne (outbox-prime) et repart vers le serveur', async () => {
    const s = semaineFictive();
    upsertWeek(s.raw, s.data); // la coche appartient à une semaine chargée
    setCheck('2026-S39', 'b1', false); // local : b1 décoché
    client.lues.checks = [
      { household_id: 'f', semaine: '2026-S39', check_id: 'b1', done: true },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ token: 'tok', foyer: 'foyer-1' }), { status: 200 })),
    );
    await connecterFoyer('code');
    expect(getChecks('2026-S39')['b1']).toBe(false); // outbox-prime : remote skippé
    const checks = client.upserts.find((u) => u.table === 'checks');
    expect(checks?.rows[0]).toMatchObject({
      semaine: '2026-S39',
      check_id: 'b1',
      done: false,
      household_id: 'foyer-1',
    });
  });

  it('code refusé → erreur, pas de session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"error":"code-refuse"}', { status: 401 })),
    );
    await expect(connecterFoyer('mauvais')).rejects.toThrow('code-refuse');
    expect(lireSession()).toBeNull();
  });

  it('deconnecterFoyer nettoie session + outbox', async () => {
    definirSession('t', 'f');
    setCheck('2026-S39', 'b1', true);
    deconnecterFoyer();
    expect(lireSession()).toBeNull();
    expect(lireOutbox()).toEqual([]);
    expect(etatSync()).toBe('hors-foyer');
  });

  it('lireSessionPub expose la session (usage UI)', () => {
    definirSession('t', 'f');
    expect(lireSessionPub()).toEqual({ token: 't', foyerId: 'f' });
  });
});

describe('sync: purge + init', () => {
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

  it('purgerFoyer purge le serveur AVANT le nettoyage local', async () => {
    definirSession('t', 'f');
    setCheck('2026-S39', 'b1', true);
    await purgerFoyer();
    expect(client.purgees).toBe(true);
    expect(lireSession()).toBeNull();
    expect(lireOutbox()).toEqual([]);
    expect(etatSync()).toBe('hors-foyer');
  });

  it('purge en échec → session et outbox locales conservées', async () => {
    definirSession('t', 'f');
    setCheck('2026-S39', 'b1', true);
    injecterClient({
      ...client,
      purger: async () => {
        throw new Error('reseau');
      },
    });
    client.echouer(0); // la flush fence échoue aussi (réseau) : l'outbox reste en place
    await expect(purgerFoyer()).rejects.toThrow('reseau');
    expect(lireSession()).toEqual({ token: 't', foyerId: 'f' });
    expect(lireOutbox()).toHaveLength(1);
    expect(etatSync()).not.toBe('off');
  });

  it('initSync sync inactive → etat off, aucun réseau', () => {
    vi.mocked(syncActif).mockReturnValueOnce(false);
    initSync({});
    expect(etatSync()).toBe('off');
    expect(client.lectures).toEqual([]); // aucun toutLire
  });

  it('initSync avec session → flush + pull, onEtat appelé', async () => {
    definirSession('t', 'f');
    const onEtat = vi.fn();
    initSync({ onEtat });
    await vi.waitFor(() => expect(etatSync()).toBe('sync'));
    expect(onEtat).toHaveBeenCalledWith('sync');
  });

  it('ressynchroniser → flush + pull immédiats', async () => {
    definirSession('t', 'f');
    setCheck('2026-S39', 'b1', true);
    ressynchroniser();
    await vi.waitFor(() => expect(client.upserts.length).toBe(1));
    expect(etatSync()).toBe('sync');
  });

  it('purgerFoyer fence : la flush part avant la purge serveur', async () => {
    definirSession('t', 'f');
    setCheck('2026-S39', 'b1', true);
    await purgerFoyer(); // pas de flush manuelle avant : la fence s'en charge
    expect(client.upserts.length).toBe(1); // le upsert est bien parti d'abord
    expect(client.purgees).toBe(true);
    expect(lireSession()).toBeNull();
    expect(lireOutbox()).toEqual([]);
  });

  it('pull interrompu par une déconnexion → n\'écrit rien, pas d\'état fantôme', async () => {
    definirSession('t', 'f');
    setCheck('2026-S39', 'b1', false);
    let resoudreLecture: (rows?: RowSync[]) => void = () => {};
    injecterClient({
      ...client,
      toutLire: () =>
        new Promise((r) => {
          resoudreLecture = () =>
            r([{ household_id: 'f', semaine: '2026-S39', check_id: 'b1', done: true }]);
        }),
    });
    const p = pull();
    deconnecterFoyer();
    resoudreLecture();
    await p;
    expect(getChecks('2026-S39')['b1']).toBe(false); // le remote n'a PAS été appliqué
    expect(etatSync()).toBe('hors-foyer');
  });
});

describe('sync: états de présence', () => {
  beforeEach(() => {
    localStorage.clear();
    viderOutbox();
    effacerSession();
    reinitialiser();
    injecterClient(fauxClient());
  });
  afterEach(() => {
    reinitialiser();
  });

  it('sync active, sans session : hors-foyer (pas de point bannière)', () => {
    initSync({ onEtat: () => {}, onRemote: () => {} });
    expect(etatSync()).toBe('hors-foyer');
  });

  it('appairage réussi mais connexion en échec : erreur (session posée)', async () => {
    // Chemin réel : sans client injecté, connecter() passe par creerClient()
    // (Supabase indisponible au moment de l'appairage) — injecterClient ne
    // couvre pas ce chemin.
    injecterClient(null);
    creerClientMock.mockRejectedValueOnce(new Error('reseau'));
    demanderSessionMock.mockResolvedValueOnce({ token: 't', foyerId: 'f' });
    await expect(connecterFoyer('CODE-1')).rejects.toThrow('reseau');
    expect(etatSync()).toBe('erreur');
    expect(lireSessionPub()).not.toBeNull();
  });

  it('déconnexion volontaire : hors-foyer (reconnexion possible au profil)', () => {
    // Session posée APRÈS initSync : sans session au démarrage, aucune
    // connexion ne s'amorce — l'assertion porte sur l'état final uniquement.
    initSync({ onEtat: () => {}, onRemote: () => {} });
    definirSession('token-test', 'foyer-1');
    deconnecterFoyer();
    expect(etatSync()).toBe('hors-foyer');
    expect(lireSessionPub()).toBeNull();
  });
});

describe('sync: reconnexion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T10:00:00'));
    localStorage.clear();
    viderOutbox();
    effacerSession();
    reinitialiser();
    creerClientMock.mockReset();
  });
  afterEach(() => {
    reinitialiser();
    vi.useRealTimers();
  });

  it('ressynchronise recrée le client après un échec au démarrage', async () => {
    // Démarrage sans réseau : creerClient rejette → erreur, client null.
    creerClientMock.mockRejectedValueOnce(new Error('reseau'));
    definirSession('token-test', 'foyer-1');
    initSync({ onEtat: () => {}, onRemote: () => {} });
    await vi.waitFor(() => expect(etatSync()).toBe('erreur'));
    // Le réseau revient : le tap sur le point recrée le client et repasse sync.
    const client = fauxClient();
    creerClientMock.mockResolvedValueOnce(client);
    ressynchroniser();
    await vi.waitFor(() => expect(etatSync()).toBe('sync'));
    expect(client.lectures.length).toBeGreaterThan(0); // post-connexion a pullé
  });

  it('fermeture du canal : erreur puis réabonnement automatique (~5 s)', async () => {
    const statuts: Array<((ouvert: boolean) => void) | null> = [];
    const client = fauxClient();
    client.abonner = vi.fn((_ev: () => void, st?: (ouvert: boolean) => void) => {
      statuts.push(st ?? null);
      return () => {};
    }) as unknown as SyncClient['abonner'];
    injecterClient(client);
    definirSession('token-test', 'foyer-1');
    initSync({ onEtat: () => {}, onRemote: () => {} });
    await vi.waitFor(() => expect(etatSync()).toBe('sync'));
    expect(statuts.length).toBe(1);

    statuts[0]?.(false); // TIMED_OUT / CLOSED / CHANNEL_ERROR
    expect(etatSync()).toBe('erreur');

    await vi.runAllTimersAsync(); // reconnexion planifiée (5 s)
    expect(client.abonner).toHaveBeenCalledTimes(2);
    statuts[1]?.(true); // le nouveau canal s'ouvre
    expect(etatSync()).toBe('sync');
  });

  it('le canal supplanté (CLOSED après réabonnement) ne déclenche ni erreur ni reconnexion', async () => {
    const statuts: Array<((ouvert: boolean) => void) | null> = [];
    const client = fauxClient();
    client.abonner = vi.fn((_ev: () => void, st?: (ouvert: boolean) => void) => {
      statuts.push(st ?? null);
      return () => {};
    }) as unknown as SyncClient['abonner'];
    injecterClient(client);
    definirSession('token-test', 'foyer-1');
    initSync({ onEtat: () => {}, onRemote: () => {} });
    await vi.waitFor(() => expect(etatSync()).toBe('sync'));

    statuts[0]?.(false); // coupure réelle → erreur + reconnexion planifiée
    expect(etatSync()).toBe('erreur');
    await vi.runAllTimersAsync(); // réabonnement → statuts.length === 2
    expect(client.abonner).toHaveBeenCalledTimes(2);
    statuts[1]?.(true); // le nouveau canal s'ouvre (SUBSCRIBED) — le vieux part au removeChannel
    expect(etatSync()).toBe('sync');

    statuts[0]?.(false); // le VIEUX canal annonce CLOSED (supprimé par removeChannel)
    expect(etatSync()).toBe('sync'); // ni erreur…
    await vi.runAllTimersAsync();
    expect(client.abonner).toHaveBeenCalledTimes(2); // …ni nouvelle reconnexion
  });

  it('le CLOSED retardé du canal retiré ne sort pas de hors-foyer après déconnexion', async () => {
    const statuts: Array<((ouvert: boolean) => void) | null> = [];
    const client = fauxClient();
    client.abonner = vi.fn((_ev: () => void, st?: (ouvert: boolean) => void) => {
      statuts.push(st ?? null);
      return () => {};
    }) as unknown as SyncClient['abonner'];
    injecterClient(client);
    definirSession('token-test', 'foyer-1');
    initSync({ onEtat: () => {}, onRemote: () => {} });
    await vi.waitFor(() => expect(etatSync()).toBe('sync'));

    deconnecterFoyer();
    expect(etatSync()).toBe('hors-foyer');
    statuts[0]?.(false); // le CLOSED de removeChannel arrive après la fin synchrone
    expect(etatSync()).toBe('hors-foyer'); // jamais 'erreur'
  });

  it('réouverture du canal : flush de rattrapage de la outbox restée pleine', async () => {
    // Coupure du canal SEUL (pas d'event online) pendant une mutation.
    const statuts: Array<((ouvert: boolean) => void) | null> = [];
    const client = fauxClient();
    client.abonner = vi.fn((_ev: () => void, st?: (ouvert: boolean) => void) => {
      statuts.push(st ?? null);
      return () => {};
    }) as unknown as SyncClient['abonner'];
    injecterClient(client);
    definirSession('token-test', 'foyer-1');
    initSync({ onEtat: () => {}, onRemote: () => {} });
    await vi.waitFor(() => expect(etatSync()).toBe('sync'));

    // Canal coupé, puis une mutation s'empile (flush bloquée : canal fermé).
    statuts[0]?.(false);
    expect(etatSync()).toBe('erreur');
    setCheck('2026-S39', 'courses:legumes-carottes', true);
    expect(lireOutbox().length).toBeGreaterThan(0);

    // Retour du canal : le statut ne doit être vert qu'après la flush.
    client.echouer('aucun'); // l'upsert de la flush de rattrapage réussit
    statuts[0]?.(true);
    await vi.waitFor(() => expect(etatSync()).toBe('sync'));
    expect(lireOutbox().length).toBe(0); // outbox vidée par le flush de rattrapage
  });

  it('réouverture du canal : pull de rattrapage des push manqués', async () => {
    const statuts: Array<((ouvert: boolean) => void) | null> = [];
    const client = fauxClient();
    client.abonner = vi.fn((_ev: () => void, st?: (ouvert: boolean) => void) => {
      statuts.push(st ?? null);
      return () => {};
    }) as unknown as SyncClient['abonner'];
    injecterClient(client);
    definirSession('token-test', 'foyer-1');
    initSync({ onEtat: () => {}, onRemote: () => {} });
    await vi.waitFor(() => expect(etatSync()).toBe('sync'));
    const lecturesAvant = client.lectures.length;

    statuts[0]?.(true); // le canal se rouvre : rattraper ce qui a manqué
    await vi.runAllTimersAsync(); // debounce pull 500 ms
    expect(client.lectures.length).toBeGreaterThan(lecturesAvant);
  });

  it('retour du réseau sans client : connexion relancée', async () => {
    creerClientMock.mockRejectedValueOnce(new Error('reseau'));
    definirSession('token-test', 'foyer-1');
    initSync({ onEtat: () => {}, onRemote: () => {} });
    await vi.waitFor(() => expect(etatSync()).toBe('erreur'));

    const client = fauxClient();
    creerClientMock.mockResolvedValueOnce(client);
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(etatSync()).toBe('sync'));
  });

  it('reinitialiser annule la reconnexion planifiée (aucun timer fantôme)', async () => {
    const statuts: Array<((ouvert: boolean) => void) | null> = [];
    const client = fauxClient();
    client.abonner = vi.fn((_ev: () => void, st?: (ouvert: boolean) => void) => {
      statuts.push(st ?? null);
      return () => {};
    }) as unknown as SyncClient['abonner'];
    injecterClient(client);
    definirSession('token-test', 'foyer-1');
    initSync({ onEtat: () => {}, onRemote: () => {} });
    await vi.waitFor(() => expect(etatSync()).toBe('sync'));

    statuts[0]?.(false);
    reinitialiser(); // annule tout
    injecterClient(client); // l'état module est remis à zéro
    definirSession('token-test', 'foyer-1');
    await vi.runAllTimersAsync(); // ne doit ni crasher ni réabonner
    expect(client.abonner).toHaveBeenCalledTimes(1);
  });
});
