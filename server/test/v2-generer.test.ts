import { describe, expect, it } from 'vitest';
import { CONTRAT, type EtapeRituel, type Menus, type Recette } from '../src/v2/contrat.js';
import { genererMenus, remplacerPlat, type AppelIA, type RequeteIA, type ReponseIA } from '../src/v2/generer.js';
import { menus, profil } from './v2-fixtures.js';

// Génération des menus (plan 2026-10-16-app-native §A.7) : l'IA écrit, le validateur tranche.
// Le client Claude est simulé : une file de réponses figées, chaque requête est gardée.

const sortie = (m: Menus): string => JSON.stringify({ semaines: m.semaines });
const ok = (texte: string): ReponseIA => ({ fin: 'ok', texte, jetons: { entree: 1000, sortie: 500 } });

const simuler = (reponses: ReponseIA[]) => {
  const requetes: RequeteIA[] = [];
  const appel: AppelIA = async (r) => {
    requetes.push(structuredClone(r));
    const suivante = reponses.shift();
    if (!suivante) throw new Error('appel IA en trop');
    return suivante;
  };
  return { appel, requetes };
};

/** Semaine 1 : l'omelette contient des lardons — refusé pour un foyer qui évite le porc. */
const avecPorc = (): Menus => {
  const m = menus();
  m.semaines[0].recettes.find((r) => r.id === 'omelette-1')!.ingredients.push({ id: 'lardons', qte: 40 });
  return m;
};
const sansPorc = profil({ eviter: ['porc'] });
const plat = (id: string, m: Menus = menus()): Recette => m.semaines[0].recettes.find((r) => r.id === id)!;
const omelette = (): Recette => plat('omelette-1');

/** Semaine 1 : le curry du Rituel contient des lardons. */
const rituelAvecPorc = (): Menus => {
  const m = menus();
  plat('curry-1', m).ingredients.push({ id: 'lardons', qte: 40 });
  return m;
};
/** Un plat frais de la bibliothèque, compatible avec le foyer qui évite le porc. */
const platBiblio: Recette = {
  ...omelette(),
  id: 'b-tortilla',
  bibliotheque: 'b-tortilla',
  titre: 'Tortilla du placard',
};
const etapesCurryPoisChiches = (): EtapeRituel[] =>
  menus().semaines[0].rituel.map((e) =>
    e.texte === 'Le curry mijote.' ? { ...e, texte: 'Le curry de pois chiches mijote.' } : e,
  );

describe('genererMenus — premier essai', () => {
  it('menu conforme → renvoyé tel quel, avec le contrat et l’estimation, en un appel', async () => {
    const { appel, requetes } = simuler([ok(sortie(menus()))]);
    const r = await genererMenus(appel, profil());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.menus).toEqual({ contrat: CONTRAT, semaines: menus().semaines });
    expect(r.estimation).toHaveLength(4);
    expect(r.appels).toBe(1);
    expect(r.jetons).toEqual({ entree: 1000, sortie: 500, cacheLu: 0, cacheEcrit: 0 });
    expect(requetes).toHaveLength(1);
    expect(requetes[0].format).toBe('menus');
  });

  it('le profil passe comme données, dans un bloc balisé', async () => {
    const { appel, requetes } = simuler([ok(sortie(menus()))]);
    await genererMenus(appel, profil({ regimes: ['flexitarien'] }));
    const premier = requetes[0].messages[0];
    expect(premier.role).toBe('user');
    expect(premier.content).toMatch(/<profil>[\s\S]*"flexitarien"[\s\S]*<\/profil>/);
  });

  it('refus du modèle ou sortie coupée → échec, jamais de menu partiel ni de nouvel essai', async () => {
    for (const fin of ['refus', 'coupe'] as const) {
      const { appel, requetes } = simuler([{ fin, texte: '{"semaines":[' }]);
      const r = await genererMenus(appel, profil());
      expect(r).toMatchObject({ ok: false, raison: fin, appels: 1 });
      expect(requetes).toHaveLength(1);
    }
  });

  it('sortie hors schéma → échec « sortie-invalide »', async () => {
    for (const texte of ['pas du json', JSON.stringify({ semaines: 'non' })]) {
      const { appel } = simuler([ok(texte)]);
      expect(await genererMenus(appel, profil())).toMatchObject({ ok: false, raison: 'sortie-invalide' });
    }
  });
});

