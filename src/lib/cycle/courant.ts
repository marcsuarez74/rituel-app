import type { CycleActif } from './etat';
import { ajouterJours, prochainJour, type PositionCycle } from './calendrier';
import type { Jour } from './types';
import { importerCycle } from './valider';

// Cycle affiché quand aucun n'est importé : le cycle d'exemple, chargé à la
// demande (chunk séparé, ~160 Ko de JSON) et gardé en mémoire seulement.

// Dernier jour des courses passé, aujourd'hui compris.
export const debutParDefaut = (aujourdhui: string, jourCourses: Jour): string =>
  prochainJour(ajouterJours(aujourdhui, -6), jourCourses);

// Semaine montrée par défaut dans Menu / Courses / Rituel.
export const semaineParDefaut = (p: PositionCycle): number =>
  p.etat === 'semaine' ? p.index : p.etat === 'pause' ? p.apres : p.etat === 'termine' ? 3 : 0;

export const chargerCycleExemple = async (aujourdhui: string, jourCourses: Jour): Promise<CycleActif> => {
  const { default: contenu } = await import('../../assets/cycle-exemple.json?raw');
  const { cycle, erreurs } = importerCycle([{ nom: 'cycle-exemple.json', contenu }]);
  if (!cycle) throw new Error(`Cycle d'exemple invalide : ${erreurs.join(' ; ')}`);
  return { id: 'exemple', numero: 1, debut: debutParDefaut(aujourdhui, jourCourses), pauses: [], cycle };
};
