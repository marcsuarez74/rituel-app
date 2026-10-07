import { capitalize } from '../text';
import { jourDe } from './calendrier';
import type { Membre } from './etat';
import type { Cycle, Jour, Lettre, MembreId, MicroBatch, Moment, Recette, Repas } from './types';

// Menu de la semaine vu par un membre (spec 2026-10-07 §3, écrans 1-2).

export const jourDeDate = jourDe;

export const concerne = (r: Repas, membre: MembreId): boolean => r.pour === 'famille' || r.pour.includes(membre);

// Id de coche stable d'un repas (le report s'y réfère aussi).
export const idCocheRepas = (lettre: Lettre, jour: Jour, r: Repas): string => `menu:${lettre}:${jour}:${r.id}`;

const ORDRE: Record<Moment, number> = { dejeuner: 0, collation: 1, diner: 2 };

const menuDe = (cycle: Cycle, lettre: Lettre) => cycle.menus.find((m) => m.lettre === lettre);

export const repasDuJour = (cycle: Cycle, lettre: Lettre, jour: Jour, membre: MembreId): Repas[] =>
  (menuDe(cycle, lettre)?.jours.find((j) => j.jour === jour)?.repas ?? [])
    .filter((r) => concerne(r, membre))
    .sort((a, b) => ORDRE[a.moment] - ORDRE[b.moment]);

export const trouverRecette = (cycle: Cycle, id?: string): Recette | undefined =>
  id ? cycle.recettes.find((r) => r.id === id) : undefined;

export const titreRepas = (cycle: Cycle, r: Repas): string => trouverRecette(cycle, r.recette)?.nom ?? r.texte ?? '—';

export const compteRepasSemaine = (
  cycle: Cycle,
  lettre: Lettre,
  membre: MembreId,
  coches: Record<string, boolean>,
): { faits: number; total: number } => {
  let faits = 0;
  let total = 0;
  for (const j of menuDe(cycle, lettre)?.jours ?? [])
    for (const r of j.repas)
      if (concerne(r, membre)) {
        total++;
        if (coches[idCocheRepas(lettre, j.jour, r)]) faits++;
      }
  return { faits, total };
};

export const microBatchDuJour = (cycle: Cycle, lettre: Lettre, jour: Jour): MicroBatch[] =>
  menuDe(cycle, lettre)?.microBatch.filter((m) => m.jour === jour) ?? [];

// Recettes préparées au rituel (carte « lié au rituel » de la fiche).
export const etapesRituelDe = (cycle: Cycle, recetteId: string) =>
  cycle.rituel.etapes.filter((e) => e.recette === recetteId);

export const prenomMembre = (membres: Membre[], id: MembreId): string =>
  membres.find((m) => m.id === id)?.prenom ?? capitalize(id);
