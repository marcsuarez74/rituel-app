import type { Jour, Lettre } from './types';
import { JOURS, LETTRES } from './types';

// Calendrier du cycle (spec 2026-10-07 §7) : le JSON n'a pas de dates, l'app
// les déduit du début (jour des courses de la semaine 1) et des pauses.
// Dates ISO `AAAA-MM-JJ` manipulées en UTC pur : pas de fuseau, pas de
// changement d'heure. `aujourdhui` est toujours passé (testable, pas d'horloge).

export interface CalendrierCycle {
  debut: string;
  pauses: number[]; // index de semaine (0-3) APRÈS lesquels une semaine de pause est insérée
}

export type PositionCycle =
  | { etat: 'avant'; debut: string }
  | { etat: 'semaine'; index: number; lettre: Lettre; du: string; au: string }
  | { etat: 'pause'; apres: number; du: string; au: string } // apres = index de la semaine qui précède
  | { etat: 'termine'; prochain: string };

const versUTC = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const versISO = (t: number): string => new Date(t).toISOString().slice(0, 10);

export const ajouterJours = (iso: string, n: number): string => versISO(versUTC(iso) + n * 86_400_000);
const ecartJours = (de: string, a: string): number => Math.round((versUTC(a) - versUTC(de)) / 86_400_000);

const jourDe = (iso: string): Jour => JOURS[(new Date(versUTC(iso)).getUTCDay() + 6) % 7];

// Prochaine occurrence d'un jour de la semaine (aujourd'hui compris).
export const prochainJour = (aujourdhui: string, jour: Jour): string =>
  ajouterJours(aujourdhui, (JOURS.indexOf(jour) - JOURS.indexOf(jourDe(aujourdhui)) + 7) % 7);

// Les 7 jours d'une semaine du cycle, à partir du jour des courses.
export const ordreJours = (depart: Jour): Jour[] => {
  const i = JOURS.indexOf(depart);
  return [...JOURS.slice(i), ...JOURS.slice(0, i)];
};

// Les créneaux de 7 jours du cycle dans l'ordre : 4 semaines + les pauses.
const creneaux = (cal: CalendrierCycle): (number | 'pause')[] =>
  LETTRES.flatMap((_, i) => (cal.pauses.includes(i) ? [i, 'pause' as const] : [i]));

const debutCreneau = (cal: CalendrierCycle, rang: number) => ajouterJours(cal.debut, rang * 7);

// Premier jour APRÈS le cycle : date à laquelle un nouveau cycle se débloque.
export const prochainCycle = (cal: CalendrierCycle): string => debutCreneau(cal, creneaux(cal).length);

export const positionCycle = (cal: CalendrierCycle, aujourdhui: string): PositionCycle => {
  const ecart = ecartJours(cal.debut, aujourdhui);
  if (ecart < 0) return { etat: 'avant', debut: cal.debut };
  const rang = Math.floor(ecart / 7);
  const c = creneaux(cal)[rang];
  if (c === undefined) return { etat: 'termine', prochain: prochainCycle(cal) };
  const du = debutCreneau(cal, rang);
  const au = ajouterJours(du, 6);
  if (c === 'pause') return { etat: 'pause', apres: creneaux(cal)[rang - 1] as number, du, au };
  return { etat: 'semaine', index: c, lettre: LETTRES[c], du, au };
};

// Premier jour (jour des courses) de la semaine `index` (0-3).
export const debutSemaine = (cal: CalendrierCycle, index: number): string =>
  debutCreneau(cal, creneaux(cal).indexOf(index));

// Date d'un jour du menu `index` (0-3), selon le jour des courses du foyer.
export const dateDuJour = (cal: CalendrierCycle, index: number, jour: Jour, jourCourses: Jour): string =>
  ajouterJours(debutSemaine(cal, index), ordreJours(jourCourses).indexOf(jour));
