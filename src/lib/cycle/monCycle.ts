import { positionCycle, prochainJour } from './calendrier';
import type { CycleActif } from './etat';
import type { Cycle, Jour } from './types';

// Écran Mon cycle (spec 2026-10-07 §7) : verrou, démarrage, relance, pause.
// Les ids sont passés (crypto.randomUUID côté UI) : fonctions pures.

// Un nouveau cycle se génère sans cycle importé, ou une fois le cycle fini.
export const generationOuverte = (stocke: CycleActif | null, aujourdhui: string): boolean =>
  !stocke || positionCycle(stocke, aujourdhui).etat === 'termine';

export const demarrer = (cycle: Cycle, precedent: CycleActif | null, debut: string, id: string): CycleActif => ({
  id,
  numero: (precedent?.numero ?? 0) + 1,
  debut,
  pauses: [],
  cycle,
});

export const relancer = (a: CycleActif, aujourdhui: string, jourCourses: Jour, id: string): CycleActif => ({
  ...demarrer(a.cycle, a, prochainJour(aujourdhui, jourCourses), id),
  relanceDe: a.id,
});

export const ajouterPause = (a: CycleActif, apres: number): CycleActif =>
  a.pauses.includes(apres) ? a : { ...a, pauses: [...a.pauses, apres].sort() };

// Texte à recoller dans la même conversation pour que Claude corrige.
export const messagePourClaude = (erreurs: string[], alertes: string[]): string =>
  [
    erreurs.length
      ? "L'application a refusé l'import de tes fichiers. Corrige ces points :"
      : "L'import est passé avec ces alertes. Corrige-les si c'est possible sans trahir les règles :",
    ...erreurs.map((e) => `- ${e}`),
    ...(erreurs.length && alertes.length ? ['', 'Alertes (à corriger si possible) :'] : []),
    ...alertes.map((a) => `- ${a}`),
    '',
    'Renvoie uniquement les fichiers corrigés, au même format.',
  ].join('\n');
