import { cleIngredient } from './courses';
import { platsDuRituel } from './couleurs';
import { trouverRecette } from './menu';
import type { Cycle, EtapeRituel, Jour, Lettre, Recette, Repas, Rituel } from './types';
import { JOURS } from './types';

// Rituel batch (spec 2026-10-07 §3, écrans 5-6). Coches stockées par semaine
// du cycle (cycle:{id}:{n}) : relancer le cycle repart de coches vides.

export const idCocheRituel = (lettre: Lettre, etapeId: string) => `rituel:${lettre}:${etapeId}`;
export const idCocheMise = (lettre: Lettre, n: number) => `mise:${lettre}:${n}`;
export const idCocheMicro = (lettre: Lettre, microId: string) => `micro:${lettre}:${microId}`;
export const idCocheReserve = (lettre: Lettre, plat: string) => `reserve:${lettre}:${cleIngredient(plat)}`;

// Sous-étapes du mode guidé : celles de l'étape, sinon les étapes de la
// recette liée (la fiche reste accessible pour le détail).
export const sousEtapes = (cycle: Cycle, e: EtapeRituel): string[] =>
  e.sousEtapes ?? trouverRecette(cycle, e.recette)?.etapes.map((x) => x.texte) ?? [];

// ——— Mode guidé : étapes normalisées (spec refonte §5.4)

export interface MinuteurEtape {
  nom: string;
  minutes: number;
  recette?: string;
}

export interface EtapeGuidee {
  id: string;
  titre: string;
  plats: string[];
  gestes: string[];
  minuteurs: MinuteurEtape[];
}

/** L'étape finale est ajoutée par l'app : l'IA ne décrit jamais le rangement. */
export const ID_ETAPE_RANGE = 'on-range';

// Replis §5.5 : plats absent → [recette] si présent ; minuteurs absent →
// minuteurMin ; enParallele devient le dernier geste.
export function etapesGuidees(rituel: Rituel): EtapeGuidee[] {
  const normales = rituel.etapes.map((e): EtapeGuidee => ({
    id: e.id,
    titre: e.label,
    plats: e.plats ?? (e.recette ? [e.recette] : []),
    gestes: [...(e.sousEtapes ?? []), ...(e.enParallele ? [e.enParallele] : [])],
    minuteurs:
      e.minuteurs ??
      (e.minuteurMin != null ? [{ nom: e.label, minutes: e.minuteurMin, recette: e.recette }] : []),
  }));
  return [...normales, { id: ID_ETAPE_RANGE, titre: 'On range', plats: [], gestes: [], minuteurs: [] }];
}

// Les ids d'où peut venir une boîte du rituel : les étapes, leurs recettes et
// leurs plats (spec §5.4 « une recette cuisinée pendant le rituel »).
const productionRituel = (cycle: Cycle): Set<string> => {
  const ids = new Set<string>();
  for (const e of cycle.rituel.etapes) {
    ids.add(e.id);
    if (e.recette) ids.add(e.recette);
    for (const p of e.plats ?? []) ids.add(p);
  }
  return ids;
};

// ——— Grille de la semaine (7 jours × midi/soir, collations exclues)

export interface CelluleGrille {
  jour: Jour;
  moment: 'dejeuner' | 'diner';
  repas?: Repas;
  recetteId?: string;
  prepareDimanche: boolean;
}

export function grilleDimanche(cycle: Cycle, semaine: number): CelluleGrille[] {
  const menu = cycle.menus[semaine];
  const production = productionRituel(cycle);
  const cellules: CelluleGrille[] = [];
  for (const jour of JOURS) {
    for (const moment of ['dejeuner', 'diner'] as const) {
      const repas = menu.jours.find((j) => j.jour === jour)?.repas.find((r) => r.moment === moment);
      cellules.push({
        jour,
        moment,
        ...(repas ? { repas, recetteId: repas.recette } : {}),
        prepareDimanche: !!repas?.boite && production.has(repas.boite.produitePar),
      });
    }
  }
  return cellules;
}

// ——— Plats cuisinés dimanche + repas qu'ils couvrent

export interface PlatDuDimanche {
  recette: Recette;
  repas: Repas[];
}

