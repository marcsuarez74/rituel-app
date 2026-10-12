import { describe, expect, it } from 'vitest';
import { importerCycle } from '../../../src/lib/cycle/valider';
import { enFichiers, quatreFichiers } from './fabrique';

// Non-régression : un foyer test a vu 80 erreurs bloquantes parce que l'IA avait
// inventé des rayons (« fruits-legumes », « cremerie »…) et une unité « cl ».
// Fixture minimale et anonymisée : 4 menus fusionnés.

const importer = (fs = quatreFichiers()) => importerCycle(enFichiers(fs), {});
const ing = (nom: string, unite: string, rayon: string, quantite = 25) =>
  ({ nom, quantite, unite, rayon, prixEstime: 1 }) as never;

const avecAlias = () => {
  const fs = quatreFichiers();
  const alias = [
    ['fruits-legumes', 'g'],
    ['Crèmerie', 'g'],
    ['boucherie', 'g'],
    ['poissonnerie', 'g'],
    ['surgelé', 'g'],
    ['boulangerie', 'g'],
    ['charcuterie', 'cl'],
  ];
  fs.forEach((f, i) =>
    f.recettes.forEach((r, k) => {
      const [rayon, unite] = alias[(i + k) % alias.length];
      r.ingredients.push(ing('X', unite, rayon));
    }),
  );
  return fs;
};

describe('importerCycle — alias de rayons et d’unités', () => {
  it('importe le cycle, remappe les valeurs et résume en une alerte par alias et par fichier', () => {
    const r = importer(avecAlias());
    expect(r.erreurs).toEqual([]);
    expect(r.cycle).not.toBeNull();
    const alertes = r.alertes.filter((a) => a.includes('corrigé') || a.includes('convertie'));
    expect(alertes.length).toBeLessThanOrEqual(8 * 4);
    expect(alertes).toContainEqual(
      expect.stringMatching(/rayon « fruits-legumes » corrigé en « legumes » \(\d+ ingrédients?\)/),
    );
    expect(alertes).toContainEqual(expect.stringMatching(/rayon « Crèmerie » corrigé en « laitiers »/));
    expect(alertes).toContainEqual(expect.stringMatching(/unité « cl » convertie en « ml » \(quantité ×10\)/));
    const rayons = new Set(r.cycle!.recettes.flatMap((x) => x.ingredients.map((i) => i.rayon)));
    expect([...rayons].sort()).toEqual(['epicerie', 'feculents', 'laitiers', 'legumes', 'proteines', 'surgeles']);
    const converti = r.cycle!.recettes.flatMap((x) => x.ingredients).find((i) => i.nom === 'X' && i.unite === 'ml');
    expect(converti?.quantite).toBe(250);
  });

  it('tolère casse, accents, espaces et ponctuation ; convertit dl et les cuillères', () => {
    const fs = quatreFichiers();
    fs[0].recettes[0].ingredients.push(
      ing('a', 'dl', ' Produits Laitiers ', 2),
      ing('b', 'c.à.s', 'Fruits et légumes', 1),
      ing('c', 'Pièces', 'pain', 1),
      ing('d', 'c.à.c', 'viande', 1),
    );
    const r = importer(fs);
    expect(r.erreurs).toEqual([]);
    const ings = r.cycle!.recettes.find((x) => x.id === fs[0].recettes[0].id)!.ingredients;
    expect(ings.slice(-4).map((i) => [i.unite, i.quantite, i.rayon])).toEqual([
      ['ml', 200, 'laitiers'],
      ['cs', 1, 'legumes'],
      ['piece', 1, 'feculents'],
      ['cc', 1, 'proteines'],
    ]);
  });

  it('une valeur vraiment inconnue reste bloquante, groupée par valeur', () => {
    const fs = quatreFichiers();
    for (const r of fs[0].recettes) r.ingredients.push(ing('z', 'g', 'xyz', 1));
    const r = importer(fs);
    expect(r.cycle).toBeNull();
    const lignes = r.erreurs.filter((e) => e.includes('xyz'));
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatch(/rayon « xyz » inconnu \(8 ingrédients\)/);
  });
});