describe('genererMenus — bibliothèque', () => {
  it('les plats proposés sont listés à l’IA, comme données, après le profil', async () => {
    const { appel, requetes } = simuler([ok(sortie(menus()))]);
    await genererMenus(appel, profil(), [platBiblio]);
    expect(requetes[0].messages[0].content).toMatch(
      /<\/profil>[\s\S]*<bibliotheque>[\s\S]*b-tortilla \| Tortilla du placard \| frais/,
    );
  });

  it('un plat repris par référence est déplié : id local, contenu et id de bibliothèque', async () => {
    const m = menus();
    const semaines = m.semaines.map((s, i) =>
      i === 0
        ? {
            ...s,
            recettes: s.recettes.map((r) =>
              r.id === 'omelette-1' ? { id: 'omelette-1', bibliotheque: 'b-tortilla' } : r,
            ),
          }
        : s,
    );
    const { appel } = simuler([ok(JSON.stringify({ semaines }))]);
    const r = await genererMenus(appel, profil(), [platBiblio]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(plat('omelette-1', r.menus)).toEqual({ ...platBiblio, id: 'omelette-1' });
  });

  it('référence hors liste → erreur renvoyée à l’IA dans la boucle de correction', async () => {
    const semaines = menus().semaines.map((s, i) =>
      i === 0
        ? {
            ...s,
            recettes: s.recettes.map((r) =>
              r.id === 'omelette-1' ? { id: 'omelette-1', bibliotheque: 'b-inventee' } : r,
            ),
          }
        : s,
    );
    const { appel, requetes } = simuler([ok(JSON.stringify({ semaines })), ok(sortie(menus()))]);
    const r = await genererMenus(appel, profil(), [platBiblio]);
    expect(r).toMatchObject({ ok: true, appels: 2 });
    expect(requetes[1].messages[2].content).toContain('b-inventee');
  });
});

describe('genererMenus — boucle de correction', () => {
  it('menu fautif → les erreurs du validateur sont renvoyées, dans la même conversation', async () => {
    const { appel, requetes } = simuler([ok(sortie(avecPorc())), ok(sortie(menus()))]);
    const r = await genererMenus(appel, sansPorc);
    expect(r).toMatchObject({ ok: true, appels: 2, jetons: { entree: 2000, sortie: 1000 } });
    const msgs = requetes[1].messages;
    expect(msgs).toHaveLength(3);
    expect(msgs[1]).toEqual({ role: 'assistant', content: sortie(avecPorc()) });
    expect(msgs[2].role).toBe('user');
    expect(msgs[2].content).toContain('Omelette aux champignons (1)');
    expect(requetes[1].format).toBe('menus');
  });

  it('toujours fautif après 2 corrections → seul le plat fautif est regénéré', async () => {
    const corrigee = { ...omelette(), id: 'autre-id', origine: 'rituel' as const, titre: 'Omelette aux herbes' };
    const { appel, requetes } = simuler([
      ok(sortie(avecPorc())),
      ok(sortie(avecPorc())),
      ok(sortie(avecPorc())),
      ok(JSON.stringify({ recette: corrigee })),
    ]);
    const r = await genererMenus(appel, sansPorc);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.appels).toBe(4);
    const req = requetes[3];
    expect(req.format).toBe('plat-frais');
    expect(req.messages[0].content).toMatch(/<profil>/);
    expect(req.messages.at(-1)!.content).toContain('Omelette aux champignons (1)');
    // id et origine restent ceux du plat remplacé : les jours et le Rituel y renvoient toujours.
    const remplacee = r.menus.semaines[0].recettes.find((x) => x.id === 'omelette-1')!;
    expect(remplacee).toMatchObject({ titre: 'Omelette aux herbes', origine: 'frais' });
  });

  it('plat du Rituel regénéré → les étapes du Rituel de la semaine sont réécrites', async () => {
    const curry = { ...plat('curry-1'), titre: 'Curry de pois chiches' };
    const etapes = etapesCurryPoisChiches();
    const { appel, requetes } = simuler([
      ok(sortie(rituelAvecPorc())),
      ok(sortie(rituelAvecPorc())),
      ok(sortie(rituelAvecPorc())),
      ok(JSON.stringify({ recette: curry, rituel: etapes })),
    ]);
    const r = await genererMenus(appel, sansPorc);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(requetes[3].format).toBe('plat-rituel');
    expect(requetes[3].messages.at(-1)!.content).toContain('Le poulet part au four.');
    expect(r.menus.semaines[0].rituel).toEqual(etapes);
    expect(plat('curry-1', r.menus).titre).toBe('Curry de pois chiches');
  });

  it('plat regénéré encore fautif → échec « non-conforme » avec les erreurs, rien n’est renvoyé', async () => {
    const encorePorc = { ...omelette(), ingredients: [...omelette().ingredients, { id: 'lardons', qte: 40 }] };
    const { appel } = simuler([
      ok(sortie(avecPorc())),
      ok(sortie(avecPorc())),
      ok(sortie(avecPorc())),
      ok(JSON.stringify({ recette: encorePorc })),
    ]);
    const r = await genererMenus(appel, sansPorc);
    expect(r).toMatchObject({ ok: false, raison: 'non-conforme', appels: 4 });
    if (r.ok) return;
    expect(r.erreurs?.map((e) => e.code)).toContain('eviter');
  });

  it('dernier recours : plat frais encore fautif → un plat frais compatible de la bibliothèque, sans IA', async () => {
    const encorePorc = { ...omelette(), ingredients: [...omelette().ingredients, { id: 'lardons', qte: 40 }] };
    const { appel } = simuler([
      ok(sortie(avecPorc())),
      ok(sortie(avecPorc())),
      ok(sortie(avecPorc())),
      ok(JSON.stringify({ recette: encorePorc })),
    ]);
    const r = await genererMenus(appel, sansPorc, [platBiblio]);
    expect(r).toMatchObject({ ok: true, appels: 4 });
    if (!r.ok) return;
    expect(plat('omelette-1', r.menus)).toEqual({ ...platBiblio, id: 'omelette-1' });
  });

  it('erreur qui ne vise aucun plat (budget) → pas de regénération de plat, échec après 3 essais', async () => {
    const { appel, requetes } = simuler([ok(sortie(menus())), ok(sortie(menus())), ok(sortie(menus()))]);
    const r = await genererMenus(appel, profil({ budget: { montant: 10, periode: 'semaine' } }));
    expect(r).toMatchObject({ ok: false, raison: 'non-conforme', appels: 3 });
    expect(requetes.every((q) => q.format === 'menus')).toBe(true);
  });

  it('refus pendant une correction → échec « refus »', async () => {
    const { appel } = simuler([ok(sortie(avecPorc())), { fin: 'refus', texte: '' }]);
    expect(await genererMenus(appel, sansPorc)).toMatchObject({ ok: false, raison: 'refus', appels: 2 });
  });
});

