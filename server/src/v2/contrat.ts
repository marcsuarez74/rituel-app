import type { Allergene } from './ingredients.js';

// Contrat menu partagé avec l'app native (plan 2026-10-16-app-native) : chaque réponse
// le porte, l'app refuse un numéro qu'elle ne connaît pas (« mets à jour l'app »).
// À incrémenter à tout changement incompatible de la forme des menus.
export const CONTRAT = 1;

// Une semaine de menus commence le jour du Rituel : jours[0] = J0, jours[6] = J+6
// (docs/conservation.md §4). Le jour de la semaine réel vient de ProfilFoyer.jourRituel.
export const JOURS_PAR_SEMAINE = 7;
export const SEMAINES = 4;

export const MOMENTS = ['midi', 'soir'] as const;
export type Moment = (typeof MOMENTS)[number];

/**
 * box : midi préparé au Rituel, emporté ; pret : repas du Rituel réchauffé à la maison ;
 * frais : cuisiné le jour même ; dehors : pas de repas à prévoir ; libre : au choix du foyer.
 */
export const TYPES_REPAS = ['box', 'pret', 'frais', 'dehors', 'libre'] as const;
export type TypeRepas = (typeof TYPES_REPAS)[number];

export interface LigneIngredient {
  /** Id de la table d'ingrédients (ingredients.ts) ; hors table = recette rejetée. */
  id: string;
  /** Quantité pour une personne adulte, en g (unité kg), ml (unité l) ou pièces. */
  qte: number;
  /** Servi cru dans le plat (taboulé, mayonnaise) : la conservation devient plus stricte. */
  cru?: boolean;
}

export interface Recette {
  id: string;
  titre: string;
  /** rituel : cuisinée au Rituel (Box, plats prêts) ; frais : cuisinée le jour même. */
  origine: 'rituel' | 'frais';
  ingredients: LigneIngredient[];
  etapes: string[];
  /** Minutes de travail le jour du repas : préparation (frais) ou remise en température (rituel). */
  tempsJour: number;
  /** Requête courte en anglais pour la photo (spec §10.4). */
  photo: string;
  /** Id du plat dans la bibliothèque partagée (posé par le serveur) : sert à le signaler. */
  bibliotheque?: string;
}

export interface EtapeRituel {
  texte: string;
  /** Minutes pendant lesquelles l'étape occupe la personne qui cuisine. */
  duree: number;
  /** Cuisson qui continue seule à partir du début de l'étape (four, mijotage), en minutes. */
  minuteur?: number;
  /** Ids des recettes de la semaine concernées. */
  recettes: string[];
}

export interface Repas {
  type: TypeRepas;
  /** Id d'une recette de la semaine ; absent pour dehors et libre. */
  recette?: string;
}

export interface Jour {
  midi: Repas;
  soir: Repas;
}

export interface Semaine {
  recettes: Recette[];
  rituel: EtapeRituel[];
  jours: Jour[];
}

export interface Menus {
  contrat: number;
  semaines: Semaine[];
}

/** Les sept choix « À éviter » du guide (maquette Main, étape 5). */
export const EVITER = ['porc', 'fruits-a-coque', 'poisson', 'fruits-de-mer', 'champignons', 'oeufs', 'epice'] as const;
export type Eviter = (typeof EVITER)[number];

export const PERIODES_BUDGET = { semaine: 7, '15-jours': 14, mois: 30 } as const;
export type PeriodeBudget = keyof typeof PERIODES_BUDGET;

/** Ce que le guide et le compromis (maquettes Main et Resultat) fixent pour un foyer. */
export interface ProfilFoyer {
  adultes: number;
  enfants: number;
  /** 0 = lundi … 6 = dimanche. */
  jourRituel: number;
  /** Le compromis : type attendu de chaque repas, jours[0] = jour du Rituel. */
  trame: { midi: TypeRepas; soir: TypeRepas }[];
  /** Durée du Rituel choisie, en minutes. */
  tempsRituel: number;
  /** Temps de cuisine le soir, en minutes ; null = « 40 min ou plus », sans plafond. */
  tempsSoir: number | null;
  /** Régimes du guide ; flexitarien et méditerranéen n'imposent aucun contrôle. */
  regimes: string[];
  eviter: Eviter[];
  allergenes: Allergene[];
  budget: { montant: number; periode: PeriodeBudget };
}
