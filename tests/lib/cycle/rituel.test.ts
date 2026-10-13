import { describe, expect, it } from 'vitest';
import {
  auFrigo,
  etapesGuidees,
  grilleDimanche,
  idCocheGeste,
  idCocheMicro,
  idCocheMise,
  idCocheRange,
  idCocheReserve,
  idCocheRituel,
  platsDuDimanche,
  rangement,
  sousEtapes,
} from '../../../src/lib/cycle/rituel';
import { importerCycle } from '../../../src/lib/cycle/valider';
import { enFichiers, quatreFichiers } from './fabrique';

const cycleDe = (fs = quatreFichiers()) => importerCycle(enFichiers(fs)).cycle!;

describe('ids de coches du rituel (stables, par semaine du cycle)', () => {
  it('étape, avant de commencer, micro-batch, réserve', () => {
    expect(idCocheRituel('A', 'rituel-muffins')).toBe('rituel:A:rituel-muffins');
    expect(idCocheMise('B', 2)).toBe('mise:B:2');
    expect(idCocheMicro('C', 'mb-lundi')).toBe('micro:C:mb-lundi');
    expect(idCocheReserve('D', '½ sauce tomate (≈ 700 ml)')).toBe('reserve:D:sauce-tomate');
  });
});

describe('sousEtapes', () => {
  it('celles de l’étape, sinon les étapes de la recette liée, sinon aucune', () => {
    const fs = quatreFichiers();
    const c = cycleDe(fs);
    const etape = c.rituel.etapes[0];
    expect(sousEtapes(c, { ...etape, sousEtapes: ['Préchauffer', 'Battre'] })).toEqual(['Préchauffer', 'Battre']);
    expect(sousEtapes(c, { ...etape, recette: 'diner-a-lundi' })).toEqual(['Cuire.']);
    expect(sousEtapes(c, { ...etape, recette: undefined })).toEqual([]);
  });
});

const DIMANCHE = new Date('2026-10-11T10:00:00'); // dimanche de la semaine 1

describe('etapesGuidees (replis §5.5 + étape « On range »)', () => {
  it('normalise plats, gestes et minuteurs ; minuteurMin/enParallele anciens format repliés', () => {
    const g = etapesGuidees({
      dureeMin: 50,
      production: [],
      avantDeCommencer: [],
      termine: '',
      etapes: [
        {
          id: 'e1',
          creneau: '0-20 min',
          label: 'Muffins',
          detail: 'Au four.',
          recette: 'muffins',
          minuteurMin: 20,
          enParallele: 'Pendant ce temps : la sauce.',
        },
        {
          id: 'e2',
          creneau: '20-45 min',
          label: 'Sur le feu',
          detail: 'Lentilles et riz.',
          sousEtapes: ['Rincer les lentilles'],
          plats: ['lentilles', 'riz'],
          minuteurs: [{ nom: 'Lentilles', minutes: 25 }],
        },
      ],
    });
    expect(g[0]).toEqual({
      id: 'e1',
      titre: 'Muffins',
      plats: ['muffins'],
      gestes: ['Pendant ce temps : la sauce.'],
      minuteurs: [{ nom: 'Muffins', minutes: 20, recette: 'muffins' }],
    });
    expect(g[1]).toEqual({
      id: 'e2',
      titre: 'Sur le feu',
      plats: ['lentilles', 'riz'],
      gestes: ['Rincer les lentilles'],
      minuteurs: [{ nom: 'Lentilles', minutes: 25 }],
    });
    expect(g).toHaveLength(3);
    expect(g[2]).toEqual({ id: 'on-range', titre: 'On range', plats: [], gestes: [], minuteurs: [] });
  });
});

