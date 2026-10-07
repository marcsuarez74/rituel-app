import { describe, expect, it } from 'vitest';
import type { Report } from '../../../src/lib/cycle/etat';
import {
  aPlacer,
  avecReport,
  fraicheur,
  ingredientsAuFrigo,
  repasAvecReports,
  sansReport,
} from '../../../src/lib/cycle/reports';
import { importerCycle } from '../../../src/lib/cycle/valider';
import { enFichiers, quatreFichiers } from './fabrique';

const cycle = () => {
  const fs = quatreFichiers();
  fs[0].recettes.find((r) => r.id === 'diner-a-lundi')!.ingredients[0].fraisJours = 2;
  return importerCycle(enFichiers(fs)).cycle!;
};
const cree = '2026-10-05T19:00:00.000Z';
const lundiA = 'menu:A:lundi:lundi-diner-famille';

describe('reports', () => {
  it('un repas reporté quitte son jour et arrive au jour visé, avec son origine', () => {
    const reports: Report[] = [{ repas: lundiA, vers: { semaine: 0, jour: 'mardi' }, cree }];
    expect(repasAvecReports(cycle(), 0, 'lundi', 'alex', reports)).toEqual([]);
    const mardi = repasAvecReports(cycle(), 0, 'mardi', 'alex', reports);
    expect(mardi.map((x) => [x.id, x.origine])).toEqual([
      ['menu:A:mardi:mardi-diner-famille', undefined],
      [lundiA, 'lundi'],
    ]);
  });

  it('abandonné : disparaît ; « semaine prochaine » : à placer dans la semaine suivante', () => {
    expect(repasAvecReports(cycle(), 0, 'lundi', 'alex', [{ repas: lundiA, vers: 'abandon', cree }])).toEqual([]);
    const r: Report[] = [{ repas: lundiA, vers: { semaine: 1 }, cree }];
    expect(aPlacer(cycle(), 1, 'alex', r).map((x) => x.id)).toEqual([lundiA]);
    expect(aPlacer(cycle(), 0, 'alex', r)).toEqual([]);
  });

  it('un report par repas : le dernier remplace, annuler le retire', () => {
    const a = avecReport([], { repas: lundiA, vers: 'abandon', cree });
    const b = avecReport(a, { repas: lundiA, vers: { semaine: 0, jour: 'jeudi' }, cree });
    expect(b).toEqual([{ repas: lundiA, vers: { semaine: 0, jour: 'jeudi' }, cree }]);
    expect(sansReport(b, lundiA)).toEqual([]);
  });

  it('fraîcheur : ingrédient frais dépassé à la date visée', () => {
    const r = cycle().recettes.find((x) => x.id === 'diner-a-lundi')!;
    expect(fraicheur(r, '2026-10-03', '2026-10-05')).toEqual([]);
    expect(fraicheur(r, '2026-10-03', '2026-10-06')).toEqual(['Œufs : à congeler ce soir']);
  });

  it('courses : ingrédients des plats reportés d’une autre semaine = déjà au frigo', () => {
    const r: Report[] = [{ repas: lundiA, vers: { semaine: 1, jour: 'mardi' }, cree }];
    expect(ingredientsAuFrigo(cycle(), 1, r).map((i) => i.nom)).toEqual(['Œufs']);
    expect(ingredientsAuFrigo(cycle(), 0, r)).toEqual([]);
  });
});
