// Contrat du cycle v2 (spec 2026-10-07 §5) : le JSON décrit 4 menus SANS dates
// (l'app calcule le calendrier) et UN rituel batch commun aux 4 semaines.
// Généré par Claude (prompt maître), un fichier par menu, fusionnés à l'import.

export type MembreId = string;

export type Jour = 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi' | 'samedi' | 'dimanche';
export const JOURS: readonly Jour[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

export type Lettre = 'A' | 'B' | 'C' | 'D';
export const LETTRES: readonly Lettre[] = ['A', 'B', 'C', 'D'];

export type Rayon =
  | 'proteines'
  | 'laitiers'
  | 'feculents'
  | 'legumes'
  | 'fruits'
  | 'epicerie'
  | 'surgeles'
  | 'keto';
export const RAYONS: readonly Rayon[] = [
  'proteines',
  'laitiers',
  'feculents',
  'legumes',
  'fruits',
  'epicerie',
  'surgeles',
  'keto',
];

export type Unite = 'g' | 'kg' | 'ml' | 'l' | 'piece' | 'cs' | 'cc' | 'boite' | 'sachet' | 'botte';
export const UNITES: readonly Unite[] = ['g', 'kg', 'ml', 'l', 'piece', 'cs', 'cc', 'boite', 'sachet', 'botte'];

export type Moment = 'dejeuner' | 'diner' | 'collation';
export const MOMENTS: readonly Moment[] = ['dejeuner', 'diner', 'collation'];

export type Difficulte = 'facile' | 'moyen' | 'exigeant';
export const DIFFICULTES: readonly Difficulte[] = ['facile', 'moyen', 'exigeant'];

export interface Macros {
  kcal: number;
  proteines: number;
  glucides: number; // nets pour un membre keto
  lipides: number;
}

export interface Ingredient {
  nom: string;
  quantite: number;
  unite: Unite;
  rayon: Rayon;
  prixEstime: number; // € pour cette quantité
  fraisJours?: number; // durée de vie après achat
  placard?: boolean; // huile, épices… : hors estimé, liste « à vérifier au placard »
}

export interface Etape {
  texte: string;
  minuteurMin?: number;
}

export interface Recette {
  id: string;
  nom: string;
  difficulte: Difficulte;
  tempsMin: number;
  tempsActifMin?: number;
  ingredients: Ingredient[];
  portions: Record<MembreId, string>;
  variantes?: Record<MembreId, string>;
  macros: Record<MembreId, Macros>;
  etapes: Etape[];
  conservation: { frigoJours: number; congelable: boolean; rechauffage: string };
  notes?: string[];
}

export type Pour = MembreId[] | 'famille';

export interface Exception {
  quand: string;
  pour: MembreId[];
  texte: string;
}

export interface Repas {
  id: string;
  moment: Moment;
  pour: Pour;
  recette?: string;
  texte?: string;
  boite?: { produitePar: string; frigoJours: number };
  exception?: Exception;
}

export interface JourMenu {
  jour: Jour;
  repas: Repas[];
}

export interface EtapeRituel {
  id: string;
  creneau: string;
  label: string;
  detail: string;
  recette?: string;
  sousEtapes?: string[];
  enParallele?: string;
  minuteurMin?: number;
}

export interface Rituel {
  dureeMin: number;
  production: string[];
  avantDeCommencer: { nom: string; quantite: string }[];
  etapes: EtapeRituel[];
  termine: string;
}

export interface MicroBatch {
  id: string;
  jour: Jour;
  quoi: string;
  dureeMin: number;
  quantite?: string;
  recette?: string;
  detail?: string;
}

export interface Reserve {
  pour: string; // jour ou membre
  plat: string;
  conservation: string;
  produitPar?: string;
}

export interface MenuSemaine {
  lettre: Lettre;
  titre: string;
  jours: JourMenu[];
  rappelsRituel?: string[];
  microBatch: MicroBatch[];
  reserve: Reserve[];
}

export interface ArticleFixe {
  nom: string;
  quantite: number;
  unite: Unite;
  rayon: Rayon;
  prixEstime: number;
  pour: Pour;
  frequence: 'hebdo' | 'mensuel';
}

// Un fichier tel que produit par Claude (menu-A.json…) — 1 à 4 menus.
export interface CycleFichier {
  format: 'rituel-cycle';
  version: 2;
  titre: string;
  rituel?: Rituel;
  menus: MenuSemaine[];
  recettes: Recette[];
  fixes?: ArticleFixe[];
  remarques?: string[];
}

// Le cycle complet après fusion : 4 menus dans l'ordre A → D, un rituel.
export interface Cycle {
  titre: string;
  rituel: Rituel;
  menus: MenuSemaine[];
  recettes: Recette[];
  fixes: ArticleFixe[];
  remarques: string[];
}
