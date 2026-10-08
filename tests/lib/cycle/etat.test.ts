import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type CycleActif,
  type Report,
  assurerMoi,
  effacerCycle,
  foyerParDefaut,
  getReports,
  loadCycle,
  loadFoyer,
  loadPrecedent,
  migrerV2,
  saveCycle,
  saveFoyer,
  savePrecedent,
  saveReports,
  semaineCoches,
} from '../../../src/lib/cycle/etat';
import { importerCycle } from '../../../src/lib/cycle/valider';
import type { UserProfile } from '../../../src/lib/model';
import { getChecks, setCheck } from '../../../src/lib/storage';
import { enFichiers, quatreFichiers } from './fabrique';

const cycleActif = (): CycleActif => {
  const r = importerCycle(enFichiers(quatreFichiers()));
  if (!r.cycle) throw new Error(r.erreurs.join('\n'));
  return { id: 'c1', numero: 1, debut: '2026-10-10', pauses: [], cycle: r.cycle };
};

const profilMel: UserProfile = {
  id: 'melanie',
  prenom: 'Mél',
  objectif: { type: 'perte' },
  complements: [],
  regime: 'keto',
  magasin: 'Lidl',
  budgetMax: 110,
};

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('foyer', () => {
  it('absent → null, sans warning', () => {
    const warn = vi.spyOn(console, 'warn');
    expect(loadFoyer()).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it('défaut : moi seul (adulte, sur ce téléphone), courses samedi, rituel dimanche, magasin et budget repris du profil', () => {
    const f = foyerParDefaut({ ...profilMel, id: 'mel-3f9a' });
    expect(f.membres).toEqual([
      { id: 'mel-3f9a', prenom: 'Mél', type: 'adulte', suivi: true, regime: 'keto', telephone: true },
    ]);
    expect(f.jourCourses).toBe('samedi');
    expect(f.jourRituel).toBe('dimanche');
    expect(f.semaine.mercredi).toEqual({ dejeuner: { 'mel-3f9a': 'maison' }, diner: 'famille', plusTard: [] });
    expect(f.exceptions).toEqual([]);
    expect(f).toMatchObject({ magasin: 'Lidl', budgetMax: 110 });
    expect(foyerParDefaut(null).membres).toEqual([]);
    expect(foyerParDefaut({ ...profilMel, id: 'mel-3f9a', suivi: false }).membres[0].suivi).toBe(false);
  });

  it('défaut des profils historiques marc / melanie : les deux adultes (compatibilité)', () => {
    const f = foyerParDefaut(profilMel);
    expect(f.membres.map((m) => [m.id, m.prenom, !!m.telephone])).toEqual([
      ['marc', 'Marc', false],
      ['melanie', 'Mél', true],
    ]);
  });

  it('assurerMoi : mon membre existe, marqué « sur un téléphone », aligné sur mon profil', () => {
    const f = { ...foyerParDefaut(null), membres: [
      { id: 'marc', prenom: 'Marc', type: 'adulte' as const, suivi: true },
      { id: 'melanie', prenom: 'Mélanie', type: 'adulte' as const, suivi: true },
    ] };
    const g = assurerMoi(f, { ...profilMel, suivi: false });
    expect(g.membres[1]).toEqual({ id: 'melanie', prenom: 'Mél', type: 'adulte', suivi: false, regime: 'keto', telephone: true });
    expect(g.membres[0]).toEqual(f.membres[0]); // les autres ne bougent pas
    expect(assurerMoi(g, { ...profilMel, suivi: false })).toBe(g); // rien à changer : même objet

    const h = assurerMoi(foyerParDefaut(null), { ...profilMel, id: 'therese-3f9a', prenom: 'Thérèse', regime: 'aucun' });
    expect(h.membres).toEqual([{ id: 'therese-3f9a', prenom: 'Thérèse', type: 'adulte', suivi: true, telephone: true }]);
    expect(h.semaine.lundi.dejeuner['therese-3f9a']).toBe('maison');
  });

  it('se sauve et se relit', () => {
    const f = foyerParDefaut(null);
    f.membres.push({ id: 'lou', prenom: 'Lou', type: 'enfant', suivi: false });
    saveFoyer(f);
    expect(loadFoyer()).toEqual(f);
  });

  it('corrompu → réparé (warn + remove + null)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('sportapp:foyer', JSON.stringify({ ...foyerParDefaut(null), jourCourses: 'jeudi soir' }));
    expect(loadFoyer()).toBeNull();
    expect(localStorage.getItem('sportapp:foyer')).toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});

describe('cycle en cours', () => {
  it('se sauve, se relit et s’efface', () => {
    const c = cycleActif();
    saveCycle(c);
    expect(loadCycle()).toEqual(c);
    effacerCycle();
    expect(loadCycle()).toBeNull();
  });

  it('corrompu (menu manquant, début illisible) → réparé', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const c = cycleActif();
    localStorage.setItem('sportapp:cycle', JSON.stringify({ ...c, cycle: { ...c.cycle, menus: c.cycle.menus.slice(1) } }));
    expect(loadCycle()).toBeNull();
    localStorage.setItem('sportapp:cycle', JSON.stringify({ ...c, debut: '10/10/2026' }));
    expect(loadCycle()).toBeNull();
    expect(localStorage.getItem('sportapp:cycle')).toBeNull();
  });

  it('garde les recettes du cycle précédent (pour le prompt)', () => {
    expect(loadPrecedent()).toEqual([]);
    savePrecedent(['Poulet rôti', 'Curry']);
    expect(loadPrecedent()).toEqual(['Poulet rôti', 'Curry']);
  });

  it('les coches d’une semaine du cycle passent par les coches existantes', () => {
    expect(semaineCoches('c1', 2)).toBe('cycle:c1:2');
    setCheck(semaineCoches('c1', 2), 'courses:C:proteines:oeuf', true);
    expect(getChecks('cycle:c1:2')).toEqual({ 'courses:C:proteines:oeuf': true });
  });
});

describe('reports', () => {
  it('par cycle ; une entrée illégale est écartée, les autres gardées', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r: Report[] = [
      { repas: 'menu:A:lundi:lundi-diner-famille', vers: { semaine: 0, jour: 'mardi' }, cree: '2026-10-12T19:00:00.000Z' },
      { repas: 'menu:A:mardi:mardi-diner-famille', vers: 'abandon', cree: '2026-10-13T19:00:00.000Z' },
    ];
    saveReports('c1', r);
    expect(getReports('c1')).toEqual(r);
    expect(getReports('c2')).toEqual([]);
    localStorage.setItem('sportapp:reports:c1', JSON.stringify([...r, { repas: 'x', vers: 'demain' }]));
    expect(getReports('c1')).toEqual(r);
  });
});

describe('migrerV2 (remise à zéro de la 2.0)', () => {
  it('efface les semaines .md et leurs coches, garde le reste, une seule fois', () => {
    const garder = {
      'sportapp:profile': '{}',
      'sportapp:weights:marc': '[]',
      'sportapp:depenses': '[]',
      'sportapp:sync:token': 't',
      'sportapp:checks:cycle:c1:0': '{}',
    };
    for (const [k, v] of Object.entries(garder)) localStorage.setItem(k, v);
    for (const k of ['sportapp:week', 'sportapp:weeks', 'sportapp:checks:2026-S39', 'sportapp:selection'])
      localStorage.setItem(k, '{}');

    expect(migrerV2()).toBe(true);
    for (const k of ['sportapp:week', 'sportapp:weeks', 'sportapp:checks:2026-S39', 'sportapp:selection'])
      expect(localStorage.getItem(k)).toBeNull();
    for (const [k, v] of Object.entries(garder)) expect(localStorage.getItem(k)).toBe(v);

    localStorage.setItem('sportapp:weeks', '{}'); // ex. ré-arrivée par une vieille sync
    expect(migrerV2()).toBe(false);
    expect(localStorage.getItem('sportapp:weeks')).toBe('{}');
  });
});
