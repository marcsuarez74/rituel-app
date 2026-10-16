import { CONSERVATION, categorieDuPlat, type CategorieConservation } from './conservation.js';
import {
  CONTRAT,
  JOURS_PAR_SEMAINE,
  MOMENTS,
  PERIODES_BUDGET,
  SEMAINES,
  type Eviter,
  type Menus,
  type Moment,
  type ProfilFoyer,
  type Recette,
  type Semaine,
} from './contrat.js';
import { REGIMES, ingredient, regimesCompatibles, type Famille, type Ingredient, type Regime } from './ingredients.js';

// Validateur de menus (spec §10.2.3) : le verrou entre l'IA et le foyer. Tout ce qui compte
// est recalculé ici à partir de la table d'ingrédients ; un menu avec une seule erreur n'est
// jamais montré. Chaque erreur nomme le plat fautif pour que l'IA puisse le corriger.

export type CodeErreur =
  | 'structure'
  | 'ingredient-inconnu'
  | 'conservation'
  | 'regime'
  | 'allergene'
  | 'eviter'
  | 'temps-rituel'
  | 'temps-soir'
  | 'budget'
  | 'quantite'
  | 'variete';

export interface ErreurMenu {
  code: CodeErreur;
  message: string;
  /** Index de la semaine (0 à 3). */
  semaine?: number;
  /** Jour compté depuis le Rituel (0 = J0). */
  jour?: number;
  moment?: Moment;
  /** Titre du plat fautif. */
  recette?: string;
}

export interface ResultatValidation {
  erreurs: ErreurMenu[];
  /** Coût estimé de chaque semaine, en euros, aux prix moyens de la table. */
  estimation: number[];
}

/** Part du budget que les menus peuvent prendre : le reste couvre petit-déjeuner et extras. */
export const PART_BUDGET_MENUS = 0.85;
/** Une portion d'enfant, en part d'une portion d'adulte. */
export const PORTION_ENFANT = 0.6;

/** Quantités plausibles pour une personne, en g ou ml ; à recaler sur les sorties réelles. */
const PLAGES: Record<Famille, readonly [number, number]> = {
  volaille: [20, 300],
  viande: [20, 300],
  porc: [20, 300],
  poisson: [20, 300],
  'fruits-de-mer': [20, 300],
  legume: [5, 400],
  fruit: [5, 300],
  champignon: [10, 250],
  feculent: [50, 400],
  cereale: [20, 150],
  legumineuse: [20, 200],
  noix: [2, 60],
  graine: [1, 40],
  laitier: [5, 250],
  oeuf: [5, 250],
  'matiere-grasse': [1, 150],
  condiment: [0.1, 30],
  epice: [0.05, 10],
  herbe: [0.1, 30],
  sucre: [1, 50],
  miel: [1, 30],
  boisson: [5, 250],
};
const PLAGE_PIECE = [0.05, 4] as const;

const NOMS_JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

const NOMS_REGIMES: Record<Regime, string> = {
  vegetarien: 'végétarien',
  vegan: 'végan',
  keto: 'cétogène',
  'low-carb': 'low carb',
  paleo: 'paléo',
  'sans-gluten': 'sans gluten',
  'sans-lactose': 'sans lactose',
  halal: 'halal',
  casher: 'casher',
  'pauvre-en-sel': 'pauvre en sel',
};

const EVITE: Record<Eviter, (i: Ingredient) => boolean> = {
  porc: (i) => i.famille === 'porc',
  'fruits-a-coque': (i) => i.allergenes.includes('fruits-a-coque'),
  poisson: (i) => i.famille === 'poisson' || i.allergenes.includes('poissons'),
  'fruits-de-mer': (i) =>
    i.famille === 'fruits-de-mer' || i.allergenes.includes('crustaces') || i.allergenes.includes('mollusques'),
  champignons: (i) => i.famille === 'champignon',
  oeufs: (i) => i.famille === 'oeuf' || i.allergenes.includes('oeufs'),
  epice: (i) => i.piquant === true,
};

const FAMILLES_ANIMALES_CASHER: readonly Famille[] = ['viande', 'volaille'];
// Servis crus, ces ingrédients font du plat une préparation crue assemblée (taboulé, crudités).
const CRUDITES: readonly Famille[] = ['legume', 'fruit', 'champignon', 'herbe', 'legumineuse'];
// Crus, œufs, viandes et poissons excluent le plat du Rituel (comme la sauce aux œufs crus).
const CRUS_EXCLUS: readonly Famille[] = ['oeuf', 'volaille', 'viande', 'porc', 'poisson', 'fruits-de-mer'];

export const normaliser = (titre: string): string =>
  titre.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

type Place = { jour: number; moment: Moment };

