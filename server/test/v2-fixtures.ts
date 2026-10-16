import { CONTRAT, type Menus, type ProfilFoyer, type Recette, type Semaine } from '../src/v2/contrat.js';

// Profil et menus de référence (conformes) partagés par les tests du validateur et de la
// génération : chaque test part de là et en abîme un point.

export const profil = (surcharge: Partial<ProfilFoyer> = {}): ProfilFoyer => ({
  adultes: 2,
  enfants: 0,
  jourRituel: 6, // dimanche
  trame: [
    { midi: 'libre', soir: 'pret' }, // dimanche, J0
    { midi: 'box', soir: 'pret' },
    { midi: 'box', soir: 'frais' },
    { midi: 'box', soir: 'pret' },
    { midi: 'dehors', soir: 'frais' },
    { midi: 'dehors', soir: 'dehors' },
    { midi: 'libre', soir: 'frais' },
  ],
  tempsRituel: 90,
  tempsSoir: 20,
  regimes: [],
  eviter: [],
  allergenes: [],
  budget: { montant: 120, periode: 'semaine' },
  ...surcharge,
});

export const recette = (s: number, id: string, titre: string, origine: Recette['origine'], ingredients: Recette['ingredients'], tempsJour = 5): Recette => ({
  id: `${id}-${s}`,
  titre: `${titre} (${s})`,
  origine,
  ingredients,
  etapes: ['Préparer.'],
  tempsJour,
  photo: 'dish',
});

export const semaine = (s: number): Semaine => ({
  recettes: [
    recette(s, 'curry', 'Curry de lentilles', 'rituel', [
      { id: 'lentilles-corail', qte: 80 },
      { id: 'lait-coco', qte: 100 },
      { id: 'oignon', qte: 50 },
      { id: 'curry-poudre', qte: 2 },
    ]),
    recette(s, 'gratin', 'Gratin de pommes de terre', 'rituel', [
      { id: 'pomme-de-terre', qte: 250 },
      { id: 'creme-liquide', qte: 50 },
      { id: 'emmental-rape', qte: 30 },
    ]),
    recette(s, 'poulet', 'Poulet rôti, carottes', 'rituel', [
      { id: 'cuisse-poulet', qte: 200 },
      { id: 'carotte', qte: 150 },
      { id: 'huile-olive', qte: 10 },
    ]),
    recette(s, 'omelette', 'Omelette aux champignons', 'frais', [
      { id: 'oeuf', qte: 2 },
      { id: 'champignon-paris', qte: 80 },
      { id: 'beurre', qte: 5 },
    ], 15),
    recette(s, 'pates', 'Pâtes au pesto', 'frais', [
      { id: 'pates', qte: 100 },
      { id: 'pesto-basilic', qte: 30 },
    ], 15),
    recette(s, 'soupe', 'Soupe de courgettes', 'frais', [
      { id: 'courgette', qte: 200 },
      { id: 'pomme-de-terre', qte: 80 },
    ], 20),
  ],
  rituel: [
    { texte: 'Le poulet part au four.', duree: 10, minuteur: 50, recettes: [`poulet-${s}`] },
    { texte: 'Le gratin rejoint le poulet.', duree: 20, minuteur: 40, recettes: [`gratin-${s}`] },
    { texte: 'Le curry mijote.', duree: 15, minuteur: 20, recettes: [`curry-${s}`] },
    { texte: 'On remplit les Box.', duree: 15, recettes: [`curry-${s}`, `gratin-${s}`, `poulet-${s}`] },
  ],
  jours: [
    { midi: { type: 'libre' }, soir: { type: 'pret', recette: `curry-${s}` } },
    { midi: { type: 'box', recette: `gratin-${s}` }, soir: { type: 'pret', recette: `poulet-${s}` } },
    { midi: { type: 'box', recette: `gratin-${s}` }, soir: { type: 'frais', recette: `omelette-${s}` } },
    { midi: { type: 'box', recette: `curry-${s}` }, soir: { type: 'pret', recette: `poulet-${s}` } },
    { midi: { type: 'dehors' }, soir: { type: 'frais', recette: `pates-${s}` } },
    { midi: { type: 'dehors' }, soir: { type: 'dehors' } },
    { midi: { type: 'libre' }, soir: { type: 'frais', recette: `soupe-${s}` } },
  ],
});

export const menus = (): Menus => ({ contrat: CONTRAT, semaines: [1, 2, 3, 4].map(semaine) });