describe('grilleDimanche (7 jours × midi/soir, collations exclues)', () => {
  it('14 cases, les déjeuners sans repas restent vides', () => {
    const g = grilleDimanche(cycleDe(), 0);
    expect(g).toHaveLength(14);
    expect(g.filter((x) => x.moment === 'dejeuner')).toHaveLength(7);
    expect(g.every((x) => x.jour && x.moment)).toBe(true);
    const lundiMidi = g.find((x) => x.jour === 'lundi' && x.moment === 'dejeuner')!;
    expect(lundiMidi.repas).toBeUndefined();
    expect(lundiMidi.prepareDimanche).toBe(false);
  });

  it('le repas du soir est là, sans boîte il n’est pas « préparé dimanche »', () => {
    const g = grilleDimanche(cycleDe(), 0);
    const mercredi = g.find((x) => x.jour === 'mercredi' && x.moment === 'diner')!;
    expect(mercredi.repas?.id).toBe('mercredi-diner-famille');
    expect(mercredi.recetteId).toBe('diner-a-mercredi');
    expect(mercredi.prepareDimanche).toBe(false);
  });

  it('une boîte produite par une étape du rituel = préparée dimanche', () => {
    const fs = quatreFichiers();
    fs[0].menus[0].jours[2].repas[0].boite = { produitePar: 'rituel-muffins', frigoJours: 2 };
    const g = grilleDimanche(cycleDe(fs), 0);
    expect(g.find((x) => x.jour === 'mercredi' && x.moment === 'diner')!.prepareDimanche).toBe(true);
  });

  it('une boîte produite par une recette cuisinée au rituel compte aussi', () => {
    const fs = quatreFichiers();
    fs[0].rituel!.etapes[0].plats = ['muffins'];
    fs[0].menus[0].jours[2].repas[0].boite = { produitePar: 'muffins', frigoJours: 2 };
    const g = grilleDimanche(cycleDe(fs), 0);
    expect(g.find((x) => x.jour === 'mercredi' && x.moment === 'diner')!.prepareDimanche).toBe(true);
  });

  it('une boîte produite par un micro-batch du soir n’est pas « préparée dimanche »', () => {
    const fs = quatreFichiers();
    fs[0].menus[0].jours[2].repas[0].boite = { produitePar: 'mb-lundi', frigoJours: 2 };
    const g = grilleDimanche(cycleDe(fs), 0);
    expect(g.find((x) => x.jour === 'mercredi' && x.moment === 'diner')!.prepareDimanche).toBe(false);
  });
});

describe('platsDuDimanche (recettes cuisinées + repas couverts)', () => {
  it('les plats du rituel dans l’ordre, avec les repas à boîte qu’ils couvrent', () => {
    const fs = quatreFichiers();
    fs[0].rituel!.etapes[0].plats = ['muffins'];
    fs[0].menus[0].jours[2].repas[0].boite = { produitePar: 'rituel-muffins', frigoJours: 2 };
    const p = platsDuDimanche(cycleDe(fs), 0);
    const muffins = p.find((x) => x.recette.id === 'muffins')!;
    expect(muffins.repas.map((r) => r.id)).toContain('mercredi-diner-famille');
  });

  it('le repas mangé le jour même (recette = plat du rituel) est couvert aussi', () => {
    const fs = quatreFichiers();
    fs[0].menus[0].jours[6].repas[0].recette = 'muffins'; // dîner du dimanche
    const p = platsDuDimanche(cycleDe(fs), 0);
    const muffins = p.find((x) => x.recette.id === 'muffins')!;
    expect(muffins.repas.map((r) => r.id)).toContain('dimanche-diner-famille');
  });

  it('un plat de la semaine non cuisiné au rituel n’apparaît pas', () => {
    const p = platsDuDimanche(cycleDe(), 0);
    expect(p.find((x) => x.recette.id === 'diner-a-mercredi')).toBeUndefined();
  });
});

