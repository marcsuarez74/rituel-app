import { cleIngredient } from './courses';
import type { JourType, ReglagesFoyer } from './etat';
import type { Jour, MembreId } from './types';
import { JOURS } from './types';

// Édition des réglages du foyer (écran Semaine type) : fonctions pures.

const surChaqueJour = (f: ReglagesFoyer, maj: (j: JourType) => JourType): ReglagesFoyer => ({
  ...f,
  semaine: Object.fromEntries(JOURS.map((j) => [j, maj(f.semaine[j])])) as Record<Jour, JourType>,
});

export const ajouterEnfant = (f: ReglagesFoyer, prenom: string): ReglagesFoyer => {
  const p = prenom.trim();
  const id = cleIngredient(p);
  if (!p || !id || f.membres.some((m) => m.id === id)) return f;
  return surChaqueJour(
    { ...f, membres: [...f.membres, { id, prenom: p, type: 'enfant', suivi: false }] },
    (j) => ({ ...j, dejeuner: { ...j.dejeuner, [id]: 'dehors' } }),
  );
};

export const retirerMembre = (f: ReglagesFoyer, id: MembreId): ReglagesFoyer =>
  surChaqueJour({ ...f, membres: f.membres.filter((m) => m.id !== id) }, (j) => {
    const sans = <T,>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== id));
    return { ...j, dejeuner: sans(j.dejeuner), plusTard: j.plusTard.filter((x) => x !== id), journee: sans(j.journee ?? {}) };
  });

export const changerJour = (f: ReglagesFoyer, jour: Jour, maj: Partial<JourType>): ReglagesFoyer => ({
  ...f,
  semaine: { ...f.semaine, [jour]: { ...f.semaine[jour], ...maj } },
});

export const resumeJour = (f: ReglagesFoyer, jour: Jour): string => {
  const j = f.semaine[jour];
  const box = Object.values(j.dejeuner).filter((v) => v === 'box').length;
  return [`dîner ${j.diner}`, box ? `${box} box` : '', j.plusTard.length ? `${j.plusTard.length} plus tard` : '']
    .filter(Boolean)
    .join(' · ');
};