const categorie = (r: Recette): CategorieConservation =>
  categorieDuPlat(
    r.ingredients.flatMap((l): CategorieConservation[] => {
      const i = ingredient(l.id);
      if (!i) return [];
      if (l.cru && CRUS_EXCLUS.includes(i.famille)) return ['oeufs-crus'];
      if (l.cru && CRUDITES.includes(i.famille)) return ['cru-assemble'];
      return [i.conservation];
    }),
  );

/** Contrôles d'un plat seul, quelle que soit sa place au menu : vocabulaire, quantités, régimes,
 * allergènes, « à éviter », ingrédient cru exclu du Rituel, temps du soir. Sert aussi à choisir
 * les plats compatibles de la bibliothèque. */
export const controlerRecette = (r: Recette, profil: ProfilFoyer): { code: CodeErreur; texte: string }[] => {
  const erreurs: { code: CodeErreur; texte: string }[] = [];
  const ajouter = (code: CodeErreur, texte: string) => erreurs.push({ code, texte });
  const regimes = REGIMES.filter((reg) => profil.regimes.includes(reg));
  const connus: Ingredient[] = [];
  for (const l of r.ingredients) {
    const i = ingredient(l.id);
    if (!i) {
      ajouter('ingredient-inconnu', `ingrédient « ${l.id} » hors de la table.`);
      continue;
    }
    connus.push(i);
    const [min, max] = i.unite === 'piece' ? PLAGE_PIECE : PLAGES[i.famille];
    const unite = i.unite === 'piece' ? ' pièce(s)' : i.unite === 'l' ? ' ml' : ' g';
    if (!(l.qte >= min && l.qte <= max)) ajouter('quantite', `${i.nom} : ${l.qte}${unite} par personne, hors de ${min} à ${max}.`);
    for (const reg of regimes)
      if (!regimesCompatibles(i).includes(reg)) ajouter('regime', `${i.nom} est incompatible avec le régime ${NOMS_REGIMES[reg]}.`);
    for (const a of i.allergenes)
      if (profil.allergenes.includes(a)) ajouter('allergene', `${i.nom} contient l'allergène « ${a} ».`);
    for (const e of profil.eviter)
      if (EVITE[e](i)) ajouter('eviter', `${i.nom} fait partie des aliments à éviter (« ${e} »).`);
  }
  if (
    regimes.includes('casher') &&
    connus.some((i) => FAMILLES_ANIMALES_CASHER.includes(i.famille)) &&
    connus.some((i) => i.famille === 'laitier' || i.allergenes.includes('lait'))
  )
    ajouter('regime', 'viande et laitier dans le même plat : incompatible avec le régime casher.');
  if (r.origine === 'rituel') {
    if (CONSERVATION[categorie(r)].frigoMax === null) ajouter('conservation', 'contient un ingrédient cru exclu des plats du Rituel.');
  } else if (profil.tempsSoir !== null && r.tempsJour > profil.tempsSoir)
    ajouter('temps-soir', `${r.tempsJour} min de préparation, au-delà des ${profil.tempsSoir} min du soir.`);
  return erreurs;
};

/** Durée du Rituel : chaque étape commence quand la précédente libère la personne qui
 * cuisine ; un minuteur continue seul. La fin est la dernière étape ou le dernier minuteur. */
export const dureeRituel = (s: Semaine): number => {
  let debut = 0;
  let fin = 0;
  for (const e of s.rituel) {
    fin = Math.max(fin, debut + e.duree, debut + (e.minuteur ?? 0));
    debut += e.duree;
  }
  return fin;
};

/** Coût d'une semaine : chaque repas servi compte une portion par convive. */
const coutSemaine = (s: Semaine, convives: number): number => {
  const parId = new Map(s.recettes.map((r) => [r.id, r]));
  let cout = 0;
  for (const j of s.jours)
    for (const m of MOMENTS) {
      const r = j[m].recette ? parId.get(j[m].recette!) : undefined;
      for (const l of r?.ingredients ?? []) {
        const i = ingredient(l.id);
        if (i) cout += (i.unite === 'piece' ? l.qte : l.qte / 1000) * i.prix * convives;
      }
    }
  return cout;
};