describe('remplacerPlat (« Remplacer ce plat »)', () => {
  it('plat frais → un autre plat, même id ; le reste du menu ne bouge pas', async () => {
    const pates = { ...plat('pates-1'), titre: 'Pâtes à la tomate', ingredients: [{ id: 'pates', qte: 100 }] };
    const { appel, requetes } = simuler([ok(JSON.stringify({ recette: { ...pates, id: 'x' } }))]);
    const r = await remplacerPlat(appel, profil(), menus(), 0, 'pates-1');
    expect(r).toMatchObject({ ok: true, appels: 1 });
    if (!r.ok) return;
    expect(requetes[0].format).toBe('plat-frais');
    expect(requetes[0].messages[0].content).toMatch(/<profil>[\s\S]*Pâtes au pesto \(1\)/);
    expect(plat('pates-1', r.menus)).toEqual(pates);
    const autres = (m: Menus) => m.semaines.map((s) => s.recettes.filter((x) => x.id !== 'pates-1'));
    expect(autres(r.menus)).toEqual(autres(menus()));
  });

  it('plat du Rituel → étapes du Rituel réécrites', async () => {
    const curry = { ...plat('curry-1'), titre: 'Curry de pois chiches' };
    const { appel, requetes } = simuler([ok(JSON.stringify({ recette: curry, rituel: etapesCurryPoisChiches() }))]);
    const r = await remplacerPlat(appel, profil(), menus(), 0, 'curry-1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(requetes[0].format).toBe('plat-rituel');
    expect(r.menus.semaines[0].rituel).toEqual(etapesCurryPoisChiches());
  });

  it('nouveau plat fautif → erreurs renvoyées dans la même conversation (2 corrections)', async () => {
    const porc = {
      ...plat('pates-1'),
      titre: 'Pâtes carbonara',
      ingredients: [
        { id: 'pates', qte: 100 },
        { id: 'lardons', qte: 40 },
      ],
    };
    const bon = { ...plat('pates-1'), titre: 'Pâtes à la tomate', ingredients: [{ id: 'pates', qte: 100 }] };
    const { appel, requetes } = simuler([ok(JSON.stringify({ recette: porc })), ok(JSON.stringify({ recette: bon }))]);
    const r = await remplacerPlat(appel, sansPorc, menus(), 0, 'pates-1');
    expect(r).toMatchObject({ ok: true, appels: 2 });
    expect(requetes[1].messages).toHaveLength(3);
    expect(requetes[1].messages[2].content).toContain('Lardons');
  });

  it('rien ne doit empirer : un plat du Rituel qui fait sauter la durée du Rituel est refusé', async () => {
    const curry = { ...plat('curry-1'), titre: 'Curry de pois chiches' };
    const long = etapesCurryPoisChiches().map((e) => ({ ...e, duree: e.duree * 10 }));
    const reponse = ok(JSON.stringify({ recette: curry, rituel: long }));
    const { appel } = simuler([reponse, reponse, reponse]);
    const r = await remplacerPlat(appel, profil(), menus(), 0, 'curry-1');
    expect(r).toMatchObject({ ok: false, raison: 'non-conforme', appels: 3 });
  });

  it('menu devenu non conforme (profil changé) : remplacer le plat fautif le répare', async () => {
    const bon = { ...plat('omelette-1'), titre: 'Omelette nature' };
    const { appel } = simuler([ok(JSON.stringify({ recette: bon }))]);
    const r = await remplacerPlat(appel, sansPorc, avecPorc(), 0, 'omelette-1');
    expect(r.ok).toBe(true);
  });

  it('IA toujours fautive sur un plat frais → plat de la bibliothèque', async () => {
    const porc = {
      ...plat('pates-1'),
      titre: 'Pâtes carbonara',
      ingredients: [
        { id: 'pates', qte: 100 },
        { id: 'lardons', qte: 40 },
      ],
    };
    const reponse = ok(JSON.stringify({ recette: porc }));
    const { appel } = simuler([reponse, reponse, reponse]);
    const r = await remplacerPlat(appel, sansPorc, menus(), 0, 'pates-1', [platBiblio]);
    expect(r).toMatchObject({ ok: true, appels: 3 });
    if (!r.ok) return;
    expect(plat('pates-1', r.menus)).toEqual({ ...platBiblio, id: 'pates-1' });
  });
});
