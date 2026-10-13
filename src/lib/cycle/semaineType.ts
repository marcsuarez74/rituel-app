import type { JourType, ReglagesFoyer } from './etat';
import { JOURS, type Jour } from './types';

// Option B (spec refonte §6) : diff entre la semaine type ACTUELLE du foyer et
// l'instantané pris au lancement des menus (CycleActif.semaineAuLancement).
// L'instantané est une donnée passive potentiellement vieille ou corrompue :
// illisible → aucun changement signalé, jamais un crash.

const DEJEUNERS = new Set(['box', 'maison', 'dehors']);
const DINERS = new Set(['famille', 'rapide', 'leger']);

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const jourTypeFiable = (v: unknown): boolean => {
  if (!estObjet(v)) return false;
  if (!estObjet(v.dejeuner) || Object.values(v.dejeuner).some((x) => typeof x !== 'string' || !DEJEUNERS.has(x))) {
    return false;
  }
  return (
    typeof v.diner === 'string' &&
    DINERS.has(v.diner) &&
    Array.isArray(v.plusTard) &&
    v.plusTard.every((x) => typeof x === 'string')
  );
};

const instantaneFiable = (v: unknown): Record<Jour, JourType> | null => {
  if (!estObjet(v) || JOURS.some((j) => !jourTypeFiable(v[j]))) return null;
  return v as Record<Jour, JourType>;
};

// Comparaison champ par champ, insensible à l'ordre des clés (les données
// viennent de localStorage, de la sync, ou d'anciennes versions).
const trie = (o: Record<string, unknown>): [string, unknown][] =>
  Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1));

const canon = (t: JourType): string =>
  JSON.stringify([trie(t.dejeuner ?? {}), t.diner, [...(t.plusTard ?? [])].sort(), trie(t.journee ?? {}), t.note ?? '']);

export const changementsEnAttente = (foyer: ReglagesFoyer, instantane: unknown): Jour[] => {
  const ref = instantaneFiable(instantane);
  if (!ref) return [];
  return JOURS.filter((j) => canon(foyer.semaine[j]) !== canon(ref[j]));
};
