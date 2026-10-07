import { describe, expect, it } from 'vitest';
import { cleIngredient, formatQuantite, listeCourses } from '../../../src/lib/cycle/courses';
import type { Cycle } from '../../../src/lib/cycle/types';
import { importerCycle } from '../../../src/lib/cycle/valider';
import { enFichiers, quatreFichiers } from './fabrique';

const cycleDe = (fs = quatreFichiers()): Cycle => {
  const r = importerCycle(enFichiers(fs));
  if (!r.cycle) throw new Error(r.erreurs.join('\n'));
  return r.cycle;
};

describe('cleIngredient', () => {
  it('ignore casse, accents, pluriel simple et précisions entre parenthèses', () => {
    expect(cleIngredient('Oignons')).toBe(cleIngredient('oignon'));
    expect(cleIngredient('Cuisses de poulet (10 pièces)')).toBe(cleIngredient('Cuisse de poulet (8 pièces)'));
    expect(cleIngredient('Œufs')).toBe('oeuf');
    expect(cleIngredient('Pâtes')).not.toBe(cleIngredient('Petites pâtes'));
  });
});

describe('formatQuantite', () => {
  it('passe en kg / l au-delà de 1000 et arrondit les pièces à l’unité supérieure', () => {
    expect(formatQuantite(1250, 'g')).toBe('1,25 kg');
    expect(formatQuantite(400, 'g')).toBe('400 g');
    expect(formatQuantite(1500, 'ml')).toBe('1,5 l');
    expect(formatQuantite(1.5, 'piece')).toBe('×2');
    expect(formatQuantite(2, 'boite')).toBe('2 boîtes');
    expect(formatQuantite(1, 'sachet')).toBe('1 sachet');
  });
});

describe('listeCourses', () => {
  it('agrège un même ingrédient de plusieurs recettes, en convertissant kg → g', () => {
    const fs = quatreFichiers();
    fs[0].recettes[1].ingredients.push({ nom: 'Riz', quantite: 0.5, unite: 'kg', rayon: 'feculents', prixEstime: 1 });
    fs[0].recettes[2].ingredients.push({ nom: 'riz', quantite: 250, unite: 'g', rayon: 'feculents', prixEstime: 0.5 });
    const riz = listeCourses(cycleDe(fs), 'A', 0).lignes.find((l) => l.cle === 'riz');
    expect(riz).toMatchObject({ quantite: 750, unite: 'g', prix: 1.5 });
  });

  it('range par rayon, keto en dernier, et sort le placard à part', () => {
    const fs = quatreFichiers();
    fs[0].fixes!.push({ nom: 'Avocats', quantite: 4, unite: 'piece', rayon: 'keto', prixEstime: 3, pour: ['sam'], frequence: 'hebdo' });
    const l = listeCourses(cycleDe(fs), 'A', 0);
    const rayons = l.lignes.map((x) => x.rayon);
    expect(rayons.at(-1)).toBe('keto');
    expect(rayons.indexOf('laitiers')).toBeGreaterThan(rayons.lastIndexOf('proteines'));
    expect(l.placard.map((x) => x.cle)).toEqual(['huile-d-olive']);
    expect(l.lignes.some((x) => x.placard)).toBe(false);
  });

  it('marque ce qui sert au rituel et donne des ids de coche stables', () => {
    const l = listeCourses(cycleDe(), 'B', 1);
    const oeufs = l.lignes.find((x) => x.cle === 'oeuf')!;
    expect(oeufs.rituel).toBe(true);
    expect(oeufs.id).toBe('courses:B:proteines:oeuf');
    expect(oeufs.quantite).toBe(8 * 6); // 7 dîners + muffins
  });

  it('ajoute les fixes hebdo chaque semaine et les mensuels la 1re semaine seulement', () => {
    const noms = (i: number) => listeCourses(cycleDe(), 'A', i).lignes.map((x) => x.nom);
    expect(noms(0)).toEqual(expect.arrayContaining(['Skyr', 'Whey']));
    expect(noms(1)).toContain('Skyr');
    expect(noms(1)).not.toContain('Whey');
  });

  it('garde la recette d’un repas qui porte une exception et ne compte qu’une fois une recette servie deux fois', () => {
    const doublon = quatreFichiers();
    const [lundi, mardi] = doublon[3].menus[0].jours;
    mardi.repas.push({ ...lundi.repas[0], id: 'mardi-dejeuner-alex', moment: 'dejeuner', pour: ['alex'] });
    expect(listeCourses(cycleDe(doublon), 'D', 0).lignes.find((x) => x.cle === 'oeuf')!.quantite).toBe(48);
    const avecException = quatreFichiers();
    avecException[3].menus[0].jours[0].repas[0].exception = { quand: '1er et 3e vendredis', pour: ['lou', 'noa'], texte: 'Pâtes au thon' };
    expect(listeCourses(cycleDe(avecException), 'D', 0).lignes.find((x) => x.cle === 'oeuf')!.quantite).toBe(48);
  });
});
