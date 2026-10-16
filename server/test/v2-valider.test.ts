import { describe, expect, it } from 'vitest';
import { CONTRAT, type Menus, type ProfilFoyer, type Recette, type Semaine } from '../src/v2/contrat.js';
import { validerMenus, type CodeErreur } from '../src/v2/valider.js';

// Validateur de menus (plan 2026-10-16-app-native §A.6, spec §10.2.3) : le verrou de sécurité
// entre l'IA et le foyer. Chaque test part d'un menu conforme et en abîme un point.

const profil = (surcharge: Partial<ProfilFoyer> = {}): ProfilFoyer => ({
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

const recette = (s: number, id: string, titre: string, origine: Recette['origine'], ingredients: Recette['ingredients'], tempsJour = 5): Recette => ({
  id: `${id}-${s}`,
  titre: `${titre} (${s})`,
  origine,
  ingredients,
  etapes: ['Préparer.'],
  tempsJour,
  photo: 'dish',
});

const semaine = (s: number): Semaine => ({
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

const menus = (): Menus => ({ contrat: CONTRAT, semaines: [1, 2, 3, 4].map(semaine) });

const codes = (m: Menus, p: ProfilFoyer = profil()): CodeErreur[] => validerMenus(m, p).erreurs.map((e) => e.code);

/** Remplace les ingrédients d'une recette de la semaine 1. */
const avecIngredients = (id: string, ingredients: Recette['ingredients']): Menus => {
  const m = menus();
  m.semaines[0].recettes.find((r) => r.id === `${id}-1`)!.ingredients = ingredients;
  return m;
};

describe('validerMenus — menu de référence', () => {
  it('accepte un menu conforme et estime le coût de chaque semaine', () => {
    const r = validerMenus(menus(), profil());
    expect(r.erreurs).toEqual([]);
    expect(r.estimation).toHaveLength(4);
    for (const e of r.estimation) expect(e).toBeGreaterThan(5);
  });
});

describe('validerMenus — structure', () => {
  it('refuse un numéro de contrat inconnu et un nombre de semaines ou de jours faux', () => {
    expect(codes({ ...menus(), contrat: CONTRAT + 1 })).toContain('structure');
    const m = menus();
    m.semaines.pop();
    expect(codes(m)).toContain('structure');
    const j = menus();
    j.semaines[1].jours.pop();
    expect(codes(j)).toContain('structure');
  });

  it("refuse un repas qui ne suit pas la trame du foyer (Box, dehors, libre)", () => {
    const m = menus();
    m.semaines[0].jours[4].midi = { type: 'box', recette: 'gratin-1' };
    expect(codes(m)).toContain('structure');
  });

  it('refuse une recette citée sur un repas « dehors » ou « libre »', () => {
    const m = menus();
    m.semaines[0].jours[5].soir = { type: 'dehors', recette: 'pates-1' };
    expect(codes(m)).toContain('structure');
  });

  it("refuse une Box ou un plat prêt tirés d'une recette fraîche, et l'inverse", () => {
    const m = menus();
    m.semaines[0].jours[1].midi = { type: 'box', recette: 'omelette-1' };
    expect(codes(m)).toContain('structure');
    const f = menus();
    f.semaines[0].jours[2].soir = { type: 'frais', recette: 'gratin-1' };
    expect(codes(f)).toContain('structure');
  });

  it('refuse une recette absente de la semaine, un repas sans recette, une recette inutilisée', () => {
    const m = menus();
    m.semaines[0].jours[1].soir = { type: 'pret', recette: 'inconnue' };
    expect(codes(m)).toContain('structure');
    const v = menus();
    v.semaines[0].jours[1].soir = { type: 'pret' };
    expect(codes(v)).toContain('structure');
    const u = menus();
    u.semaines[0].recettes.push(recette(1, 'tarte', 'Tarte oubliée', 'frais', [{ id: 'oeuf', qte: 1 }]));
    expect(codes(u)).toContain('structure');
  });

  it("refuse une recette du Rituel absente des étapes, et une étape qui cite une recette fraîche", () => {
    const m = menus();
    m.semaines[0].rituel[3].recettes = ['gratin-1', 'poulet-1'];
    m.semaines[0].rituel[2].recettes = ['omelette-1'];
    const erreurs = validerMenus(m, profil()).erreurs.filter((e) => e.code === 'structure');
    expect(erreurs.map((e) => e.recette)).toEqual(expect.arrayContaining(['Curry de lentilles (1)', 'Omelette aux champignons (1)']));
  });
});

describe('validerMenus — vocabulaire fermé', () => {
  it('refuse un ingrédient hors table en nommant le plat', () => {
    const r = validerMenus(avecIngredients('curry', [{ id: 'licorne', qte: 50 }]), profil());
    expect(r.erreurs).toContainEqual(expect.objectContaining({ code: 'ingredient-inconnu', recette: 'Curry de lentilles (1)' }));
    expect(r.erreurs.find((e) => e.code === 'ingredient-inconnu')!.message).toContain('licorne');
  });
});

describe('validerMenus — conservation (docs/conservation.md §4)', () => {
  it('accepte au-delà du frigo un plat congelable : il part au congélateur', () => {
    // Gratin servi à J+4 : au-delà de J+3, congelable → pas d'erreur.
    const p = profil();
    p.trame[4] = { midi: 'dehors', soir: 'pret' };
    const m = menus();
    for (const [s, semaine] of m.semaines.entries()) {
      semaine.jours[4].soir = { type: 'pret', recette: `gratin-${s + 1}` };
      semaine.recettes = semaine.recettes.filter((r) => r.id !== `pates-${s + 1}`);
    }
    expect(codes(m, p)).toEqual([]);
  });

  it('refuse une préparation crue servie au-delà de J+2 (non congelable)', () => {
    const m = avecIngredients('curry', [
      { id: 'boulgour', qte: 70 },
      { id: 'tomate', qte: 100, cru: true },
    ]);
    // Curry de la semaine 1 servi à J0 soir et J+3 midi.
    const r = validerMenus(m, profil());
    expect(r.erreurs).toContainEqual(expect.objectContaining({ code: 'conservation', recette: 'Curry de lentilles (1)', jour: 3, moment: 'midi' }));
  });

  it('accepte une préparation crue servie à J+2', () => {
    const m = avecIngredients('gratin', [{ id: 'tomate', qte: 150, cru: true }, { id: 'feta', qte: 40 }]);
    expect(codes(m)).not.toContain('conservation');
  });

  it("refuse les œufs crus dans un plat du Rituel, quel que soit le jour", () => {
    const m = avecIngredients('curry', [{ id: 'oeuf', qte: 1, cru: true }, { id: 'huile-colza', qte: 20 }]);
    const r = validerMenus(m, profil()).erreurs.filter((e) => e.code === 'conservation');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].recette).toBe('Curry de lentilles (1)');
  });

  it('accepte les œufs crus dans une recette fraîche', () => {
    const m = avecIngredients('omelette', [{ id: 'oeuf', qte: 1, cru: true }, { id: 'salade-verte', qte: 0.25 }]);
    expect(codes(m)).not.toContain('conservation');
  });
});

describe('validerMenus — régimes, allergènes, « à éviter » (déduits des ingrédients)', () => {
  it('refuse le poulet pour un foyer végétarien en nommant le plat et le régime', () => {
    const r = validerMenus(menus(), profil({ regimes: ['vegetarien'] }));
    const e = r.erreurs.find((x) => x.code === 'regime')!;
    expect(e.recette).toBe('Poulet rôti, carottes (1)');
    expect(e.message).toMatch(/végétarien/i);
  });

  it('ignore flexitarien et méditerranéen', () => {
    expect(codes(menus(), profil({ regimes: ['flexitarien', 'mediterraneen'] }))).toEqual([]);
  });

  it('casher : refuse viande ou volaille avec un laitier dans le même plat', () => {
    const m = avecIngredients('poulet', [{ id: 'cuisse-poulet', qte: 200 }, { id: 'creme-fraiche', qte: 30 }]);
    expect(codes(m, profil({ regimes: ['casher'] }))).toContain('regime');
    expect(codes(menus(), profil({ regimes: ['casher'] }))).not.toContain('regime');
  });

  it("refuse un allergène déclaré par le foyer (arachide)", () => {
    const m = avecIngredients('curry', [{ id: 'lentilles-corail', qte: 80 }, { id: 'cacahuete', qte: 15 }]);
    const r = validerMenus(m, profil({ allergenes: ['arachides'] }));
    expect(r.erreurs).toContainEqual(expect.objectContaining({ code: 'allergene', recette: 'Curry de lentilles (1)' }));
  });

  it.each([
    ['champignons', 'omelette'],
    ['oeufs', 'omelette'],
    ['porc', 'lardons'],
    ['poisson', 'sauce-poisson'],
    ['fruits-de-mer', 'crevettes'],
    ['fruits-a-coque', 'amande'],
    ['epice', 'harissa'],
  ] as const)('« à éviter » %s refuse %s', (eviter, cible) => {
    const m = cible === 'omelette' ? menus() : avecIngredients('curry', [{ id: 'lentilles-corail', qte: 80 }, { id: cible, qte: 20 }]);
    expect(codes(m, profil({ eviter: [eviter] }))).toContain('eviter');
  });
});

describe('validerMenus — temps', () => {
  it('compte les cuissons en parallèle : la durée est la fin du dernier minuteur ou de la dernière étape', () => {
    // Référence : fin à 60 min (dernière étape de 45 à 60), sous les 90 min.
    expect(codes(menus(), profil({ tempsRituel: 60 }))).not.toContain('temps-rituel');
    expect(codes(menus(), profil({ tempsRituel: 55 }))).toContain('temps-rituel');
  });

  it("un minuteur qui dépasse la dernière étape allonge le Rituel", () => {
    const m = menus();
    m.semaines[2].rituel[0].minuteur = 100;
    const r = validerMenus(m, profil());
    expect(r.erreurs).toContainEqual(expect.objectContaining({ code: 'temps-rituel', semaine: 2 }));
  });

  it('refuse une recette fraîche plus longue que le temps du soir, sauf « 40 min ou plus »', () => {
    expect(codes(menus(), profil({ tempsSoir: 10 }))).toContain('temps-soir');
    expect(codes(menus(), profil({ tempsSoir: null }))).not.toContain('temps-soir');
  });
});

describe('validerMenus — budget (85 % du budget ramené à la semaine)', () => {
  it('refuse une semaine dont le coût estimé dépasse 85 % du budget', () => {
    const { estimation } = validerMenus(menus(), profil());
    const budget = Math.floor(estimation[0] / 0.85) - 1;
    expect(codes(menus(), profil({ budget: { montant: budget, periode: 'semaine' } }))).toContain('budget');
    expect(codes(menus(), profil({ budget: { montant: budget + 2, periode: 'semaine' } }))).not.toContain('budget');
  });

  it('ramène un budget au mois (30 jours) à la semaine', () => {
    const { estimation } = validerMenus(menus(), profil());
    const hebdo = Math.ceil(estimation[0] / 0.85) + 1;
    expect(codes(menus(), profil({ budget: { montant: (hebdo * 30) / 7, periode: 'mois' } }))).not.toContain('budget');
    expect(codes(menus(), profil({ budget: { montant: ((hebdo - 3) * 30) / 7, periode: 'mois' } }))).toContain('budget');
  });

  it('compte une portion de 0,6 par enfant', () => {
    const adultes = validerMenus(menus(), profil()).estimation[0];
    const famille = validerMenus(menus(), profil({ enfants: 1 })).estimation[0];
    expect(famille / adultes).toBeCloseTo(2.6 / 2, 5);
  });
});

describe('validerMenus — quantités par personne', () => {
  it.each([
    ['cuisse-poulet', 600],
    ['cuisse-poulet', 0],
    ['oeuf', 9],
    ['sel', 40],
  ])('refuse %s à %s par personne', (id, qte) => {
    const r = validerMenus(avecIngredients('poulet', [{ id, qte }, { id: 'carotte', qte: 150 }]), profil());
    expect(r.erreurs).toContainEqual(expect.objectContaining({ code: 'quantite', recette: 'Poulet rôti, carottes (1)' }));
  });
});

describe('validerMenus — variété sur 4 semaines', () => {
  it('refuse deux fois la même recette, même sous un autre id', () => {
    const m = menus();
    m.semaines[3].recettes.find((r) => r.id === 'soupe-4')!.titre = '  soupe de COURGETTES (1) ';
    const r = validerMenus(m, profil());
    expect(r.erreurs).toContainEqual(expect.objectContaining({ code: 'variete', semaine: 3 }));
  });

  it('refuse un id de recette réutilisé', () => {
    const m = menus();
    m.semaines[1].recettes.find((r) => r.id === 'soupe-2')!.id = 'soupe-1';
    m.semaines[1].jours[6].soir.recette = 'soupe-1';
    expect(codes(m)).toContain('variete');
  });

  it('refuse une recette fraîche servie deux fois', () => {
    const m = menus();
    m.semaines[0].jours[6].soir = { type: 'frais', recette: 'pates-1' };
    m.semaines[0].recettes = m.semaines[0].recettes.filter((r) => r.id !== 'soupe-1');
    expect(codes(m)).toContain('variete');
  });
});

describe('validerMenus — messages', () => {
  it("chaque erreur liée à un plat le nomme dans son message, avec le jour réel", () => {
    const r = validerMenus(menus(), profil({ regimes: ['vegetarien'] }));
    for (const e of r.erreurs) {
      expect(e.recette).toBeTruthy();
      expect(e.message).toContain(e.recette!);
    }
    // Poulet servi lundi soir (J+1 d'un Rituel le dimanche).
    expect(r.erreurs[0].message).toMatch(/lundi soir/);
  });
});
