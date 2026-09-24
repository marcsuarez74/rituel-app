import type { DepenseEntry, UserProfile, WeeklyData } from '../src/lib/model';
import { addWeight, deleteDepense, effacerSelection, getChecks, getDepenses, getWeights, lireSelection, loadProfile, loadProfilLegacy, loadWeek, loadWeeks, removeProfile, saveDepense, saveProfile, saveWeek, sauverSelection, setCheck, upsertWeek, type WeightEntry } from '../src/lib/storage';
import { todayKey } from '../src/lib/dates';

const week = (): WeeklyData => ({
  meta: { semaine: '2026-S39', menu: 'A', du: '2026-09-21', au: '2026-09-27' },
  courses: [{ id: 'c1', rayon: 'Fraîcheur', label: 'Poulet 600 g' }],
  menu: [{ jour: 'lundi', dejeunerMarc: 'Poulet riz' }],
  batch: [{ id: 'b1', label: 'Riz à l’avance' }],
  profiles: {
    marc: { cibles: [], seances: [], rappels: [] },
    melanie: { cibles: [], seances: [], rappels: [] },
  },
});

describe('storage: week', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadWeek returns null when nothing saved', () => {
    expect(loadWeek()).toBeNull();
  });

  it('saveWeek then loadWeek roundtrips the same data', () => {
    const raw = '---\nsemaine: 2026-S39\n---\n';
    const data = week();
    saveWeek(raw, data);
    const loaded = loadWeek();
    expect(loaded).toEqual({ raw, data, importedAt: expect.any(String) });
  });

  it('importedAt is an ISO string', () => {
    saveWeek('raw', week());
    const loaded = loadWeek();
    expect(loaded).not.toBeNull();
    expect(new Date(loaded!.importedAt).toISOString()).toBe(loaded!.importedAt);
  });
});

describe('storage: checks', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getChecks is empty when nothing checked', () => {
    expect(getChecks('2026-S39')).toEqual({});
  });

  it('setCheck/getChecks store state per semaine', () => {
    setCheck('2026-S39', 'b1', true);
    setCheck('2026-S39', 'b2', true);
    setCheck('2026-S40', 'b3', true);
    expect(getChecks('2026-S39')).toEqual({ b1: true, b2: true });
    expect(getChecks('2026-S40')).toEqual({ b3: true });
  });

  it('checks are isolated between weeks', () => {
    setCheck('2026-S39', 'b1', true);
    setCheck('2026-S39', 'b1', false);
    expect(getChecks('2026-S40')).toEqual({});
  });

  it('setCheck overwrites previous state for same id', () => {
    setCheck('2026-S39', 'b1', true);
    setCheck('2026-S39', 'b1', false);
    expect(getChecks('2026-S39')).toEqual({ b1: false });
  });
});

describe('storage: weights', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getWeights returns [] when empty', () => {
    expect(getWeights('marc')).toEqual<WeightEntry[]>([]);
  });

  it('addWeight appends sorted by date', () => {
    const r1 = addWeight('marc', '2026-09-24', 80.5);
    const r2 = addWeight('marc', '2026-09-21', 81.2);
    const r3 = addWeight('marc', '2026-09-23', 80.8);
    expect(r3).toEqual<WeightEntry[]>([
      { date: '2026-09-21', kg: 81.2 },
      { date: '2026-09-23', kg: 80.8 },
      { date: '2026-09-24', kg: 80.5 },
    ]);
    expect(r1).toEqual<WeightEntry[]>([{ date: '2026-09-24', kg: 80.5 }]);
    expect(r2).toEqual<WeightEntry[]>([
      { date: '2026-09-21', kg: 81.2 },
      { date: '2026-09-24', kg: 80.5 },
    ]);
  });

  it('addWeight replaces entry with same date (no duplicates)', () => {
    addWeight('marc', '2026-09-21', 81.2);
    const list = addWeight('marc', '2026-09-21', 80.9);
    expect(list).toEqual<WeightEntry[]>([{ date: '2026-09-21', kg: 80.9 }]);
  });

  it('weights are isolated per profile', () => {
    addWeight('marc', '2026-09-21', 81.2);
    addWeight('melanie', '2026-09-21', 62.4);
    expect(getWeights('marc')).toEqual<WeightEntry[]>([{ date: '2026-09-21', kg: 81.2 }]);
    expect(getWeights('melanie')).toEqual<WeightEntry[]>([{ date: '2026-09-21', kg: 62.4 }]);
  });
});

