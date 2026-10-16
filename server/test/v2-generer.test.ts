import { describe, expect, it } from 'vitest';
import { CONTRAT, type Menus, type Recette } from '../src/v2/contrat.js';
import { genererMenus, type AppelIA, type RequeteIA, type ReponseIA } from '../src/v2/generer.js';
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
const omelette = (): Recette => menus().semaines[0].recettes.find((r) => r.id === 'omelette-1')!;

describe('genererMenus — premier essai', () => {
  it('menu conforme → renvoyé tel quel, avec le contrat et l’estimation, en un appel', async () => {
    const { appel, requetes } = simuler([ok(sortie(menus()))]);
    const r = await genererMenus(appel, profil());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.menus).toEqual({ contrat: CONTRAT, semaines: menus().semaines });
    expect(r.estimation).toHaveLength(4);
    expect(r.appels).toBe(1);
    expect(r.jetons).toEqual({ entree: 1000, sortie: 500 });
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
      ok(JSON.stringify(corrigee)),
    ]);
    const r = await genererMenus(appel, sansPorc);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.appels).toBe(4);
    const req = requetes[3];
    expect(req.format).toBe('recette');
    expect(req.messages[0].content).toMatch(/<profil>/);
    expect(req.messages.at(-1)!.content).toContain('Omelette aux champignons (1)');
    // id et origine restent ceux du plat remplacé : les jours et le Rituel y renvoient toujours.
    const remplacee = r.menus.semaines[0].recettes.find((x) => x.id === 'omelette-1')!;
    expect(remplacee).toMatchObject({ titre: 'Omelette aux herbes', origine: 'frais' });
  });

  it('plat regénéré encore fautif → échec « non-conforme » avec les erreurs, rien n’est renvoyé', async () => {
    const encorePorc = { ...omelette(), ingredients: [...omelette().ingredients, { id: 'lardons', qte: 40 }] };
    const { appel } = simuler([
      ok(sortie(avecPorc())),
      ok(sortie(avecPorc())),
      ok(sortie(avecPorc())),
      ok(JSON.stringify(encorePorc)),
    ]);
    const r = await genererMenus(appel, sansPorc);
    expect(r).toMatchObject({ ok: false, raison: 'non-conforme', appels: 4 });
    if (r.ok) return;
    expect(r.erreurs?.map((e) => e.code)).toContain('eviter');
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
