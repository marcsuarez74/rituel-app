import type { ArticleFixe, Cycle, Lettre, Recette } from './types';

export interface EstimationSemaine {
  total: number; // ingrédients + fixes (placard exclu)
  ingredients: number;
  fixes: number; // hebdo + mensuels lissés sur 4 semaines
  placard: number; // huile, épices… : à vérifier, hors total
  keto: number; // part « extras keto » du total (rayon keto)
}

// Recettes DISTINCTES à acheter pour la semaine d'un menu : celles servies par
// un repas (hors exception), une étape du rituel ou un micro-batch. Une recette
// servie plusieurs fois (restes, box) n'est achetée qu'une fois.
export const recettesDeLaSemaine = (cycle: Cycle, lettre: Lettre): Recette[] => {
  const menu = cycle.menus.find((m) => m.lettre === lettre);
  if (!menu) return [];
  const ids = new Set<string>();
  for (const j of menu.jours)
    for (const r of j.repas) if (r.recette && !r.exception) ids.add(r.recette);
  for (const e of cycle.rituel.etapes) if (e.recette) ids.add(e.recette);
  for (const m of menu.microBatch) if (m.recette) ids.add(m.recette);
  return cycle.recettes.filter((r) => ids.has(r.id));
};

const coutHebdo = (f: ArticleFixe): number => (f.frequence === 'hebdo' ? f.prixEstime : f.prixEstime / 4);

export const estimerSemaine = (cycle: Cycle, lettre: Lettre): EstimationSemaine => {
  let ingredients = 0;
  let placard = 0;
  let keto = 0;
  for (const r of recettesDeLaSemaine(cycle, lettre))
    for (const i of r.ingredients) {
      if (i.placard) {
        placard += i.prixEstime;
        continue;
      }
      ingredients += i.prixEstime;
      if (i.rayon === 'keto') keto += i.prixEstime;
    }
  let fixes = 0;
  for (const f of cycle.fixes) {
    fixes += coutHebdo(f);
    if (f.rayon === 'keto') keto += coutHebdo(f);
  }
  return { total: ingredients + fixes, ingredients, fixes, placard, keto };
};
