import type { CycleFichier, Jour, Lettre, MenuSemaine, Recette } from '../../../src/lib/cycle/types';
import { JOURS, LETTRES } from '../../../src/lib/cycle/types';

// Fabrique de cycles minimaux VALIDES pour les tests : chaque test part d'un
// cycle correct et n'altère que ce qu'il vérifie.

export const recette = (id: string, extra: Partial<Recette> = {}): Recette => ({
  id,
  nom: `Recette ${id}`,
  difficulte: 'facile',
  tempsMin: 20,
  ingredients: [
    { nom: 'Œufs', quantite: 6, unite: 'piece', rayon: 'proteines', prixEstime: 1.5 },
    { nom: 'Huile d’olive', quantite: 1, unite: 'cs', rayon: 'epicerie', prixEstime: 0.1, placard: true },
  ],
  portions: { alex: '1 assiette', sam: '1 assiette' },
  variantes: { sam: 'Sans féculent' },
  macros: {
    alex: { kcal: 600, proteines: 45, glucides: 50, lipides: 20 },
    sam: { kcal: 450, proteines: 38, glucides: 8, lipides: 30 },
  },
  etapes: [{ texte: 'Cuire.', minuteurMin: 10 }],
  conservation: { frigoJours: 2, congelable: false, rechauffage: 'Micro-ondes 2 min.' },
  ...extra,
});

const dinerId = (l: Lettre, j: Jour) => `diner-${l.toLowerCase()}-${j}`;

export const menu = (lettre: Lettre): MenuSemaine => ({
  lettre,
  titre: `Menu ${lettre}`,
  jours: JOURS.map((jour) => ({
    jour,
    repas: [{ id: `${jour}-diner-famille`, moment: 'diner', pour: 'famille', recette: dinerId(lettre, jour) }],
  })),
  microBatch: [{ id: 'mb-lundi', jour: 'lundi', quoi: 'Doubler le plat', dureeMin: 10 }],
  reserve: [],
});

// Un fichier par menu (comme Claude les produit) ; le rituel et les fixes
// dans le fichier A.
export const fichier = (lettre: Lettre): CycleFichier => ({
  format: 'rituel-cycle',
  version: 2,
  titre: 'Cycle test',
  ...(lettre === 'A'
    ? {
        rituel: {
          dureeMin: 50,
          production: ['10 egg muffins'],
          avantDeCommencer: [{ nom: 'Œufs', quantite: '10' }],
          etapes: [{ id: 'rituel-muffins', creneau: '0-20 min', label: 'Muffins', detail: 'Au four.', recette: 'muffins' }],
          termine: 'Fini.',
        },
        fixes: [
          { nom: 'Skyr', quantite: 3, unite: 'piece', rayon: 'laitiers', prixEstime: 4, pour: ['alex'], frequence: 'hebdo' },
          { nom: 'Whey', quantite: 1, unite: 'piece', rayon: 'epicerie', prixEstime: 20, pour: ['alex'], frequence: 'mensuel' },
        ],
      }
    : {}),
  menus: [menu(lettre)],
  recettes: [
    ...(lettre === 'A' ? [recette('muffins', { variantes: undefined, portions: { alex: '2 muffins' }, macros: {} })] : []),
    ...JOURS.map((j) => recette(dinerId(lettre, j))),
  ],
});

export const quatreFichiers = (): CycleFichier[] => LETTRES.map(fichier);

export const enFichiers = (fs: CycleFichier[]) =>
  fs.map((f, i) => ({ nom: `menu-${f.menus[0]?.lettre ?? i}.json`, contenu: JSON.stringify(f) }));

export const FOYER = [
  { id: 'alex', suivi: true },
  { id: 'sam', suivi: true, regime: 'keto' },
  { id: 'lou', suivi: false },
  { id: 'noa', suivi: false },
];
