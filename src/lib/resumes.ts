import { ageDepuis } from './dates';
import { OBJECTIF_TYPES } from './model';
import type { UserProfile } from './model';
import type { WeightEntry } from './storage';
import type { PushConfig } from './push/module';
import type { SyncEtat } from './sync/engine';

// Résumés d'état des tuiles du hub Profil (une ligne) — fonctions pures :
// l'UI (ProfilScreen) ne fait qu'afficher. KISS : pas d'abstraction.

// Nombre français « 4,2 » (virgule, sans zéro inutile) — comme le héro.
export const fmtKg = (n: number): string => n.toString().replace('.', ',');

export interface DuoEntete {
  label: string;
  ton: 'basilic' | 'danger' | 'gris';
}

// Sous-ligne de l'en-tête compte : état duo + cycle. 'off' (sans env) → null.
export const resumeDuo = (syncEtat: SyncEtat): DuoEntete | null => {
  if (syncEtat === 'sync') return { label: 'Duo connecté', ton: 'basilic' };
  if (syncEtat === 'attente' || syncEtat === 'erreur') return { label: 'Duo ⟳', ton: 'danger' };
  if (syncEtat === 'hors-foyer') return { label: 'Local', ton: 'gris' };
  return null; // 'off' : sans env — chip masquée
};

// Tuile Objectif : « Perte de poids · 4,2 kg restants » (sens auto des données :
// cible au-dessus de l'actuel = à prendre). Sans cible ni pesée : le type seul.
export const resumeObjectif = (
  profile: UserProfile,
  pesee: WeightEntry | null,
): string => {
  const nom = OBJECTIF_TYPES.find((t) => t.id === profile.objectif.type)?.nom ?? profile.objectif.type;
  const cible = profile.poidsObjectif;
  if (cible == null || !pesee) return nom;
  const restant = Math.round((pesee.kg - cible) * 10) / 10;
  return `${nom} · ${fmtKg(Math.abs(restant))} kg ${restant > 0 ? 'restants' : 'à prendre'}`;
};

// Tuile Mes infos : seuls les champs remplis (ageDepuis calcule, rien de manuel).
export const resumeInfos = (profile: UserProfile): string => {
  const champs: string[] = [];
  if (profile.dateNaissance) champs.push(`${ageDepuis(profile.dateNaissance)} ans`);
  if (profile.taille != null) champs.push(`${profile.taille} cm`);
  return champs.length > 0 ? champs.join(' · ') : '—';
};

// Tuile Maison & courses : magasin, budget, personnes — pill compacte.
export const resumeMaison = (profile: UserProfile): string => {
  const champs: string[] = [];
  if (profile.magasin) champs.push(profile.magasin);
  if (profile.budgetMax != null) champs.push(`${profile.budgetMax} €`);
  if (profile.personnes != null) champs.push(`${profile.personnes} pers.`);
  return champs.length > 0 ? champs.join(' · ') : '—';
};

// Tuile Notifications : événements activés + rappels (pluriel sur rappel).
export const resumeNotifications = (config: PushConfig): string => {
  const evts = [config.evenements.diner, config.evenements.pesee, config.evenements.courses].filter(Boolean).length;
  const rappels = config.rappels.length;
  if (evts === 0 && rappels === 0) return '—';
  return `${evts} évts · ${rappels} rappel${rappels > 1 ? 's' : ''}`;
};
