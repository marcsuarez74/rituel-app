import { ajouterJours } from './calendrier';
import type { Report } from './etat';
import { concerne, idCocheRepas, repasDuJour, trouverRecette } from './menu';
import type { Cycle, Ingredient, Jour, MembreId, Recette, Repas } from './types';
import { LETTRES, type Lettre } from './types';

// Report de repas (spec 2026-10-07 §8) : un report n'est qu'une redirection
// du repas d'origine (son id de coche ne change jamais). Un report par repas.

export interface RepasAffiche {
  repas: Repas;
  id: string; // id de coche du repas d'origine
  origine?: Jour; // jour d'origine quand le repas arrive d'ailleurs
}

const lire = (id: string) => {
  const [, lettre, jour, ...reste] = id.split(':');
  return { lettre: lettre as Lettre, jour: jour as Jour, repasId: reste.join(':') };
};

const repasDe = (cycle: Cycle, id: string): Repas | undefined => {
  const { lettre, jour, repasId } = lire(id);
  return cycle.menus.find((m) => m.lettre === lettre)?.jours.find((j) => j.jour === jour)?.repas.find((r) => r.id === repasId);
};

export const avecReport = (reports: Report[], r: Report): Report[] => [...sansReport(reports, r.repas), r];
export const sansReport = (reports: Report[], repas: string): Report[] => reports.filter((r) => r.repas !== repas);

const entrants = (cycle: Cycle, reports: Report[], membre: MembreId, garde: (v: Exclude<Report['vers'], 'abandon'>) => boolean) =>
  reports.flatMap((r): RepasAffiche[] => {
    if (r.vers === 'abandon' || !garde(r.vers)) return [];
    const repas = repasDe(cycle, r.repas);
    return repas && concerne(repas, membre) ? [{ repas, id: r.repas, origine: lire(r.repas).jour }] : [];
  });

// Les repas d'un jour : ceux du menu sans report, puis ceux reportés vers lui.
export const repasAvecReports = (
  cycle: Cycle,
  semaine: number,
  jour: Jour,
  membre: MembreId,
  reports: Report[],
): RepasAffiche[] => {
  const lettre = LETTRES[semaine];
  const deplaces = new Set(reports.map((r) => r.repas));
  return [
    ...repasDuJour(cycle, lettre, jour, membre)
      .map((repas) => ({ repas, id: idCocheRepas(lettre, jour, repas) }))
      .filter((x) => !deplaces.has(x.id)),
    ...entrants(cycle, reports, membre, (v) => v.semaine === semaine && v.jour === jour),
  ];
};

// « Reporté de la semaine dernière » : reportés vers la semaine, sans jour.
export const aPlacer = (cycle: Cycle, semaine: number, membre: MembreId, reports: Report[]): RepasAffiche[] =>
  entrants(cycle, reports, membre, (v) => v.semaine === semaine && !v.jour);

// Avertissement fraîcheur : achat (jour des courses) + fraisJours dépassé.
export const fraicheur = (recette: Recette, achat: string, cible: string): string[] =>
  recette.ingredients
    .filter((i) => i.fraisJours != null && ajouterJours(achat, i.fraisJours) < cible)
    .map((i) => `${i.nom} : à congeler ce soir`);

// Courses de la semaine : ingrédients des plats arrivés d'une autre semaine
// (déjà achetés), à proposer barrés « déjà au frigo ? ».
export const ingredientsAuFrigo = (cycle: Cycle, semaine: number, reports: Report[]): Ingredient[] =>
  reports.flatMap((r) => {
    if (r.vers === 'abandon' || r.vers.semaine !== semaine || LETTRES.indexOf(lire(r.repas).lettre) === semaine) return [];
    return trouverRecette(cycle, repasDe(cycle, r.repas)?.recette)?.ingredients.filter((i) => !i.placard) ?? [];
  });
