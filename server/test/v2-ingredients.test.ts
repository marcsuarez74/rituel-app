import { describe, expect, it } from 'vitest';
import { CONSERVATION, categorieDuPlat } from '../src/v2/conservation.js';
import { IDS_PUBLIES } from '../src/v2/donnees/ingredients-ids.js';
import {
  ALLERGENES,
  FAMILLES_ANIMALES,
  INGREDIENTS,
  REGIMES,
  RAYONS,
  ingredient,
  regimesCompatibles,
  type Ingredient,
} from '../src/v2/ingredients.js';

// Table d'ingrédients (plan 2026-10-16-app-native §A.5, spec §10.2.2) : le vocabulaire fermé
// sur lequel le code vérifie régime, allergènes, conservation, budget et rayon.

const ex = (surcharge: Partial<Ingredient>): Ingredient => ({
  id: 'test',
  nom: 'Test',
  famille: 'legume',
  allergenes: [],
  glucides: 'bas',
  conservation: 'plat-cuisine',
  rayon: 'fruits-legumes',
  unite: 'kg',
  prix: 2,
  ...surcharge,
});

describe('conservation (docs/conservation.md §3)', () => {
  it('reprend la table : frigo max et congélation par catégorie', () => {
    expect(CONSERVATION['plat-cuisine']).toEqual({ frigoMax: 3, congelable: true });
    expect(CONSERVATION.volaille).toEqual({ frigoMax: 3, congelable: true });
    expect(CONSERVATION.soupe).toEqual({ frigoMax: 3, congelable: true });
    expect(CONSERVATION['oeufs-cuits']).toEqual({ frigoMax: 3, congelable: true });
    expect(CONSERVATION['feculents-cuits']).toEqual({ frigoMax: 2, congelable: true });
    expect(CONSERVATION.poisson).toEqual({ frigoMax: 2, congelable: true });
    expect(CONSERVATION['cru-assemble']).toEqual({ frigoMax: 2, congelable: false });
    expect(CONSERVATION['oeufs-crus']).toEqual({ frigoMax: null, congelable: false });
  });

  it('un plat prend la catégorie de son ingrédient le plus sensible', () => {
    expect(categorieDuPlat(['plat-cuisine', 'volaille'])).toBe('volaille');
    expect(categorieDuPlat(['volaille', 'feculents-cuits'])).toBe('feculents-cuits');
    expect(categorieDuPlat(['feculents-cuits', 'cru-assemble'])).toBe('cru-assemble');
    expect(categorieDuPlat(['poisson', 'oeufs-crus'])).toBe('oeufs-crus');
    expect(categorieDuPlat([])).toBe('plat-cuisine');
  });
});

describe('régimes déduits des faits de l\'ingrédient', () => {
  it('végétarien / végan selon la famille', () => {
    expect(regimesCompatibles(ex({ famille: 'volaille', conservation: 'volaille' }))).not.toContain('vegetarien');
    expect(regimesCompatibles(ex({ famille: 'laitier', allergenes: ['lait'] }))).toContain('vegetarien');
    expect(regimesCompatibles(ex({ famille: 'laitier', allergenes: ['lait'] }))).not.toContain('vegan');
    expect(regimesCompatibles(ex({ famille: 'miel' }))).not.toContain('vegan');
    expect(regimesCompatibles(ex({}))).toContain('vegan');
    const nuocMam = ex({ famille: 'condiment', allergenes: ['poissons'] });
    expect(regimesCompatibles(nuocMam)).not.toContain('vegetarien');
    expect(regimesCompatibles(nuocMam)).not.toContain('vegan');
  });

  it('keto (glucides bas seulement) et low carb (pas haut)', () => {
    expect(regimesCompatibles(ex({ glucides: 'moyen' }))).not.toContain('keto');
    expect(regimesCompatibles(ex({ glucides: 'moyen' }))).toContain('low-carb');
    expect(regimesCompatibles(ex({ glucides: 'haut' }))).not.toContain('low-carb');
  });

  it('sans gluten, sans lactose, pauvre en sel, halal, casher, paléo', () => {
    expect(regimesCompatibles(ex({ famille: 'cereale', allergenes: ['gluten'] }))).not.toContain('sans-gluten');
    expect(regimesCompatibles(ex({ famille: 'laitier', allergenes: ['lait'] }))).not.toContain('sans-lactose');
    expect(regimesCompatibles(ex({ sale: true }))).not.toContain('pauvre-en-sel');
    expect(regimesCompatibles(ex({ famille: 'porc' }))).not.toContain('halal');
    expect(regimesCompatibles(ex({ alcool: true }))).not.toContain('halal');
    expect(regimesCompatibles(ex({ famille: 'porc' }))).not.toContain('casher');
    expect(regimesCompatibles(ex({ famille: 'fruits-de-mer', allergenes: ['crustaces'] }))).not.toContain('casher');
    expect(regimesCompatibles(ex({ famille: 'legumineuse' }))).not.toContain('paleo');
    expect(regimesCompatibles(ex({ famille: 'legume' }))).toContain('paleo');
  });
});

