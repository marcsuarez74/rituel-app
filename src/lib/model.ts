export type ProfileKey = 'marc' | 'melanie';

export interface WeekMeta {
  semaine: string;
  menu: string;
  du: string;
  au: string;
  titre?: string;
}

export interface CourseItem {
  id: string;
  rayon: string;
  label: string;
  rituel?: boolean;
  note?: string;
}

export interface MenuDay {
  jour: string;
  dejeunerMarc?: string;
  dejeunerMelanie?: string;
  dinerFamille?: string;
  dinerMelanie?: string;
  batch?: string;
  recetteRefs?: Partial<Record<MealKey, string>>;
}

export interface ChecklistItem {
  id: string;
  label: string;
  ref?: string; // ref recette (batch v4) — jamais dans l'id de coche
}

export interface Recette {
  id: string;
  nom: string;
  temps?: string;
  kcal?: number;
  proteines?: number;
  glucides?: number;
  lipides?: number;
  score?: number;
  image?: string;
  pour?: string;
  bases?: string[];
  etapes?: string[];
  mel?: string;
  batch?: string;
  fraicheur?: string;
  portions?: { marc?: string; melanie?: string };
}

export interface BaseCuisine {
  id: string;
  nom: string;
  texte: string;
}

export interface RituelEtape {
  id: string;
  creneau: string;
  label: string;
  detail?: string;
}

export interface MicroBatchJour {
  jour: string;
  quoi: string;
  detail?: string; // suffixe ` | détail` — 3e ligne de la carte micro-batch
}

export interface ReserveLigne {
  cle: string; // jour (lundi..dimanche) ou « mel »
  plat: string;
  conservation: string;
}

export type MealKey = 'dejeunerMarc' | 'dejeunerMelanie' | 'dinerFamille' | 'dinerMelanie' | 'batch';

export interface ProfileData {
  cibles: string[];
  seances: ChecklistItem[];
  rappels: string[];
}

export interface WeeklyData {
  meta: WeekMeta;
  courses: CourseItem[];
  budget?: string;
  menu: MenuDay[];
  batch: ChecklistItem[];
  profiles: Record<ProfileKey, ProfileData>;
  recettes?: Recette[];
  bases?: BaseCuisine[];
  rituel?: RituelEtape[];
  microBatch?: MicroBatchJour[];
  rituelProduction?: string; // ligne `- production:` de ### Rituel dimanche
  rituelTermine?: string; // ligne `- termine:` → état final du mode guidé
  reserve?: ReserveLigne[]; // sous-section ### Réserve
}

export interface ImportedWeek {
  raw: string;
  data: WeeklyData;
  importedAt: string;
}

export interface UserProfile {
  id: ProfileKey;
  dateNaissance: string; // AAAA-MM-JJ — l'âge s'affiche calculé (ageDepuis)
  taille: number;
  poidsObjectif?: number;
  objectif: Objectif;
  complements: string[];
  regime: Regime;
  // v2.1 — Maison & courses : tout optionnel, ignoré champ par champ si illégal (storage)
  magasin?: string; // nom libre, trim (ex. « Lidl »)
  budgetMax?: number; // € / semaine (plafond)
  preferences?: string[]; // types de plats souhaités (presets + libre) — pour le prompt IA
  personnes?: number; // personnes à table (entier ≥ 1)
  repasJour?: number; // repas par jour (entier ≥ 1)
}

export interface DepenseEntry {
  date: string; // AAAA-MM-JJ
  magasin: string; // trim, non vide
  total: number; // € positif, 2 décimales max
}

// Suggestions de la saisie magasin (datalist natif) — liste ouverte, la saisie
// libre reste possible (magasin de quartier).
export const MAGASINS_PRESETS: readonly string[] = [
  'Lidl',
  'Carrefour',
  'Auchan',
  'Intermarché',
  'Grand Frais',
  'Leclerc',
  'Aldi',
  'Super U',
  'Monoprix',
  'Casino',
];

// Presets des préférences (types de plats) — onboarding étape 5.
export const PREFERENCES_PRESETS: readonly string[] = [
  'Healthy',
  'Petit budget',
  'Rapide',
  'Batch-friendly',
];

export const PRENOMS: Record<ProfileKey, string> = { marc: 'Marc', melanie: 'Mélanie' };

// ——— Profil v2 (objectif, compléments, régime) ———

export type ObjectifType = 'perte' | 'affiner' | 'masse' | 'maintien';
export type Regime = 'keto' | 'vegetarien' | 'vegan' | 'sans-gluten' | 'aucun';

export interface Objectif {
  type: ObjectifType;
  echeance?: string; // AAAA-MM-JJ, optionnelle
}

// Ancienne forme stockée avant migration — lecture seule, préremplissage only.
export interface ProfilLegacy {
  id: ProfileKey;
  age: number;
  taille: number;
  poidsObjectif?: number;
  kcalObjectif?: number; // conservé pour le type legacy, ignoré au préremplissage
}

export const OBJECTIF_TYPES: Array<{ id: ObjectifType; nom: string; desc: string; icone: 'scale' | 'flame' | 'meat' | 'target' }> = [
  { id: 'perte', nom: 'Perte de poids', desc: 'Réduire progressivement, sans yoyo', icone: 'scale' },
  { id: 'affiner', nom: 'Affiner', desc: 'Recomposition : même poids, moins de gras', icone: 'flame' },
  { id: 'masse', nom: 'Prise de masse', desc: 'Prendre du muscle, avec la mangeoire qui va bien', icone: 'meat' },
  { id: 'maintien', nom: 'Maintien', desc: 'Stabiliser ce qui est en place', icone: 'target' },
];

export const REGIMES: Array<{ id: Regime; nom: string }> = [
  { id: 'keto', nom: 'Keto' },
  { id: 'vegetarien', nom: 'Végétarien' },
  { id: 'vegan', nom: 'Vegan' },
  { id: 'sans-gluten', nom: 'Sans gluten' },
  { id: 'aucun', nom: 'Aucun' },
];

export const COMPLEMENTS_PRESETS = ['Whey', 'Créatine', 'Oméga-3', 'Collagène', 'Magnésium', 'Vitamine D'];

// Comparaison insensible casse/accents pour dédoublonner les compléments.
export const normaliseComplement = (s: string): string =>
  s.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