describe('storage: corrupted keys', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('loadWeek returns null and removes a corrupted week key', () => {
    localStorage.setItem('sportapp:week', '{invalid');
    expect(loadWeek()).toBeNull();
    expect(localStorage.getItem('sportapp:week')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('Clé corrompue ignorée : sportapp:week');
  });

  it('loadWeek returns null and removes a week with a valid JSON but malformed shape', () => {
    localStorage.setItem('sportapp:week', '{"foo":1}');
    expect(loadWeek()).toBeNull();
    expect(localStorage.getItem('sportapp:week')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('Semaine corrompue ignorée : sportapp:week');
  });

  it('getChecks returns {} and removes a corrupted checks key', () => {
    localStorage.setItem('sportapp:checks:2026-S39', 'nope[');
    expect(getChecks('2026-S39')).toEqual({});
    expect(localStorage.getItem('sportapp:checks:2026-S39')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('Clé corrompue ignorée : sportapp:checks:2026-S39');
  });

  it('getChecks returns {} and removes a valid JSON with a wrong shape (array)', () => {
    localStorage.setItem('sportapp:checks:2026-S39', '[1,2]');
    expect(getChecks('2026-S39')).toEqual({});
    expect(localStorage.getItem('sportapp:checks:2026-S39')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('Checks corrompus ignorés : sportapp:checks:2026-S39');
  });

  it('getChecks returns {} and removes a valid JSON with a wrong shape (null)', () => {
    localStorage.setItem('sportapp:checks:2026-S39', 'null');
    expect(getChecks('2026-S39')).toEqual({});
    expect(localStorage.getItem('sportapp:checks:2026-S39')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('Checks corrompus ignorés : sportapp:checks:2026-S39');
  });

  it('getWeights returns [] and removes a corrupted weights key', () => {
    localStorage.setItem('sportapp:weights:marc', '{"date":');
    expect(getWeights('marc')).toEqual<WeightEntry[]>([]);
    expect(localStorage.getItem('sportapp:weights:marc')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('Clé corrompue ignorée : sportapp:weights:marc');
  });

  it('getWeights returns [] and removes a valid JSON with a wrong shape (object)', () => {
    localStorage.setItem('sportapp:weights:marc', '{"a":1}');
    expect(getWeights('marc')).toEqual<WeightEntry[]>([]);
    expect(localStorage.getItem('sportapp:weights:marc')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('Pesées corrompues ignorées : sportapp:weights:marc');
  });

  it('getWeights returns [] and removes entries with wrong field types', () => {
    localStorage.setItem('sportapp:weights:marc', '[{"date":"2026-09-21","kg":"81.2"}]');
    expect(getWeights('marc')).toEqual<WeightEntry[]>([]);
    expect(localStorage.getItem('sportapp:weights:marc')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('Pesées corrompues ignorées : sportapp:weights:marc');
  });

  it('getChecks returns {} silently on an absent key (no warn, no remove)', () => {
    expect(getChecks('2026-S40')).toEqual({});
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('getWeights returns [] silently on an absent key (no warn, no remove)', () => {
    expect(getWeights('marc')).toEqual<WeightEntry[]>([]);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('storage: profil v2', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const profilV2Complet: UserProfile = {
    id: 'marc',
    dateNaissance: '1985-04-12',
    taille: 178,
    poidsObjectif: 74,
    objectif: { type: 'perte', echeance: '2026-12-15' },
    complements: ['Whey', 'Créatine'],
    regime: 'aucun',
  };

  it('loadProfile returns null silently when nothing saved (no warn, no remove)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(loadProfile()).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('saveProfile then loadProfile roundtrips the profile v2', () => {
    saveProfile(profilV2Complet);
    expect(loadProfile()).toEqual(profilV2Complet);
    saveProfile({ ...profilV2Complet, id: 'melanie', dateNaissance: '1987-03-02', taille: 165 });
    expect(loadProfile()).toEqual({
      ...profilV2Complet,
      id: 'melanie',
      dateNaissance: '1987-03-02',
      taille: 165,
    });
  });

  it('les champs optionnels (poidsObjectif, echeance) restent optionnels', () => {
    const minimal: UserProfile = {
      id: 'marc',
      dateNaissance: '1985-04-12',
      taille: 178,
      objectif: { type: 'maintien' },
      complements: [],
      regime: 'keto',
    };
    saveProfile(minimal);
    expect(loadProfile()).toEqual(minimal);
  });

  it('removeProfile removes the stored profile', () => {
    saveProfile(profilV2Complet);
    removeProfile();
    expect(loadProfile()).toBeNull();
    expect(localStorage.getItem('sportapp:profile')).toBeNull();
  });

  it('un complément non string invalide le profil', () => {
    localStorage.setItem(
      'sportapp:profile',
      JSON.stringify({ ...profilV2Complet, complements: [42] }),
    );
    expect(loadProfile()).toBeNull();
  });
});

describe('storage: profil v2 corrompu', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  const base: UserProfile = {
    id: 'marc',
    dateNaissance: '1985-04-12',
    taille: 178,
    objectif: { type: 'perte' },
    complements: [],
    regime: 'aucun',
  };

  const poser = (p: unknown) => localStorage.setItem('sportapp:profile', JSON.stringify(p));

  it('loadProfile returns null and removes corrupted JSON', () => {
    localStorage.setItem('sportapp:profile', '{oops');
    expect(loadProfile()).toBeNull();
    expect(localStorage.getItem('sportapp:profile')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('Profil corrompu ignoré : sportapp:profile');
  });

  it('refuse un id inconnu', () => {
    poser({ ...base, id: 'jean' });
    expect(loadProfile()).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('Profil corrompu ignoré : sportapp:profile');
  });

  it('refuse une dateNaissance non string', () => {
    poser({ ...base, dateNaissance: 1985 });
    expect(loadProfile()).toBeNull();
  });

  it('refuse un objectif manquant ou de type inconnu', () => {
    poser({ id: 'marc', dateNaissance: '1985-04-12', taille: 178, complements: [], regime: 'aucun' });
    expect(loadProfile()).toBeNull();
    poser({ ...base, objectif: { type: 'zigzag' } });
    expect(loadProfile()).toBeNull();
  });

  it('refuse un regime inconnu', () => {
    poser({ ...base, regime: 'carnivore' });
    expect(loadProfile()).toBeNull();
  });

  it('refuse des complements absents', () => {
    poser({ id: 'marc', dateNaissance: '1985-04-12', taille: 178, objectif: { type: 'perte' }, regime: 'aucun' });
    expect(loadProfile()).toBeNull();
  });

  it('loadProfile returns null and removes wrong shape (array, null)', () => {
    localStorage.setItem('sportapp:profile', '[1]');
    expect(loadProfile()).toBeNull();
    localStorage.setItem('sportapp:profile', 'null');
    expect(loadProfile()).toBeNull();
    expect(localStorage.getItem('sportapp:profile')).toBeNull();
  });
});

describe('storage: loadProfilLegacy (ancienne forme age)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lit l ancienne forme {id, age, taille}', () => {
    localStorage.setItem('sportapp:profile', JSON.stringify({ id: 'marc', age: 41, taille: 178 }));
    expect(loadProfilLegacy()).toEqual({ id: 'marc', age: 41, taille: 178 });
  });

  it('lit les objectifs optionnels de l ancienne forme', () => {
    localStorage.setItem(
      'sportapp:profile',
      JSON.stringify({ id: 'melanie', age: 38, taille: 165, poidsObjectif: 62, kcalObjectif: 1450 }),
    );
    expect(loadProfilLegacy()).toEqual({
      id: 'melanie',
      age: 38,
      taille: 165,
      poidsObjectif: 62,
      kcalObjectif: 1450,
    });
  });

  it('retourne null sur la nouvelle forme v2 (pas un legacy)', () => {
    localStorage.setItem(
      'sportapp:profile',
      JSON.stringify({
        id: 'marc',
        dateNaissance: '1985-04-12',
        taille: 178,
        objectif: { type: 'perte' },
        complements: [],
        regime: 'aucun',
      }),
    );
    expect(loadProfilLegacy()).toBeNull();
  });

  it('retourne null si absent ou corrompu (silencieux, clé conservée)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(loadProfilLegacy()).toBeNull();
    localStorage.setItem('sportapp:profile', '{oops');
    expect(loadProfilLegacy()).toBeNull();
    expect(localStorage.getItem('sportapp:profile')).toBe('{oops');
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('ne touche pas à la clé (migration à l enregistrement, pas à la lecture)', () => {
    localStorage.setItem('sportapp:profile', JSON.stringify({ id: 'marc', age: 41, taille: 178 }));
    loadProfilLegacy();
    expect(JSON.parse(localStorage.getItem('sportapp:profile')!)).toEqual({
      id: 'marc',
      age: 41,
      taille: 178,
    });
  });
});

describe('dates: todayKey', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns mardi on Tuesday 2026-09-22', () => {
    vi.useFakeTimers();
    // Utiliser la forme `T10:00:00` (parse en heure locale), pas la forme date-only (parse en UTC).
    vi.setSystemTime(new Date('2026-09-22T10:00:00'));
    expect(todayKey()).toBe('mardi');
  });

  it('returns samedi on Saturday 2026-09-26', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T10:00:00'));
    expect(todayKey()).toBe('samedi');
  });

  it('returns dimanche on Sunday 2026-09-27', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-27T10:00:00'));
    expect(todayKey()).toBe('dimanche');
  });
});

describe('storage: multi-semaines', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadWeeks retourne {} silencieusement sans aucune clé', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(loadWeeks()).toEqual({});
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('upsertWeek puis loadWeeks font l’aller-retour', () => {
    const raw = '---\nsemaine: 2026-S38\n---\n';
    const data = { ...week(), meta: { ...week().meta, semaine: '2026-S38' } };
    upsertWeek(raw, data);
    expect(loadWeeks()).toEqual({
      '2026-S38': { raw, data, importedAt: expect.any(String) },
    });
  });

  it('upsertWeek remplace la même semaine et préserve les autres', () => {
    const s38 = { ...week(), meta: { ...week().meta, semaine: '2026-S38' } };
    const s39 = { ...week(), meta: { ...week().meta, semaine: '2026-S39' } };
    upsertWeek('raw-a', s38);
    upsertWeek('raw-b', s39);
    upsertWeek('raw-a2', s38);
    const semaines = loadWeeks();
    expect(Object.keys(semaines).sort()).toEqual(['2026-S38', '2026-S39']);
    expect(semaines['2026-S38'].raw).toBe('raw-a2');
    expect(semaines['2026-S39'].raw).toBe('raw-b');
  });

  it('migration : sportapp:week présent → recopié dans sportapp:weeks, ancienne clé intacte', () => {
    const raw = '---\nsemaine: 2026-S37\n---\n';
    saveWeek(raw, { ...week(), meta: { ...week().meta, semaine: '2026-S37' } });
    const semaines = loadWeeks();
    expect(semaines['2026-S37']).toBeDefined();
    expect(localStorage.getItem('sportapp:weeks')).not.toBeNull();
    expect(localStorage.getItem('sportapp:week')).not.toBeNull();
  });

  it('JSON invalide → {} + clé retirée + warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('sportapp:weeks', '{oops');
    expect(loadWeeks()).toEqual({});
    expect(localStorage.getItem('sportapp:weeks')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('Clé corrompue ignorée : sportapp:weeks');
    warnSpy.mockRestore();
  });

  it('entrée corrompue retirée silencieusement, les autres gardées', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bonne = {
      raw: 'raw',
      data: { meta: { semaine: '2026-S40', menu: 'D', du: '2026-09-28', au: '2026-10-04' } },
      importedAt: '2026-09-09T10:00:00.000Z',
    };
    localStorage.setItem(
      'sportapp:weeks',
      JSON.stringify({ semaines: { '2026-S38': { raw: 'x' }, '2026-S40': bonne } }),
    );
    const semaines = loadWeeks();
    expect(Object.keys(semaines)).toEqual(['2026-S40']);
    expect(warnSpy).toHaveBeenCalledWith('Semaine corrompue ignorée : 2026-S38');
    warnSpy.mockRestore();
  });
});

describe('storage: dépenses', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getDepenses retourne [] silencieusement quand la clé est absente (no warn, no remove)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getDepenses()).toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem('sportapp:depenses')).toBeNull();
    warnSpy.mockRestore();
  });

  it('saveDepense persiste et getDepenses relit', () => {
    saveDepense('2026-09-09', 'Lidl', 38.2);
    expect(getDepenses()).toEqual<DepenseEntry[]>([{ date: '2026-09-09', magasin: 'Lidl', total: 38.2 }]);
  });

  it('saveDepense upsert : remplace la même paire (date, magasin) — casse du magasin ignorée', () => {
    saveDepense('2026-09-09', 'Lidl', 38.2);
    saveDepense('2026-09-09', 'lidl', 41.5);
    expect(getDepenses()).toEqual<DepenseEntry[]>([{ date: '2026-09-09', magasin: 'Lidl', total: 38.2 }]);
    saveDepense('2026-09-09', 'Lidl', 39.9);
    expect(getDepenses()).toEqual<DepenseEntry[]>([{ date: '2026-09-09', magasin: 'Lidl', total: 39.9 }]);
  });

  it('deux magasins le même jour = deux entrées, triées par date desc', () => {
    saveDepense('2026-09-02', 'Lidl', 35.1);
    saveDepense('2026-09-09', 'Intermarché', 41.3);
    saveDepense('2026-09-09', 'Lidl', 38.2);
    expect(getDepenses()).toEqual<DepenseEntry[]>([
      { date: '2026-09-09', magasin: 'Lidl', total: 38.2 },
      { date: '2026-09-09', magasin: 'Intermarché', total: 41.3 },
      { date: '2026-09-02', magasin: 'Lidl', total: 35.1 },
    ]);
  });

  it('deleteDepense retire la ligne (casse ignorée)', () => {
    saveDepense('2026-09-09', 'Lidl', 38.2);
    saveDepense('2026-09-02', 'Lidl', 35.1);
    deleteDepense('2026-09-09', 'lidl');
    expect(getDepenses()).toEqual<DepenseEntry[]>([{ date: '2026-09-02', magasin: 'Lidl', total: 35.1 }]);
  });

  it('rejette les entrées illégales et garde les valides (warn par entrée)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(
      'sportapp:depenses',
      JSON.stringify([
        { date: '2026-09-09', magasin: 'Lidl', total: 38.2 },
        { date: 'invalide', magasin: 'X', total: 5 },
        { date: '2026-09-02', magasin: '  ', total: 10 },
        { date: '2026-09-01', magasin: 'Aldi', total: -3 },
      ]),
    );
    expect(getDepenses()).toEqual<DepenseEntry[]>([{ date: '2026-09-09', magasin: 'Lidl', total: 38.2 }]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('clé entière corrompue → warn + remove + []', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('sportapp:depenses', '{pas du json');
    expect(getDepenses()).toEqual([]);
    expect(localStorage.getItem('sportapp:depenses')).toBeNull();
    warnSpy.mockRestore();
  });

  it('clé non-tableau → warn + remove + []', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('sportapp:depenses', JSON.stringify({ oops: true }));
    expect(getDepenses()).toEqual([]);
    expect(localStorage.getItem('sportapp:depenses')).toBeNull();
    warnSpy.mockRestore();
  });
});

