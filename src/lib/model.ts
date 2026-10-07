export type ProfileKey = 'marc' | 'melanie';

export interface UserProfile {
  id: ProfileKey;
  prenom?: string; // v2.2 — prénom édité ; défaut = PROFILS_META[id].nom
  dateNaissance?: string; // v2.2 — optionnel (onboarding sautable) ; âge calculé si présent
  taille?: number; // v2.2 — optionnel (onboarding sautable)
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

// Source unique des métadonnées d'affichage des profils (cartes d'onboarding,
// titres, salutations) — fusion des anciennes constantes profils/titres/prénoms.
export const PROFILS_META: Record<ProfileKey, { nom: string; emoji: string; tagline: string }> = {
  marc: { nom: 'Marc', emoji: '💪', tagline: 'Diet & Sport' },
  melanie: { nom: 'Mélanie', emoji: '🌿', tagline: 'Keto & Sport' },
};

// Prénom affiché : le prénom édité (profil v2.2) sinon le nom par défaut.
export const prenomProfil = (id: ProfileKey, p?: UserProfile): string =>
  p?.prenom?.trim() || PROFILS_META[id].nom;

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
