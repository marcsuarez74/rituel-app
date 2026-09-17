import template from '../assets/prompt-cycle-template.md?raw';
import { ageDepuis, formatDayMonth } from './dates';
import { PRENOMS, type ObjectifType, type UserProfile } from './model';
import { formatEuro } from './prix';
import type { WeightEntry } from './storage';

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

// Formulations orientées prompt (décidées hors libellés d'app).
const OBJECTIFS_PROMPT: Record<ObjectifType, string> = {
  perte: 'perdre du poids',
  affiner: 'affiner la silhouette',
  masse: 'prendre de la masse',
  maintien: 'maintenir le poids',
};

// 82.4 -> « 82,4 » (nombre à la française, sans unité).
const fmtKg = (kg: number): string => kg.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

// '2027-03-01' -> « mars 2027 » (split, jamais de new Date sur une date seule).
const formatMoisAnnee = (iso: string): string => {
  const [y, m] = iso.split('-');
  return `${MOIS[Number(m) - 1] ?? ''} ${y}`.trim();
};

const objectifPhrase = (p: UserProfile): string => {
  const cible = p.poidsObjectif != null ? ` vers ${fmtKg(p.poidsObjectif)} kg` : '';
  const echeance = p.objectif.echeance ? ` d'ici ${formatMoisAnnee(p.objectif.echeance)}` : '';
  return `${OBJECTIFS_PROMPT[p.objectif.type]}${cible}${echeance}`;
};

const ouverture = (p: UserProfile, dernierPoids: WeightEntry | null): string => {
  const perso = dernierPoids
    ? `${PRENOMS[p.id]} (${ageDepuis(p.dateNaissance)} ans, ${fmtKg(dernierPoids.kg)} kg — dernière pesée du ${formatDayMonth(dernierPoids.date)}, ${p.taille} cm)`
    : `${PRENOMS[p.id]} (${ageDepuis(p.dateNaissance)} ans, ${p.taille} cm)`;
  return `Tu es un nutritionniste. ${perso} te demande de lui réaliser une rotation de menus sur 4 semaines pour installer une routine durable. Objectif : ${objectifPhrase(p)}.`;
};

// Une ligne par donnée présente ; ligne omise si le champ ne l'est pas.
// Renvoie '' si aucune donnée maison (pas de titre orphelin dans le prompt).
const contexte = (p: UserProfile): string => {
  const lignes: string[] = [];
  if (p.regime !== 'aucun') lignes.push(`- Régime particulier : ${p.regime}`);
  if (p.complements.length > 0) lignes.push(`- Compléments : ${p.complements.join(', ')}`);
  if (p.magasin && p.budgetMax != null) {
    lignes.push(`- Courses : ${p.magasin}, budget ${formatEuro(p.budgetMax)}/semaine`);
  } else if (p.magasin) {
    lignes.push(`- Courses : ${p.magasin}`);
  } else if (p.budgetMax != null) {
    lignes.push(`- Budget : ${formatEuro(p.budgetMax)}/semaine`);
  }
  if (p.personnes != null || p.repasJour != null) {
    const parties: string[] = [];
    if (p.personnes != null) parties.push(`${p.personnes}`);
    if (p.repasJour != null) parties.push(`${p.repasJour} repas/jour`);
    lignes.push(`- Personnes à table : ${parties.join(' · ')}`);
  }
  if (p.preferences && p.preferences.length > 0) {
    lignes.push(`- Préférences : ${p.preferences.map((x) => x.toLowerCase()).join(', ')}`);
  }
  if (lignes.length === 0) return '';
  return `Son contexte :\n${lignes.join('\n')}`;
};

// Assemble le prompt maître : ouverture + contexte perso remplis ; les 3
// placeholders de chat (semaine de départ, menus, événements) restent à éditer.
export const assemblePromptIa = (profil: UserProfile, dernierPoids: WeightEntry | null): string =>
  template.replace('{{OUVERTURE}}', ouverture(profil, dernierPoids)).replace('{{CONTEXTE}}', contexte(profil));