describe('storage: profil — champs maison & courses', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const base: UserProfile = {
    id: 'marc',
    dateNaissance: '1985-04-12',
    taille: 178,
    objectif: { type: 'maintien' },
    complements: [],
    regime: 'aucun',
  };

  it('roundtrip avec les champs maison remplis', () => {
    const p: UserProfile = {
      ...base,
      magasin: 'Lidl',
      budgetMax: 40,
      preferences: ['Healthy', 'Petit budget'],
      personnes: 4,
      repasJour: 3,
    };
    saveProfile(p);
    expect(loadProfile()).toEqual(p);
  });

  it('saveProfile dédoublonne et normalise preferences (casse/accents ignorés) et trim magasin', () => {
    saveProfile({ ...base, magasin: '  Lidl  ', preferences: ['Healthy', 'healthy', '  HEALTHY '] });
    expect(loadProfile()).toEqual({ ...base, magasin: 'Lidl', preferences: ['Healthy'] });
  });

  it('loadProfile ignore un champ optionnel illégal sans invalider le profil', () => {
    saveProfile({ ...base, budgetMax: 40 });
    // réécrit la clé en injectant des champs illégaux
    const raw = JSON.parse(localStorage.getItem('sportapp:profile')!);
    localStorage.setItem(
      'sportapp:profile',
      JSON.stringify({ ...raw, budgetMax: 'beaucoup', personnes: 0, magasin: 42 }),
    );
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(loadProfile()).toEqual(base);
    warnSpy.mockRestore();
  });

  it('loadProfile reste strict sur les champs requis', () => {
    saveProfile({ ...base, budgetMax: 40 });
    const raw = JSON.parse(localStorage.getItem('sportapp:profile')!);
    localStorage.setItem('sportapp:profile', JSON.stringify({ ...raw, dateNaissance: 1985 }));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(loadProfile()).toBeNull();
    expect(localStorage.getItem('sportapp:profile')).toBeNull();
    warnSpy.mockRestore();
  });
});

