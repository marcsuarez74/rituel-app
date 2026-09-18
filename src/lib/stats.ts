import type { MenuDay, Recette } from './model';
import { todayKey } from './dates';
import type { WeightEntry } from './storage';

const JOUR_MS = 86_400_000;
const time = (iso: string): number => new Date(`${iso}T00:00:00`).getTime();

export const poidsActuel = (weights: WeightEntry[]): WeightEntry | null =>
  weights.length > 0 ? weights[weights.length - 1] : null;

// Écart en kg vs la pesée la plus proche de J-7 (fenêtre 14 jours max), null sinon.
export const variationKg7j = (weights: WeightEntry[]): number | null => {
  if (weights.length < 2) return null;
  const last = weights[weights.length - 1];
  const lastTime = time(last.date);
  const cible = lastTime - 7 * JOUR_MS;
  const prev = weights.slice(0, -1).reduce(
    (best, w) => {
      const d = Math.abs(time(w.date) - cible);
      return d < best.d ? { w, d } : best;
    },
    { w: weights[0], d: Number.POSITIVE_INFINITY },
  );
  if (lastTime - time(prev.w.date) > 14 * JOUR_MS) return null;
  return last.kg - prev.w.kg;
};

// égalité exacte d'abord, puis préfixe borné (`r1` ne doit pas matcher `r10-…`)
export const recetteParRef = (ref: string, recettes: Recette[]): Recette | undefined => {
  const cible = ref.toLowerCase();
  return recettes.find((r) => r.id === cible) ?? recettes.find((r) => r.id.startsWith(`${cible}-`));
};

// Le jour du menu correspondant à aujourd'hui (trim + casse ignorés), undefined sinon.
export const trouverJourDuJour = (menu: MenuDay[]): MenuDay | undefined =>
  menu.find((d) => d.jour.trim().toLowerCase() === todayKey());

export interface CompteChecklist {
  faites: number;
  total: number;
}

export const compteChecklist = (
  checks: Record<string, boolean>,
  items: Array<{ id: string }>,
): CompteChecklist => ({
  faites: items.filter((i) => checks[i.id]).length,
  total: items.length,
});

// Progression perte/masse (carte héro) : départ = 1re pesée, actuel = dernière.
// Arrondi au dixième : 4,4/8,8 en flottant donnerait 49,999… % sans lui.
export function progressionPoids(
  type: 'perte' | 'masse',
  depart: number,
  actuel: number,
  cible: number,
): { pct: number; kgRestant: number; sens: string } | null {
  const total = type === 'perte' ? depart - cible : cible - depart;
  if (total <= 0) return null;
  const fait = type === 'perte' ? depart - actuel : actuel - depart;
  const pct = Math.min(100, Math.max(0, Math.round((fait / total) * 1000) / 10));
  const kgRestant = Math.round((type === 'perte' ? actuel - cible : cible - actuel) * 10) / 10;
  return { pct, kgRestant, sens: type === 'perte' ? 'restants' : 'à prendre' };
}
