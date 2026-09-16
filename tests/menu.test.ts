import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { MenuDay, Recette } from '../src/lib/model';
import {
  construireOnglets,
  construirePaires,
  debloquePar,
  faitsParRecette,
  labelCourt,
  paireFaite,
  pairePrete,
  selectionInitiale,
} from '../src/lib/menu';

const RECETTE: Recette = {
  id: 'r1',
  nom: 'Poulet au four + riz',
  temps: '45 min · four 200°',
  kcal: 680,
  score: 7,
  fraicheur: 'batch dimanche → boîte frigo',
  pour: '6-8 cuisses · 250 g riz',
  bases: ['b4'],
  etapes: ['Four 200°.', 'Rôtir 40 min.'],
  portions: { marc: '1 poignée de riz (~150 g) · 2 cuisses', melanie: 'poulet ×2 (sans riz)' },
};

const MENU: MenuDay[] = [
  {
    jour: 'Lundi',
    dejeunerMarc: 'Boîte poulet-riz',
    dejeunerMelanie: 'Restes poulet',
    dinerFamille: 'Poulet au four + riz',
    dinerMelanie: 'Poulet + légumes (sans riz)',
    batch: 'Double riz → boîte mardi',
    recetteRefs: { dinerFamille: 'R1', dejeunerMarc: 'R1', dejeunerMelanie: 'R1' },
  },
  { jour: 'Mardi', dejeunerMarc: 'Boîte poulet-riz (lun)', recetteRefs: { dejeunerMarc: 'R1' } },
  { jour: 'Mercredi', dinerFamille: 'Omelette + salade' },
  { jour: 'Jeudi', dejeunerMarc: 'Restes ou wrap' },
];

describe('menu — labelCourt', () => {
  it('garde le premier segment avant séparateur (+ · —)', () => {
    expect(labelCourt('Poulet au four + riz')).toBe('Poulet au four');
    expect(labelCourt('Omelette + salade')).toBe('Omelette');
    expect(labelCourt('Rôti de dinde + gratin de courgettes + quinoa')).toBe('Rôti de dinde');
  });

  it('tronque les noms longs sur une borne de mot (espace ou tiret)', () => {
    expect(labelCourt('Cuisses de poulet rôties + légumes + riz')).toBe('Cuisses de poulet…');
    expect(labelCourt('Omelette fromage-jambon + pommes vapeur')).toBe('Omelette fromage…');
    expect(labelCourt('Soupe butternut-carotte + tartines')).toBe('Soupe butternut…');
  });
});

describe('menu — construireOnglets', () => {
  it('un onglet par jour qui a un dîner, dans l ordre du fichier', () => {
    const onglets = construireOnglets(MENU, [RECETTE]);
    expect(onglets).toHaveLength(2); // mardi (déjeuner seul) et jeudi n ouvrent pas d onglet
    expect(onglets[0].jour).toBe('Lundi');
    expect(onglets[1].jour).toBe('Mercredi');
  });

  it('la coche de l onglet = dinerFamille, le label = nom court de la recette', () => {
    const [lundi] = construireOnglets(MENU, [RECETTE]);
    expect(lundi.cleCoche).toBe('menu:lundi:dinerFamille');
    expect(lundi.label).toBe('Poulet au four');
    expect(lundi.recette?.id).toBe('r1');
    expect(lundi.diner?.id).toBe('menu:lundi:dinerFamille');
    expect(lundi.mel?.texte).toBe('Poulet + légumes (sans riz)');
    expect(lundi.batch?.texte).toBe('Double riz → boîte mardi');
  });

  it('jour sans recette : label = dîner tronqué, coche en repli sur dinerMelanie si pas de dinerFamille', () => {
    const [, mercredi] = construireOnglets(MENU, [RECETTE]);
    expect(mercredi.label).toBe('Omelette');
    expect(mercredi.recette).toBeUndefined();

    const repli = construireOnglets(
      [{ jour: 'Vendredi', dinerMelanie: 'Bowl saumon + avocat' }],
      [],
    );
    expect(repli[0].cleCoche).toBe('menu:vendredi:dinerMelanie');
    expect(repli[0].label).toBe('Bowl saumon');
  });
});