export const validerMenus = (menus: Menus, profil: ProfilFoyer): ResultatValidation => {
  const erreurs: ErreurMenu[] = [];
  const convives = profil.adultes + PORTION_ENFANT * profil.enfants;

  if (menus.contrat !== CONTRAT)
    erreurs.push({ code: 'structure', message: `Contrat ${menus.contrat} inconnu (attendu : ${CONTRAT}).` });
  if (menus.semaines.length !== SEMAINES)
    erreurs.push({ code: 'structure', message: `${menus.semaines.length} semaines au lieu de ${SEMAINES}.` });

  const budgetHebdo = (profil.budget.montant * 7) / PERIODES_BUDGET[profil.budget.periode];
  const idsVus = new Set<string>();
  const titresVus = new Set<string>();
  const estimation: number[] = [];

  menus.semaines.forEach((s, semaine) => {
    const lieu = (jour: number, moment: Moment) =>
      `semaine ${semaine + 1}, ${NOMS_JOURS[(profil.jourRituel + jour) % 7]} ${moment}`;
    const parId = new Map(s.recettes.map((r) => [r.id, r]));
    const places = new Map<string, Place[]>(s.recettes.map((r) => [r.id, []]));

    const surPlat = (code: CodeErreur, r: Recette, texte: string, place?: Place) => {
      const p = place ?? places.get(r.id)?.[0];
      erreurs.push({
        code,
        message: `${r.titre} (${p ? lieu(p.jour, p.moment) : `semaine ${semaine + 1}`}) : ${texte}`,
        semaine,
        ...(p && { jour: p.jour, moment: p.moment }),
        recette: r.titre,
      });
    };

    // Structure : la trame du foyer, repas par repas.
    if (s.jours.length !== JOURS_PAR_SEMAINE)
      erreurs.push({ code: 'structure', message: `Semaine ${semaine + 1} : ${s.jours.length} jours au lieu de 7.`, semaine });
    s.jours.slice(0, JOURS_PAR_SEMAINE).forEach((j, jour) => {
      for (const moment of MOMENTS) {
        const repas = j[moment];
        const attendu = profil.trame[jour]?.[moment];
        const ici = { code: 'structure' as const, semaine, jour, moment };
        if (repas.type !== attendu)
          erreurs.push({ ...ici, message: `${lieu(jour, moment)} : « ${repas.type} » au lieu de « ${attendu} ».` });
        if (repas.type === 'dehors' || repas.type === 'libre') {
          if (repas.recette)
            erreurs.push({ ...ici, message: `${lieu(jour, moment)} : un repas « ${repas.type} » ne cite pas de recette.` });
          continue;
        }
        const r = repas.recette ? parId.get(repas.recette) : undefined;
        if (!r) {
          erreurs.push({ ...ici, message: `${lieu(jour, moment)} : recette « ${repas.recette ?? ''} » absente de la semaine.` });
          continue;
        }
        places.get(r.id)!.push({ jour, moment });
        const origine = repas.type === 'frais' ? 'frais' : 'rituel';
        if (r.origine !== origine)
          surPlat('structure', r, `un repas « ${repas.type} » demande une recette « ${origine} ».`, { jour, moment });
      }
    });

    const citees = new Set(s.rituel.flatMap((e) => e.recettes));
    for (const id of citees) {
      const r = parId.get(id);
      if (!r) erreurs.push({ code: 'structure', message: `Rituel de la semaine ${semaine + 1} : recette « ${id} » absente.`, semaine });
      else if (r.origine !== 'rituel') surPlat('structure', r, 'recette fraîche citée dans le Rituel.');
    }

    for (const r of s.recettes) {
      const servi = places.get(r.id)!;
      if (servi.length === 0) surPlat('structure', r, 'recette servie à aucun repas.');
      if (r.origine === 'rituel' && !citees.has(r.id)) surPlat('structure', r, 'absente des étapes du Rituel.');

      // Variété : pas deux fois la même recette sur 4 semaines.
      const titre = normaliser(r.titre);
      if (idsVus.has(r.id) || titresVus.has(titre)) surPlat('variete', r, 'déjà au menu.');
      idsVus.add(r.id);
      titresVus.add(titre);
      if (r.origine === 'frais' && servi.length > 1) surPlat('variete', r, `recette fraîche servie ${servi.length} fois.`);

      for (const e of controlerRecette(r, profil)) surPlat(e.code, r, e.texte);

      // Conservation au-delà du frigo (docs/conservation.md §4) : dépend des jours servis.
      if (r.origine === 'rituel') {
        const { frigoMax, congelable } = CONSERVATION[categorie(r)];
        if (frigoMax !== null)
          for (const p of servi)
            if (p.jour > frigoMax && !congelable)
              surPlat('conservation', r, `se garde ${frigoMax} jours au frigo et ne se congèle pas : servi à J+${p.jour}.`, p);
      }
    }

    const duree = dureeRituel(s);
    if (duree > profil.tempsRituel)
      erreurs.push({
        code: 'temps-rituel',
        message: `Rituel de la semaine ${semaine + 1} : ${duree} min, au-delà des ${profil.tempsRituel} min choisies.`,
        semaine,
      });

    const cout = coutSemaine(s, convives);
    estimation.push(cout);
    if (cout > PART_BUDGET_MENUS * budgetHebdo)
      erreurs.push({
        code: 'budget',
        message: `Semaine ${semaine + 1} : ${cout.toFixed(2)} € estimés, au-delà de ${(PART_BUDGET_MENUS * budgetHebdo).toFixed(2)} € (${PART_BUDGET_MENUS * 100} % du budget de la semaine).`,
        semaine,
      });
  });

  return { erreurs, estimation };
};
