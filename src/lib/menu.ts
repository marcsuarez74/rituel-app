import type { MealKey, MenuDay, Recette } from './model';
import { recetteParRef, trouverJourDuJour } from './stats';

// Tags de profil par clé repas (identiques à l'ancienne MenuView).
// Record clé par clé : exhaustivité garantie par le compilateur.
const MEALS: Record<MealKey, [string, string]> = {
  dejeunerMarc: ['Marc', 'tag-marc'],
  dejeunerMelanie: ['Mél', 'tag-mel'],
  dinerFamille: ['Famille', 'tag-fam'],
  dinerMelanie: ['Mél', 'tag-mel'],
  batch: ['Batch', 'tag-bat'],
};

export interface Occurrence {
  id: string;
  jour: string;
  cle: MealKey;
  tag: string;
  tagClass: string;
  texte: string;
  ref?: string;
  recette?: Recette;
}

// Id de coche d'une ligne menu : jour trim + minuscule (contrat stable).
const idCoche = (jour: string, cle: string): string =>
  `menu:${jour.trim().toLowerCase()}:${cle}`;

const occurrence = (day: MenuDay, cle: MealKey, recettes: Recette[]): Occurrence | null => {
  const texte = day[cle];
  if (!texte) return null;
  const meta = MEALS[cle];
  const ref = day.recetteRefs?.[cle];
  return {
    id: idCoche(day.jour, cle),
    jour: day.jour,
    cle,
    tag: meta[0],
    tagClass: meta[1],
    texte,
    ...(ref ? { ref, recette: recetteParRef(ref, recettes) } : {}),
  };
};

// Convention .md : les titres de recettes embarquent leur ref (« R1 · Nom »).
// On la retire avant labelCourt pour que les pills restent lisibles.
export const nomCourt = (nom: string): string =>
  labelCourt(nom.replace(/^[A-Za-z]{1,3}\d{1,3}\s*·\s*/, ''));

// Nom court pour une pill : premier segment avant [+·—], tronqué sur une borne
// de mot (espace ou tiret) à ~18 caractères.
export const labelCourt = (texte: string): string => {
  const segment = (texte.split(/\s*[+·—]\s*/)[0] ?? texte).trim();
  if (segment.length <= 18) return segment;
  const coupe = segment.slice(0, 18);
  const borne = Math.max(coupe.lastIndexOf(' '), coupe.lastIndexOf('-'));
  return (borne > 6 ? coupe.slice(0, borne) : segment.slice(0, 15)) + '…';
};

export interface OngletDiner {
  jour: string;
  cleCoche: string; // id de coche du dîner (dinerFamille, repli dinerMelanie)
  label: string;
  diner?: Occurrence;
  mel?: Occurrence;
  batch?: Occurrence;
  recette?: Recette;
}

export function construireOnglets(menu: MenuDay[], recettes: Recette[]): OngletDiner[] {
  const onglets: OngletDiner[] = [];
  for (const day of menu) {
    const diner = occurrence(day, 'dinerFamille', recettes) ?? undefined;
    const mel = occurrence(day, 'dinerMelanie', recettes) ?? undefined;
    const batch = occurrence(day, 'batch', recettes) ?? undefined;
    if (!diner && !mel) continue;
    const recette = diner?.recette ?? mel?.recette;
    const base = diner ?? mel!;
    onglets.push({
      jour: day.jour,
      cleCoche: base.id,
      label: recette ? nomCourt(recette.nom) : labelCourt(base.texte),
      ...(diner && { diner }),
      ...(mel && { mel }),
      ...(batch && { batch }),
      ...(recette && { recette }),
    });
  }
  return onglets;
}

export interface PaireDejeuners {
  jour: string;
  ids: string[]; // toutes les clés déjeuner présentes ce jour
  lignes: Occurrence[];
}

export function construirePaires(menu: MenuDay[], recettes: Recette[]): PaireDejeuners[] {
  const paires: PaireDejeuners[] = [];
  for (const day of menu) {
    const lignes = [
      occurrence(day, 'dejeunerMarc', recettes),
      occurrence(day, 'dejeunerMelanie', recettes),
    ].filter((o): o is Occurrence => o !== null);
    if (lignes.length === 0) continue;
    paires.push({ jour: day.jour, ids: lignes.map((l) => l.id), lignes });
  }
  return paires;
}

// ref de recette → ids de coches « dîner » qui la réalisent (dinerFamille OU
// dinerMelanie). Les refs déjeuner sont les consommatrices, jamais les sources.
export const faitsParRecette = (menu: MenuDay[]): Record<string, string[]> => {
  const out: Record<string, string[]> = {};
  for (const day of menu) {
    for (const cle of ['dinerFamille', 'dinerMelanie'] as const) {
      const ref = day.recetteRefs?.[cle];
      if (!ref) continue;
      (out[ref] ??= []).push(idCoche(day.jour, cle));
    }
  }
  return out;
};

export const pairePrete = (
  paire: PaireDejeuners,
  checks: Record<string, boolean>,
  faits: Record<string, string[]>,
): boolean => paire.lignes.every((l) => !l.ref || (faits[l.ref] ?? []).some((id) => checks[id]));

export const paireFaite = (paire: PaireDejeuners, checks: Record<string, boolean>): boolean =>
  paire.ids.every((id) => checks[id]);

// Nom court de la recette qui bloque la paire (« débloquée quand … est fait »),
// null si déjà prête. Une ref cassée retombe sur la ref brute.
export const debloquePar = (
  paire: PaireDejeuners,
  checks: Record<string, boolean>,
  faits: Record<string, string[]>,
): string | null => {
  const bloque = paire.lignes.find(
    (l) => l.ref && !(faits[l.ref] ?? []).some((id) => checks[id]),
  );
  if (!bloque?.ref) return null;
  return bloque.recette ? nomCourt(bloque.recette.nom) : bloque.ref;
};

// Onglet ouvert à l'arrivée : celui du jour courant (le jour n'est jamais
// affiché), repli = premier onglet non fait, dernier repli = le premier.
// Précondition d'appelant : onglets vide → 0 (garder, ex. `onglets[actif] &&`).
export const selectionInitiale = (
  onglets: OngletDiner[],
  menu: MenuDay[],
  checks: Record<string, boolean>,
): number => {
  const jourDuJour = trouverJourDuJour(menu)?.jour.trim().toLowerCase();
  const idxJour = onglets.findIndex((o) => o.jour.trim().toLowerCase() === jourDuJour);
  if (idxJour >= 0) return idxJour;
  const idxLibre = onglets.findIndex((o) => !checks[o.cleCoche]);
  return idxLibre >= 0 ? idxLibre : 0;
};
