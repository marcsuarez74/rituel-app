// Réponses de l'étape 1 de l'onboarding (spec 2026-10-07 §2).
export type PourQui = 'moi' | 'deux' | 'famille';

export interface SaisieFoyer {
  prenom: string;
  pourQui: PourQui;
  partenaire: string;
  enfants: string[];
  suivi: boolean;
}

// « Juste la routine » par défaut : rien d'imposé à l'inscription.
export const SAISIE_VIDE: SaisieFoyer = { prenom: '', pourQui: 'moi', partenaire: '', enfants: [], suivi: false };