export function platsDuDimanche(cycle: Cycle, semaine: number): PlatDuDimanche[] {
  const menu = cycle.menus[semaine];
  const parId = new Map(cycle.recettes.map((r) => [r.id, r]));
  const sorties: PlatDuDimanche[] = [];
  for (const id of platsDuRituel(cycle.rituel)) {
    const recette = parId.get(id);
    if (!recette) continue;
    const etapes = new Set(
      cycle.rituel.etapes.filter((e) => e.recette === id || (e.plats ?? []).includes(id)).map((e) => e.id),
    );
    const couverts = menu.jours
      .flatMap((j) => j.repas)
      .filter((r) => r.recette === id || (r.boite && etapes.has(r.boite.produitePar)));
    sorties.push({ recette, repas: [...new Map(couverts.map((r) => [r.id, r])).values()] });
  }
  return sorties;
}

// ——— Rangement (étape « On range »)

export type ZoneRangement = 'frigo' | 'congel' | 'box';

export interface RangeLigne {
  /** Clé stable du rangement (id de repas ou clé de réserve), sans préfixe. */
  id: string;
  zone: ZoneRangement;
  recetteId: string | null;
  nom: string;
  portions: number;
  /** Les repas que cette boîte couvre (une réserve n'en couvre aucun). */
  pour: Repas[];
  aMangerAvant: Date | null;
}

const plusJours = (d: Date, n: number): Date => {
  const copie = new Date(d);
  copie.setDate(copie.getDate() + n);
  return copie;
};

export function rangement(cycle: Cycle, semaine: number, dimanche: Date): RangeLigne[] {
  const menu = cycle.menus[semaine];
  const parId = new Map(cycle.recettes.map((r) => [r.id, r]));
  const iRituel = (dimanche.getDay() + 6) % 7; // getDay() : dimanche = 0
  const lignes: RangeLigne[] = [];
  for (const { jour, repas } of menu.jours) {
    const ecoule = (JOURS.indexOf(jour) - iRituel + 7) % 7;
    for (const r of repas) {
      if (!r.boite || r.moment === 'collation') continue;
      const rec = r.recette ? parId.get(r.recette) : undefined;
      const frigoJours = r.boite.frigoJours ?? rec?.conservation.frigoJours ?? 2;
      // Midi → box (une par jour) ; soir → frigo, congélateur si le délai
      // dépasse la conservation et que le plat est congelable (sinon frigo,
      // l'alerte de validation §5.5 le signale à l'import).
      const zone: ZoneRangement =
        r.moment === 'dejeuner'
          ? 'box'
          : ecoule > frigoJours && rec?.conservation.congelable
            ? 'congel'
            : 'frigo';
      lignes.push({
        id: r.id,
        zone,
        recetteId: r.recette ?? null,
        nom: rec?.nom ?? r.texte ?? r.id,
        portions: 1,
        pour: [r],
        aMangerAvant: zone === 'congel' ? null : plusJours(dimanche, frigoJours),
      });
    }
  }
  for (const res of menu.reserve) {
    lignes.push({
      id: cleIngredient(res.plat),
      zone: 'congel',
      recetteId: null,
      nom: res.plat,
      portions: 1,
      pour: [],
      aMangerAvant: null,
    });
  }
  return lignes;
}

// « Au frigo cette semaine » : ce qui reste (boîtes non mangées), trié par
// date limite. Sans coches passés, tout est considéré encore là.
export function auFrigo(
  cycle: Cycle,
  semaine: number,
  dimanche: Date,
  coches: Readonly<Record<string, boolean>> = {},
): RangeLigne[] {
  const menu = cycle.menus[semaine];
  const mangees = new Set(
    menu.jours.flatMap(({ jour, repas }) =>
      repas.filter((r) => coches[`menu:${menu.lettre}:${jour}:${r.id}`]).map((r) => r.id),
    ),
  );
  return rangement(cycle, semaine, dimanche)
    .filter((l) => l.zone !== 'congel' && !l.pour.some((r) => mangees.has(r.id)))
    .sort((a, b) => (a.aMangerAvant?.getTime() ?? Infinity) - (b.aMangerAvant?.getTime() ?? Infinity));
}

// ——— Ids de coches des gestes et du rangement (§8, stables)

export const idCocheGeste = (lettre: Lettre, etapeId: string, i: number) => `geste:${lettre}:${etapeId}:${i}`;
export const idCocheRange = (lettre: Lettre, cle: string) => `range:${lettre}:${cle}`;
