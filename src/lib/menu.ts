import type { MealKey, MenuDay, Recette } from './model';
import { recetteParRef } from './stats';

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

const occurrence = (day: MenuDay, cle: MealKey, recettes: Recette[]): Occurrence | null => {
  const texte = day[cle];
  if (!texte) return null;
  const meta = MEALS[cle];
  const ref = day.recetteRefs?.[cle];
  return {
    id: `menu:${day.jour.trim().toLowerCase()}:${cle}`,
    jour: day.jour,
    cle,
    tag: meta[0],
    tagClass: meta[1],
    texte,
    ...(ref ? { ref, recette: recetteParRef(ref, recettes) } : {}),
  };
};

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
      label: labelCourt(recette?.nom ?? base.texte),
      ...(diner && { diner }),
      ...(mel && { mel }),
      ...(batch && { batch }),
      ...(recette && { recette }),
    });
  }
  return onglets;
}
