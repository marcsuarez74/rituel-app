import { cleIngredient } from './courses';
import { normaliseComplement, nouvelIdProfil, type UserProfile } from '../model';
import type { JourType, Membre, ReglagesFoyer } from './etat';
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

// Partenaire saisi·e à l'inscription : adulte sans téléphone, non suivi·e
// tant qu'il/elle n'a pas rejoint le foyer avec son propre profil.
export const ajouterAdulte = (f: ReglagesFoyer, prenom: string, alea?: () => string): ReglagesFoyer => {
  const p = prenom.trim();
  if (!p) return f;
  const id = nouvelIdProfil(p, alea);
  return surChaqueJour(
    { ...f, membres: [...f.membres, { id, prenom: p, type: 'adulte', suivi: false }] },
    (j) => ({ ...j, dejeuner: { ...j.dejeuner, [id]: 'maison' } }),
  );
};

// Un téléphone qui rejoint un foyer : qui est-il ? (spec 2026-10-07 §3)
export type Rattachement =
  | { etat: 'deja' } // mon profil est déjà membre
  | { etat: 'auto'; membre: Membre } // un adulte sans téléphone porte mon prénom
  | { etat: 'question'; candidats: Membre[] } // « Es-tu X ? »
  | { etat: 'nouveau' }; // personne en attente : je m'ajoute

export const rattacher = (f: ReglagesFoyer, profil: UserProfile): Rattachement => {
  if (f.membres.some((m) => m.id === profil.id)) return { etat: 'deja' };
  const libres = f.membres.filter((m) => m.type === 'adulte' && !m.telephone);
  const moi = normaliseComplement(profil.prenom ?? '');
  const membre = moi ? libres.find((m) => normaliseComplement(m.prenom) === moi) : undefined;
  if (membre) return { etat: 'auto', membre };
  return libres.length ? { etat: 'question', candidats: libres } : { etat: 'nouveau' };
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
