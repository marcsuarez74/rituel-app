import type { CategorieConservation } from './conservation.js';
import { DONNEES_INGREDIENTS } from './donnees/ingredients.js';

// Vocabulaire fermé des menus (spec §10.2.2) : l'IA ne cite que ces ids ; régime, allergènes,
// conservation, budget et rayon sont déduits ici, jamais des étiquettes données par l'IA.

/** Les 14 allergènes à déclaration obligatoire (règlement UE 1169/2011, annexe II). */
export const ALLERGENES = [
  'gluten',
  'crustaces',
  'oeufs',
  'poissons',
  'arachides',
  'soja',
  'lait',
  'fruits-a-coque',
  'celeri',
  'moutarde',
  'sesame',
  'sulfites',
  'lupin',
  'mollusques',
] as const;
export type Allergene = (typeof ALLERGENES)[number];

export const FAMILLES = [
  'legume',
  'fruit',
  'champignon',
  'feculent',
  'cereale',
  'legumineuse',
  'noix',
  'graine',
  'laitier',
  'oeuf',
  'volaille',
  'viande',
  'porc',
  'poisson',
  'fruits-de-mer',
  'matiere-grasse',
  'condiment',
  'epice',
  'herbe',
  'sucre',
  'miel',
  'boisson',
] as const;
export type Famille = (typeof FAMILLES)[number];

export const FAMILLES_ANIMALES: readonly Famille[] = ['volaille', 'viande', 'porc', 'poisson', 'fruits-de-mer'];

/** Rayons des courses, dans l'ordre d'un magasin. */
export const RAYONS = ['fruits-legumes', 'boucherie-poissonnerie', 'frais', 'epicerie', 'surgeles'] as const;
export type Rayon = (typeof RAYONS)[number];

/** Régimes du guide qui imposent une contrainte vérifiable par ingrédient. Flexitarien et
 * méditerranéen sont des préférences : elles orientent le prompt, sans contrôle du code. */
export const REGIMES = [
  'vegetarien',
  'vegan',
  'keto',
  'low-carb',
  'paleo',
  'sans-gluten',
  'sans-lactose',
  'halal',
  'casher',
  'pauvre-en-sel',
] as const;
export type Regime = (typeof REGIMES)[number];

export interface Ingredient {
  /** Identifiant stable : une fois publié, il ne change ni ne disparaît (ingredients-ids.ts). */
  id: string;
  nom: string;
  famille: Famille;
  allergenes: Allergene[];
  /** Glucides pour 100 g : bas < 6 g, moyen < 20 g, haut au-delà. */
  glucides: 'bas' | 'moyen' | 'haut';
  /** Catégorie de conservation de l'ingrédient cuit (docs/conservation.md §3). */
  conservation: Extract<CategorieConservation, 'plat-cuisine' | 'volaille' | 'oeufs-cuits' | 'feculents-cuits' | 'poisson'>;
  rayon: Rayon;
  /** Unité d'achat et de prix ; les recettes comptent en g (kg), ml (l) ou pièces. */
  unite: 'kg' | 'l' | 'piece';
  /** Prix moyen en grande surface, en € par unité (estimation 2026, à recaler). */
  prix: number;
  sale?: boolean;
  alcool?: boolean;
  piquant?: boolean;
}

export const INGREDIENTS: readonly Ingredient[] = DONNEES_INGREDIENTS;

const PAR_ID = new Map(INGREDIENTS.map((i) => [i.id, i]));
export const ingredient = (id: string): Ingredient | undefined => PAR_ID.get(id);

const NON_VEGETARIEN: readonly Famille[] = FAMILLES_ANIMALES;
const NON_VEGAN: readonly Famille[] = [...FAMILLES_ANIMALES, 'laitier', 'oeuf', 'miel'];
const NON_PALEO: readonly Famille[] = ['cereale', 'legumineuse', 'laitier', 'sucre'];

export const regimesCompatibles = (i: Ingredient): Regime[] => {
  const a = (x: Allergene) => i.allergenes.includes(x);
  // Un condiment à base de poisson (nuoc-mâm) n'est pas végétarien, quelle que soit sa famille.
  const animalMarin = a('poissons') || a('crustaces') || a('mollusques');
  const compatible: Record<Regime, boolean> = {
    vegetarien: !NON_VEGETARIEN.includes(i.famille) && !animalMarin,
    vegan: !NON_VEGAN.includes(i.famille) && !animalMarin && !a('lait') && !a('oeufs'),
    keto: i.glucides === 'bas',
    'low-carb': i.glucides !== 'haut',
    paleo: !NON_PALEO.includes(i.famille) && !a('gluten') && !a('soja') && !a('lait') && !a('arachides'),
    'sans-gluten': !a('gluten'),
    'sans-lactose': !a('lait'),
    halal: i.famille !== 'porc' && !i.alcool,
    casher: i.famille !== 'porc' && i.famille !== 'fruits-de-mer',
    'pauvre-en-sel': !i.sale,
  };
  return REGIMES.filter((r) => compatible[r]);
};
