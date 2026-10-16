// Table de conservation de docs/conservation.md §3 (J0 = jour du Rituel). Les deux doivent
// rester alignées : toute modification ici passe d'abord par le document et ses sources.

export const CATEGORIES_CONSERVATION = [
  'plat-cuisine',
  'volaille',
  'soupe',
  'oeufs-cuits',
  'feculents-cuits',
  'poisson',
  'cru-assemble',
  'oeufs-crus',
] as const;
export type CategorieConservation = (typeof CATEGORIES_CONSERVATION)[number];

/** frigoMax : dernier jour (J+n) où le plat se mange sorti du frigo ; null = exclu du Rituel et des Box. */
export const CONSERVATION: Record<CategorieConservation, { frigoMax: number | null; congelable: boolean }> = {
  'plat-cuisine': { frigoMax: 3, congelable: true },
  volaille: { frigoMax: 3, congelable: true },
  soupe: { frigoMax: 3, congelable: true },
  'oeufs-cuits': { frigoMax: 3, congelable: true },
  'feculents-cuits': { frigoMax: 2, congelable: true },
  poisson: { frigoMax: 2, congelable: true },
  'cru-assemble': { frigoMax: 2, congelable: false },
  'oeufs-crus': { frigoMax: null, congelable: false },
};

// Plus sensible = se garde moins longtemps au frigo, puis ne se congèle pas.
const sensibilite = (c: CategorieConservation): number => {
  const { frigoMax, congelable } = CONSERVATION[c];
  return (frigoMax === null ? -1 : frigoMax) * 2 + (congelable ? 1 : 0);
};

// « Un plat prend la catégorie de son ingrédient le plus sensible » (conservation.md §3).
// À durée égale, la catégorie précise (volaille…) l'emporte sur le défaut « plat cuisiné ».
export const categorieDuPlat = (categories: readonly CategorieConservation[]): CategorieConservation =>
  categories.reduce<CategorieConservation>((pire, c) => {
    const d = sensibilite(c) - sensibilite(pire);
    return d < 0 || (d === 0 && pire === 'plat-cuisine') ? c : pire;
  }, 'plat-cuisine');