describe('menu — paires de déjeuners', () => {
  const paires = construirePaires(MENU, [RECETTE]);

  it('une paire par jour qui a au moins un déjeuner, dans l ordre du fichier', () => {
    expect(paires).toHaveLength(3); // lundi, mardi, jeudi — mercredi n a pas de déjeuner
    expect(paires[0].ids).toEqual(['menu:lundi:dejeunerMarc', 'menu:lundi:dejeunerMelanie']);
    expect(paires[1].ids).toEqual(['menu:mardi:dejeunerMarc']); // une seule ligne
    expect(paires[2].ids).toEqual(['menu:jeudi:dejeunerMarc']);
  });

  it('pairePrete : ref débloquée par le dîner de la recette source, sans ref = toujours prête', () => {
    const faits = faitsParRecette(MENU);
    expect(faits['R1']).toEqual(['menu:lundi:dinerFamille']); // seul dinerFamille réalise R1
    expect(pairePrete(paires[0], {}, faits)).toBe(false); // lundi ← R1 pas fait
    expect(pairePrete(paires[0], { 'menu:lundi:dinerFamille': true }, faits)).toBe(true);
    expect(pairePrete(paires[1], { 'menu:lundi:dinerFamille': true }, faits)).toBe(true);
    expect(pairePrete(paires[2], {}, faits)).toBe(true); // jeudi sans ref : toujours prête
  });

  it('paireFaite : toutes les lignes de la paire cochées', () => {
    expect(paireFaite(paires[0], {})).toBe(false);
    expect(
      paireFaite(paires[0], {
        'menu:lundi:dejeunerMarc': true,
        'menu:lundi:dejeunerMelanie': true,
      }),
    ).toBe(true);
    expect(paireFaite(paires[1], { 'menu:mardi:dejeunerMarc': true })).toBe(true);
  });

  it('debloquePar : le nom court de la recette manquante, null sinon', () => {
    const faits = faitsParRecette(MENU);
    expect(debloquePar(paires[0], {}, faits)).toBe('Poulet au four');
    expect(debloquePar(paires[0], { 'menu:lundi:dinerFamille': true }, faits)).toBeNull();
    expect(debloquePar(paires[2], {}, faits)).toBeNull();
  });

  it('ref cassée : la note retombe sur la ref brute (jamais de crash)', () => {
    const pairesRc = construirePaires(
      [{ jour: 'Vendredi', dejeunerMarc: 'Box mystère', recetteRefs: { dejeunerMarc: 'R99' } }],
      [RECETTE],
    );
    expect(debloquePar(pairesRc[0], {}, faitsParRecette(
      [{ jour: 'Vendredi', dejeunerMarc: 'Box mystère', recetteRefs: { dejeunerMarc: 'R99' } }],
    ))).toBe('R99');
  });
});

describe('menu — selectionInitiale', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('jour courant présélectionné (mercredi → Omelette)', () => {
    vi.setSystemTime(new Date('2026-09-09T10:00:00')); // mercredi
    const onglets = construireOnglets(MENU, [RECETTE]);
    expect(selectionInitiale(onglets, MENU, {})).toBe(1);
  });

  it('hors menu : premier onglet non fait, sinon le premier', () => {
    vi.setSystemTime(new Date('2026-09-11T10:00:00')); // vendredi, absent du menu
    const onglets = construireOnglets(MENU, [RECETTE]);
    expect(selectionInitiale(onglets, MENU, {})).toBe(0);
    expect(
      selectionInitiale(onglets, MENU, {
        'menu:lundi:dinerFamille': true,
        'menu:mercredi:dinerFamille': true,
      }),
    ).toBe(0);
  });

  it('onglets vides : retombe sur 0 (l appelant doit garder)', () => {
    expect(selectionInitiale([], [], {})).toBe(0);
  });
});