describe('la table d\'ingrédients', () => {
  it('assez riche pour varier 4 semaines (au moins 150 ingrédients)', () => {
    expect(INGREDIENTS.length).toBeGreaterThanOrEqual(150);
  });

  it('ids uniques, en kebab-case ASCII ; noms uniques et non vides', () => {
    const ids = INGREDIENTS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
    const noms = INGREDIENTS.map((i) => i.nom.toLowerCase());
    expect(new Set(noms).size).toBe(noms.length);
    for (const i of INGREDIENTS) expect(i.nom.trim()).toBe(i.nom);
  });

  it('un id publié ne disparaît jamais (les recettes de la bibliothèque y renvoient)', () => {
    const ids = new Set(INGREDIENTS.map((i) => i.id));
    for (const id of IDS_PUBLIES) expect(ids.has(id), id).toBe(true);
    expect([...ids].filter((id) => !IDS_PUBLIES.includes(id)), 'ajouter les nouveaux ids à ingredients-ids.json').toEqual(
      [],
    );
  });

  it('valeurs dans les listes fermées ; prix positif et plausible', () => {
    for (const i of INGREDIENTS) {
      for (const a of i.allergenes) expect(ALLERGENES, `${i.id} : ${a}`).toContain(a);
      expect(RAYONS, i.id).toContain(i.rayon);
      expect(['plat-cuisine', 'volaille', 'oeufs-cuits', 'feculents-cuits', 'poisson'], i.id).toContain(i.conservation);
      expect(i.prix, i.id).toBeGreaterThan(0);
      expect(i.prix, i.id).toBeLessThan(i.unite === 'piece' ? 15 : 80);
    }
  });

  it('cohérence famille ↔ allergènes ↔ conservation', () => {
    for (const i of INGREDIENTS) {
      const msg = i.id;
      if (i.famille === 'volaille') expect(i.conservation, msg).toBe('volaille');
      if (i.famille === 'poisson') {
        expect(i.conservation, msg).toBe('poisson');
        expect(i.allergenes, msg).toContain('poissons');
      }
      if (i.famille === 'fruits-de-mer') {
        expect(i.conservation, msg).toBe('poisson');
        expect(i.allergenes.some((a) => a === 'crustaces' || a === 'mollusques'), msg).toBe(true);
      }
      if (i.famille === 'oeuf') expect(i.allergenes, msg).toContain('oeufs');
      if (i.allergenes.includes('oeufs') && i.famille === 'oeuf') expect(i.conservation, msg).toBe('oeufs-cuits');
      if (i.famille === 'laitier') expect(i.allergenes, msg).toContain('lait');
      if (i.famille === 'noix') expect(i.allergenes.some((a) => a === 'fruits-a-coque' || a === 'arachides'), msg).toBe(true);
      if (FAMILLES_ANIMALES.includes(i.famille)) expect(i.rayon, msg).not.toBe('fruits-legumes');
    }
  });

  it('ingrédients piégeux bien étiquetés', () => {
    expect(ingredient('sauce-soja')?.allergenes).toEqual(expect.arrayContaining(['soja', 'gluten']));
    expect(ingredient('tamari')?.allergenes).not.toContain('gluten');
    expect(ingredient('moutarde')?.allergenes).toContain('moutarde');
    expect(ingredient('beurre-cacahuete')?.allergenes).toContain('arachides');
    expect(ingredient('celeri-branche')?.allergenes).toContain('celeri');
    expect(ingredient('vin-blanc')?.alcool).toBe(true);
    expect(ingredient('vin-blanc')?.allergenes).toContain('sulfites');
    expect(ingredient('lardons')?.famille).toBe('porc');
    expect(ingredient('riz-basmati')?.conservation).toBe('feculents-cuits');
    expect(ingredient('flocons-avoine')?.allergenes).toContain('gluten');
    expect(ingredient('tahini')?.allergenes).toContain('sesame');
    expect(regimesCompatibles(ingredient('sauce-poisson')!)).not.toContain('vegetarien');
    expect(ingredient('sauce-poisson')?.conservation).toBe('plat-cuisine');
    expect(ingredient('inconnu')).toBeUndefined();
  });

  it('chaque régime proposé par le guide reste faisable (au moins 30 ingrédients compatibles)', () => {
    for (const r of REGIMES) {
      const n = INGREDIENTS.filter((i) => regimesCompatibles(i).includes(r)).length;
      expect(n, r).toBeGreaterThanOrEqual(30);
    }
  });
});
