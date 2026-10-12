import { describe, expect, it } from 'vitest';
import {
  compteRepasSemaine,
  concerne,
  idCocheRepas,
  jourDeDate,
  prochainRepasDuJour,
  repasDuJour,
  titreRepas,
} from '../../../src/lib/cycle/menu';
import { repasAvecReports } from '../../../src/lib/cycle/reports';
import type { Cycle } from '../../../src/lib/cycle/types';
import { importerCycle } from '../../../src/lib/cycle/valider';
import { enFichiers, quatreFichiers } from './fabrique';

const cycleDe = (fs = quatreFichiers()): Cycle => {
  const r = importerCycle(enFichiers(fs));
  if (!r.cycle) throw new Error(r.erreurs.join('\n'));
  return r.cycle;
};

const avecDejeuners = () => {
  const fs = quatreFichiers();
  const lundi = fs[0].menus[0].jours[0];
  lundi.repas.push(
    { id: 'lundi-dejeuner-alex', moment: 'dejeuner', pour: ['alex'], texte: 'Box poulet' },
    { id: 'lundi-dejeuner-sam', moment: 'dejeuner', pour: ['sam'], texte: 'Salade' },
  );
  return cycleDe(fs);
};

describe('prochainRepasDuJour (ardoise d’Aujourd’hui)', () => {
  it('10 h : le midi qui vient, le soir ensuite', () => {
    const duJour = repasAvecReports(avecDejeuners(), 0, 'lundi', 'alex', []);
    const dix = new Date('2026-10-05T10:00:00');
    expect(prochainRepasDuJour(duJour, {}, dix)?.repas.id).toBe('lundi-dejeuner-alex');
    const midi = duJour.find((x) => x.repas.id === 'lundi-dejeuner-alex')!;
    expect(prochainRepasDuJour(duJour, { [midi.id]: true }, dix)?.repas.id).toBe('lundi-diner-famille');
  });

  it('19 h : directement le soir, jamais une collation', () => {
    const fs = quatreFichiers();
    fs[0].menus[0].jours[0].repas.push({
      id: 'lundi-collation',
      moment: 'collation',
      pour: 'famille',
      texte: 'Compote',
    });
    const dixNeuf = new Date('2026-10-05T19:00:00');
    expect(prochainRepasDuJour(repasAvecReports(cycleDe(fs), 0, 'lundi', 'alex', []), {}, dixNeuf)?.repas.id).toBe(
      'lundi-diner-famille',
    );
  });

  it('tous les repas du moment sont faits : null (journée bouclée)', () => {
    const duJour = repasAvecReports(cycleDe(), 0, 'lundi', 'alex', []);
    const dix = new Date('2026-10-05T10:00:00');
    const coches = Object.fromEntries(duJour.map((x) => [x.id, true]));
    expect(prochainRepasDuJour(duJour, coches, dix)).toBeNull();
  });
});

describe('repas du jour', () => {
  it('ceux du membre (famille compris), déjeuner avant dîner', () => {
    const c = avecDejeuners();
    expect(repasDuJour(c, 'A', 'lundi', 'alex').map((r) => r.id)).toEqual(['lundi-dejeuner-alex', 'lundi-diner-famille']);
    expect(repasDuJour(c, 'A', 'lundi', 'sam').map((r) => r.id)).toEqual(['lundi-dejeuner-sam', 'lundi-diner-famille']);
    expect(concerne({ id: 'x', moment: 'diner', pour: 'famille' }, 'lou')).toBe(true);
  });

  it('titre : nom de la recette, sinon le texte', () => {
    const c = avecDejeuners();
    const [box, diner] = repasDuJour(c, 'A', 'lundi', 'alex');
    expect(titreRepas(c, box)).toBe('Box poulet');
    expect(titreRepas(c, diner)).toBe('Recette diner-a-lundi');
  });
});

describe('coches des repas', () => {
  it('id stable menu:{lettre}:{jour}:{repas}', () => {
    expect(idCocheRepas('B', 'mardi', { id: 'mardi-diner-famille', moment: 'diner', pour: 'famille' })).toBe(
      'menu:B:mardi:mardi-diner-famille',
    );
  });

  it('compte les repas du membre sur la semaine', () => {
    const c = avecDejeuners();
    expect(compteRepasSemaine(c, 'A', 'alex', {})).toEqual({ faits: 0, total: 8 });
    const coches = { 'menu:A:lundi:lundi-dejeuner-alex': true, 'menu:A:lundi:lundi-dejeuner-sam': true };
    expect(compteRepasSemaine(c, 'A', 'alex', coches)).toEqual({ faits: 1, total: 8 });
  });
});

describe('jourDeDate', () => {
  it('jour de la semaine d’une date ISO', () => {
    expect(jourDeDate('2026-10-07')).toBe('mercredi');
    expect(jourDeDate('2026-10-11')).toBe('dimanche');
  });
});
