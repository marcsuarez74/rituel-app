import { cleIngredient } from './courses';
import { trouverRecette } from './menu';
import type { Cycle, EtapeRituel, Lettre } from './types';

// Rituel batch (spec 2026-10-07 §3, écrans 5-6). Coches stockées par semaine
// du cycle (cycle:{id}:{n}) : relancer le cycle repart de coches vides.

export const idCocheRituel = (lettre: Lettre, etapeId: string) => `rituel:${lettre}:${etapeId}`;
export const idCocheMise = (lettre: Lettre, n: number) => `mise:${lettre}:${n}`;
export const idCocheMicro = (lettre: Lettre, microId: string) => `micro:${lettre}:${microId}`;
export const idCocheReserve = (lettre: Lettre, plat: string) => `reserve:${lettre}:${cleIngredient(plat)}`;

// Sous-étapes du mode guidé : celles de l'étape, sinon les étapes de la
// recette liée (la fiche reste accessible pour le détail).
export const sousEtapes = (cycle: Cycle, e: EtapeRituel): string[] =>
  e.sousEtapes ?? trouverRecette(cycle, e.recette)?.etapes.map((x) => x.texte) ?? [];