describe('rangement (zones box / frigo / congélateur)', () => {
  const avecBoites = () => {
    const fs = quatreFichiers();
    fs[0].menus[0].jours[2].repas.push({
      id: 'mercredi-dejeuner-alex',
      moment: 'dejeuner',
      pour: ['alex'],
      recette: 'diner-a-mercredi',
      boite: { produitePar: 'rituel-muffins', frigoJours: 1 },
    });
    fs[0].menus[0].jours[3].repas[0].boite = { produitePar: 'rituel-muffins', frigoJours: 3 };
    return fs;
  };

  it('midi avec boîte → box ; soir avec boîte → frigo ; à manger avant = dimanche + frigoJours', () => {
    const r = rangement(cycleDe(avecBoites()), 0, DIMANCHE);
    const box = r.find((x) => x.id === 'mercredi-dejeuner-alex')!;
    expect(box.zone).toBe('box');
    expect(box.aMangerAvant).toEqual(new Date('2026-10-12T10:00:00'));
    const frigo = r.find((x) => x.id === 'jeudi-diner-famille')!;
    expect(frigo.zone).toBe('frigo'); // distance 4 > 3 jours mais non congelable : reste au frigo
    expect(frigo.aMangerAvant).toEqual(new Date('2026-10-14T10:00:00'));
  });

  it('au-delà de la conservation : congélateur (sortir la veille) si la recette est congelable', () => {
    const fs = avecBoites();
    fs[0].recettes = fs[0].recettes.map((x) =>
      x.id === 'diner-a-jeudi' ? { ...x, conservation: { ...x.conservation, congelable: true } } : x,
    );
    const r = rangement(cycleDe(fs), 0, DIMANCHE);
    expect(r.find((x) => x.id === 'jeudi-diner-famille')?.zone).toBe('congel');
  });

  it('les réserves du menu finissent au congélateur, sans date limite', () => {
    const fs = quatreFichiers();
    fs[0].menus[0].reserve = [{ pour: 'mardi', plat: '½ Sauce tomate (≈ 700 ml)', conservation: 'Congélateur 3 mois' }];
    const r = rangement(cycleDe(fs), 0, DIMANCHE);
    const res = r.find((x) => x.zone === 'congel' && x.nom === '½ Sauce tomate (≈ 700 ml)')!;
    expect(res.id).toBe('sauce-tomate');
    expect(res.aMangerAvant).toBeNull();
  });

  it('les collations ne vont jamais au rangement', () => {
    const fs = quatreFichiers();
    fs[0].menus[0].jours[2].repas.push({
      id: 'mercredi-collation-sam',
      moment: 'collation',
      pour: ['sam'],
      recette: 'diner-a-mercredi',
      boite: { produitePar: 'rituel-muffins', frigoJours: 2 },
    });
    const r = rangement(cycleDe(fs), 0, DIMANCHE);
    expect(r.find((x) => x.id === 'mercredi-collation-sam')).toBeUndefined();
  });
});

describe('auFrigo (ce qui reste, trié par date limite)', () => {
  it('lignes frigo et box non mangées, triées par « à manger avant »', () => {
    const fs = quatreFichiers();
    fs[0].menus[0].jours[2].repas.push({
      id: 'mercredi-dejeuner-alex',
      moment: 'dejeuner',
      pour: ['alex'],
      recette: 'diner-a-mercredi',
      boite: { produitePar: 'rituel-muffins', frigoJours: 1 },
    });
    fs[0].menus[0].jours[3].repas[0].boite = { produitePar: 'rituel-muffins', frigoJours: 3 };
    const c = cycleDe(fs);
    const f = auFrigo(c, 0, DIMANCHE, {});
    expect(f.map((x) => x.id)).toEqual(['mercredi-dejeuner-alex', 'jeudi-diner-famille']);
  });

  it('un repas coché mangé quitte le frigo', () => {
    const fs = quatreFichiers();
    fs[0].menus[0].jours[3].repas[0].boite = { produitePar: 'rituel-muffins', frigoJours: 3 };
    const c = cycleDe(fs);
    const coches = { 'menu:A:jeudi:jeudi-diner-famille': true };
    const f = auFrigo(c, 0, DIMANCHE, coches);
    expect(f.find((x) => x.id === 'jeudi-diner-famille')).toBeUndefined();
  });
});

describe('ids de coches des gestes et du rangement (stables, §8)', () => {
  it('geste:{L}:{etapeId}:{i} et range:{L}:{clé}', () => {
    expect(idCocheGeste('A', 'rituel-muffins', 2)).toBe('geste:A:rituel-muffins:2');
    expect(idCocheRange('A', 'mercredi-dejeuner-alex')).toBe('range:A:mercredi-dejeuner-alex');
    expect(idCocheRange('B', 'sauce-tomate')).toBe('range:B:sauce-tomate');
  });
});
