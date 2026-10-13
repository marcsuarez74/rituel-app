import { ajouterJours, jourDe, positionCycle, prochainJour } from './calendrier';
import type { CycleActif, JourType, ReglagesFoyer } from './etat';
import type { Cycle, Jour } from './types';
import { JOURS } from './types';

// Écran Mon cycle (spec 2026-10-07 §7) : verrou, démarrage, relance, pause.
// Les ids sont passés (crypto.randomUUID côté UI) : fonctions pures.

// Un nouveau cycle se génère sans cycle importé, ou une fois le cycle fini.
export const generationOuverte = (stocke: CycleActif | null, aujourdhui: string): boolean =>
  !stocke || positionCycle(stocke, aujourdhui).etat === 'termine';

export const demarrer = (
  cycle: Cycle,
  precedent: CycleActif | null,
  debut: string,
  id: string,
  semaine?: Record<Jour, JourType>,
): CycleActif => ({
  id,
  numero: (precedent?.numero ?? 0) + 1,
  debut,
  pauses: [],
  cycle,
  ...(semaine ? { semaineAuLancement: { ...semaine } } : {}),
});

export const relancer = (
  a: CycleActif,
  aujourdhui: string,
  jourCourses: Jour,
  id: string,
  semaine?: Record<Jour, JourType>,
): CycleActif => ({
  ...demarrer(a.cycle, a, prochainJour(aujourdhui, jourCourses), id, semaine),
  relanceDe: a.id,
});

// Le jour des courses a changé alors que des menus sont en cours : le début
// se recale au même rang de semaine (décalé en avant jusqu'au nouveau jour).
// Un cycle terminé n'est pas touché (la relance choisira le bon jour).
export const recaleJourCourses = (
  nouveau: ReglagesFoyer,
  ancien: ReglagesFoyer,
  actif: CycleActif | null,
  aujourdhui: string,
): { foyer: ReglagesFoyer; actif: CycleActif | null } => {
  if (!actif || nouveau.jourCourses === ancien.jourCourses) return { foyer: nouveau, actif };
  if (positionCycle(actif, aujourdhui).etat === 'termine') return { foyer: nouveau, actif };
  const delta = (JOURS.indexOf(nouveau.jourCourses) - JOURS.indexOf(jourDe(actif.debut)) + 7) % 7;
  return changerDebut(actif, nouveau, ajouterJours(actif.debut, delta));
};

// Date de début corrigée à tout moment (passé autorisé : « courses faites
// samedi dernier »). Le jour des courses du foyer suit, sinon les jours du
// menu seraient décalés. Les coches (par semaine du cycle) restent.
export const changerDebut = (
  a: CycleActif,
  f: ReglagesFoyer,
  debut: string,
): { actif: CycleActif; foyer: ReglagesFoyer } => ({
  actif: { ...a, debut },
  foyer: f.jourCourses === jourDe(debut) ? f : { ...f, jourCourses: jourDe(debut) },
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
