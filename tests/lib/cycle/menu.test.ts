import { describe, expect, it } from 'vitest';
import {
  compteRepasSemaine,
  concerne,
  idCocheRepas,
  jourDeDate,
  repasDuJour,
  titreRepas,
} from '../../../src/lib/cycle/menu';
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
