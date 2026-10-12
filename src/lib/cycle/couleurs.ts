import type { Rituel } from './types';

// Couleur par plat (spec refonte §5.4, annexe A.2) : les plats cuisinés au
// rituel prennent la palette dans leur ordre d'apparition (couleurs
// garanties distinctes ≤ 9 plats) ; les autres recettes, une couleur par
// hachage stable de l'id. La vive habille liserés et pastilles, la claire
// passe derrière le texte (toujours --encre dessus).
export interface CouleurPlat {
  vive: string | null;
  claire: string | null;
}

export const PALETTE_PLATS: ReadonlyArray<{ vive: string; claire: string }> = [
  { vive: '#e3b505', claire: '#fbeeb0' }, // 1 · curry
  { vive: '#b8336a', claire: '#f6d3e1' }, // 2 · lentilles
  { vive: '#d63a2a', claire: '#f9d3cc' }, // 3 · chili
  { vive: '#ee7d1a', claire: '#fde0c2' }, // 4 · soupe
  { vive: '#9a6a3a', claire: '#ecdcc8' }, // 5 · poulet
  { vive: '#2fa58a', claire: '#cdeee4' }, // 6 · taboulé
  { vive: '#5a9a2c', claire: '#dcefc9' }, // 7 · pesto
  { vive: '#8a7a62', claire: '#e8e1d4' }, // 8 · omelette
  { vive: '#4f9fd6', claire: '#d6ebf8' }, // 9 · tartines
];

// ÉtapeRituel gagne un champ `plats` avec le contrat §5.5 ; lu dès maintenant
// (champ inconnu toléré) pour garder une même couleur quand il arrivera.
type EtapeAvecPlats = { recette?: string; plats?: readonly string[] };

// Les plats cuisinés au rituel, dans leur ordre d'apparition, sans doublon.
export function platsDuRituel(rituel: Rituel): string[] {
  const ordre: string[] = [];
  for (const etape of rituel.etapes) {
    const { recette, plats } = etape as EtapeAvecPlats;
    for (const id of [recette, ...(plats ?? [])]) {
      if (id && !ordre.includes(id)) ordre.push(id);
    }
  }
  return ordre;
}

const hachage = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
};

export function couleurPlat(recetteId: string | null | undefined, rituel: Rituel): CouleurPlat {
  if (!recetteId) return { vive: null, claire: null };
  const rang = platsDuRituel(rituel).indexOf(recetteId);
  const index = rang >= 0 ? rang : hachage(recetteId) % PALETTE_PLATS.length;
  return PALETTE_PLATS[index % PALETTE_PLATS.length];
}
