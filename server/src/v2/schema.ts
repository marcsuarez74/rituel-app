import { z } from 'zod';
import { CONTRAT, EVITER, PERIODES_BUDGET, TYPES_REPAS } from './contrat.js';
import { ALLERGENES, INGREDIENTS, REGIMES } from './ingredients.js';

// Schémas zod de la génération (plan 2026-10-16-app-native §A.7). Côté IA, ils deviennent la
// sortie structurée (le helper du SDK ramène enums et bornes à des descriptions) : la forme est
// garantie, pas le contenu — le validateur reste le verrou (ingrédient inconnu, bornes…).

const idIngredient = z.enum(INGREDIENTS.map((i) => i.id) as [string, ...string[]]);

const ligne = z.strictObject({
  id: idIngredient,
  qte: z.number(),
  cru: z.boolean().optional(),
});

export const schemaRecette = z.strictObject({
  id: z.string(),
  titre: z.string(),
  origine: z.enum(['rituel', 'frais']),
  ingredients: z.array(ligne),
  etapes: z.array(z.string()),
  tempsJour: z.number(),
  photo: z.string(),
});

/** Un plat repris de la bibliothèque : id local dans le menu + id de bibliothèque. */
const reference = z.strictObject({ id: z.string(), bibliotheque: z.string() });
const recetteOuReference = z.union([schemaRecette, reference]);
export type RecetteSortie = z.infer<typeof recetteOuReference>;

const repas = z.strictObject({
  type: z.enum(TYPES_REPAS),
  recette: z.string().optional(),
});

const etapesRituel = z.array(
  z.strictObject({
    texte: z.string(),
    duree: z.number(),
    minuteur: z.number().optional(),
    recettes: z.array(z.string()),
  }),
);

const semaine = z.strictObject({
  recettes: z.array(recetteOuReference),
  rituel: etapesRituel,
  jours: z.array(z.strictObject({ midi: repas, soir: repas })),
});

/** Ce que l'IA renvoie : les semaines seulement, le serveur pose le numéro de contrat. */
export const schemaSortieMenus = z.strictObject({ semaines: z.array(semaine) });

/** Un plat frais remplacé : la recette seule. */
export const schemaSortiePlatFrais = z.strictObject({
  recette: recetteOuReference,
});

/** Un plat du Rituel remplacé : la recette et les étapes du Rituel de la semaine, réécrites. */
export const schemaSortiePlatRituel = z.strictObject({
  recette: recetteOuReference,
  rituel: etapesRituel,
});

/** Menus renvoyés par l'app pour « Remplacer ce plat » : la forme seulement, le validateur juge
 * le contenu. Les textes reviennent tels que le serveur les a produits. */
export const schemaMenus = z.strictObject({
  contrat: z.literal(CONTRAT),
  semaines: z
    .array(
      z.strictObject({
        recettes: z.array(schemaRecette.extend({ bibliotheque: z.string().optional() })),
        rituel: etapesRituel,
        jours: z.array(z.strictObject({ midi: repas, soir: repas })),
      }),
    )
    .length(4),
});

// Profil envoyé par l'app : aucun texte libre (rien ne peut se glisser dans le prompt), des
// bornes larges contre les abus ; le guide fixe les vraies valeurs.
const entier = (min: number, max: number) => z.number().int().min(min).max(max);

export const schemaProfil = z.strictObject({
  adultes: entier(1, 12),
  enfants: entier(0, 12),
  jourRituel: entier(0, 6),
  trame: z.array(z.strictObject({ midi: z.enum(TYPES_REPAS), soir: z.enum(TYPES_REPAS) })).length(7),
  tempsRituel: entier(10, 480),
  tempsSoir: entier(5, 240).nullable(),
  regimes: z.array(z.enum([...REGIMES, 'flexitarien', 'mediterraneen'])).max(REGIMES.length + 2),
  eviter: z.array(z.enum(EVITER)).max(EVITER.length),
  allergenes: z.array(z.enum(ALLERGENES)).max(ALLERGENES.length),
  budget: z.strictObject({
    montant: z.number().positive().max(10_000),
    periode: z.enum(Object.keys(PERIODES_BUDGET) as [keyof typeof PERIODES_BUDGET]),
  }),
});
