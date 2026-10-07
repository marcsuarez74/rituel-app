import { describe, expect, it } from 'vitest';
import { estimerSemaine } from '../../../src/lib/cycle/budget';
import { importerCycle } from '../../../src/lib/cycle/valider';
import { enFichiers, quatreFichiers } from './fabrique';

const cycleDe = (fs = quatreFichiers()) => {
  const r = importerCycle(enFichiers(fs));
  if (!r.cycle) throw new Error(r.erreurs.join('\n'));
  return r.cycle;
};

describe('estimerSemaine', () => {
  it('additionne recettes du menu + rituel, fixes hebdo et mensuels lissés sur 4 semaines', () => {
    const e = estimerSemaine(cycleDe(), 'A');
    expect(e.ingredients).toBeCloseTo(8 * 1.5); // 7 dîners + muffins du rituel
    expect(e.fixes).toBeCloseTo(4 + 20 / 4);
    expect(e.total).toBeCloseTo(21);
  });

  it('exclut le placard', () => {
    const e = estimerSemaine(cycleDe(), 'B');
    expect(e.placard).toBeCloseTo(8 * 0.1);
    expect(e.total).toBeCloseTo(21);
  });

  it('compte une recette servie plusieurs fois une seule fois, exception comprise (l’exception n’est qu’un texte alternatif)', () => {
    const doublon = quatreFichiers();
    const [lundi, mardi] = doublon[2].menus[0].jours;
    mardi.repas.push({ ...lundi.repas[0], id: 'mardi-dejeuner-alex', moment: 'dejeuner', pour: ['alex'] });
    expect(estimerSemaine(cycleDe(doublon), 'C').total).toBeCloseTo(21);
    const avecException = quatreFichiers();
    avecException[2].menus[0].jours[0].repas[0].exception = { quand: '1er et 3e vendredis', pour: ['lou', 'noa'], texte: 'Pâtes au thon' };
    expect(estimerSemaine(cycleDe(avecException), 'C').total).toBeCloseTo(21);
  });

  it('isole les extras keto (rayon keto des recettes et des fixes)', () => {
    const fs = quatreFichiers();
    fs[0].fixes!.push({ nom: 'Avocats', quantite: 4, unite: 'piece', rayon: 'keto', prixEstime: 3, pour: ['sam'], frequence: 'hebdo' });
    const e = estimerSemaine(cycleDe(fs), 'D');
    expect(e.keto).toBeCloseTo(3);
    expect(e.total).toBeCloseTo(24);
  });
});
