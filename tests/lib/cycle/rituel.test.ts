import { describe, expect, it } from 'vitest';
import { idCocheMicro, idCocheMise, idCocheReserve, idCocheRituel, sousEtapes } from '../../../src/lib/cycle/rituel';
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