describe('Profil v2.2 — prenom et champs optionnels', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const base = {
    objectif: { type: 'perte' as const },
    complements: [],
    regime: 'aucun' as const,
  };

  it('roundtrip : prenom trimé persisté et relu', () => {
    saveProfile({ id: 'marc', prenom: '  Jean  ', dateNaissance: '1985-04-12', taille: 178, ...base });
    expect(loadProfile()?.prenom).toBe('Jean');
  });

  it('prenom non-string : champ lâché, profil valide', () => {
    localStorage.setItem(
      'sportapp:profile',
      JSON.stringify({ id: 'marc', dateNaissance: '1985-04-12', taille: 178, prenom: 42, ...base }),
    );
    expect(loadProfile()?.prenom).toBeUndefined();
    expect(loadProfile()?.id).toBe('marc');
  });

  it('profil partiel (onboarding sauté) : sans date ni taille, loadProfile OK', () => {
    localStorage.setItem(
      'sportapp:profile',
      JSON.stringify({ id: 'melanie', prenom: 'Mel', ...base }),
    );
    const p = loadProfile();
    expect(p?.prenom).toBe('Mel');
    expect(p?.dateNaissance).toBeUndefined();
    expect(p?.taille).toBeUndefined();
  });

  it('champs illégaux lâchés sans invalider : date vide, taille <= 0, prenom espaces', () => {
    localStorage.setItem(
      'sportapp:profile',
      JSON.stringify({
        id: 'marc',
        prenom: '   ',
        dateNaissance: '',
        taille: 0,
        poidsObjectif: 'x',
        ...base,
      }),
    );
    const p = loadProfile();
    expect(p?.prenom).toBeUndefined();
    expect(p?.dateNaissance).toBeUndefined();
    expect(p?.taille).toBeUndefined();
    expect(p?.poidsObjectif).toBeUndefined();
  });

  it('saveProfile trime le prenom dans le payload sync', () => {
    saveProfile({ id: 'marc', prenom: '  Jean ', dateNaissance: '1985-04-12', taille: 178, ...base });
    const brut = JSON.parse(localStorage.getItem('sportapp:profile')!);
    expect(brut.prenom).toBe('Jean');
  });

  it('saveProfile ne crash pas sur un prenom illégal (payload sync corrompu)', () => {
    saveProfile({
      id: 'marc',
      dateNaissance: '1985-04-12',
      taille: 178,
      prenom: 42 as unknown as string,
      ...base,
    });
    expect(loadProfile()?.prenom).toBeUndefined();
    expect(loadProfile()?.id).toBe('marc');
  });
});

describe('storage: sélection de semaine consultée', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sauvegarde et relit la semaine consultée', () => {
    sauverSelection('2026-S39');
    expect(lireSelection()).toBe('2026-S39');
  });

  it('clé absente : null, silencieux', () => {
    expect(lireSelection()).toBeNull();
  });

  it('JSON corrompu : null, clé réparée (retirée)', () => {
    localStorage.setItem('sportapp:selection', '{pas du json');
    expect(lireSelection()).toBeNull();
    expect(localStorage.getItem('sportapp:selection')).toBeNull();
  });

  it('valeur non-string ou vide : null, clé réparée', () => {
    localStorage.setItem('sportapp:selection', '42');
    expect(lireSelection()).toBeNull();
    localStorage.setItem('sportapp:selection', '""');
    expect(lireSelection()).toBeNull();
    expect(localStorage.getItem('sportapp:selection')).toBeNull();
  });

  it('effacerSelection retire la clé', () => {
    sauverSelection('2026-S39');
    effacerSelection();
    expect(lireSelection()).toBeNull();
    expect(localStorage.getItem('sportapp:selection')).toBeNull();
  });
});
